// Captura del micrófono a WAV PCM 16-bit, 16 kHz, mono, sin ffmpeg ni webm.
// Whisper recibe exactamente el formato con el que se midió el banco.
//
// ScriptProcessorNode está marcado obsoleto pero sigue en Chromium/Electron y
// no exige servir un archivo de worklet aparte. Cambiarlo por AudioWorklet es
// trabajo futuro, no riesgo.

const TARGET_RATE = 16000

export class WavRecorder {
  private stream: MediaStream | null = null
  private ctx: AudioContext | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private chunks: Float32Array[] = []
  private inputRate = TARGET_RATE
  /** Nivel de entrada 0..1, suavizado. Alimenta las barras del micrófono. */
  level = 0

  get active(): boolean {
    return this.processor !== null
  }

  async start(): Promise<void> {
    if (this.active) return
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
    })
    this.ctx = new AudioContext()
    this.inputRate = this.ctx.sampleRate
    this.source = this.ctx.createMediaStreamSource(this.stream)
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1)
    this.chunks = []
    this.level = 0
    this.processor.onaudioprocess = (e) => {
      const buf = e.inputBuffer.getChannelData(0)
      this.chunks.push(new Float32Array(buf))
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      const rms = Math.sqrt(sum / buf.length)
      // Escala perceptual y suavizado: el valor crudo apenas se mueve al hablar.
      const target = Math.min(1, Math.sqrt(rms) * 2.6)
      this.level = this.level * 0.65 + target * 0.35
    }
    this.source.connect(this.processor)
    // Sin conectar a destination el nodo no procesa en algunos Chromium.
    this.processor.connect(this.ctx.destination)
  }

  /** Detiene y devuelve los bytes WAV listos para audio:transcribe. */
  async stop(): Promise<Uint8Array> {
    if (!this.processor || !this.ctx) throw new Error('No hay grabación activa')
    this.processor.disconnect()
    this.source?.disconnect()
    this.stream?.getTracks().forEach((t) => t.stop())
    await this.ctx.close()

    const samples = concat(this.chunks)
    const mono16k = downsample(samples, this.inputRate, TARGET_RATE)
    const wav = encodeWav(mono16k, TARGET_RATE)

    this.processor = null
    this.source = null
    this.stream = null
    this.ctx = null
    this.chunks = []
    this.level = 0
    return wav
  }

  /** Segundos grabados hasta ahora, para mostrar en pantalla. */
  get seconds(): number {
    const n = this.chunks.reduce((s, c) => s + c.length, 0)
    return n / this.inputRate
  }
}

function concat(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((s, c) => s + c.length, 0)
  const out = new Float32Array(total)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

// Decimación con promedio por ventana. Suficiente para voz; evita el aliasing
// grueso de tomar una muestra de cada N.
function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input
  const ratio = from / to
  const outLen = Math.floor(input.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(Math.floor((i + 1) * ratio), input.length)
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    out[i] = end > start ? sum / (end - start) : 0
  }
  return out
}

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2
  const dataLen = samples.length * bytesPerSample
  const buf = new ArrayBuffer(44 + dataLen)
  const v = new DataView(buf)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF')
  v.setUint32(4, 36 + dataLen, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)          // tamaño del bloque fmt
  v.setUint16(20, 1, true)           // PCM
  v.setUint16(22, 1, true)           // mono
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * bytesPerSample, true)
  v.setUint16(32, bytesPerSample, true)
  v.setUint16(34, 16, true)          // bits por muestra
  str(36, 'data')
  v.setUint32(40, dataLen, true)
  let o = 44
  for (let i = 0; i < samples.length; i++, o += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Uint8Array(buf)
}
