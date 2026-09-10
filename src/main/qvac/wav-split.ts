// Trocear un WAV largo en tramos que el motor pueda transcribir enteros.
//
// Por qué existe: `sdk.transcribe` recibe un `audioChunk`, no una grabación
// completa, y con una nota larga devuelve solo el primer tramo. Medido sobre el
// mismo audio, la misma voz y el mismo formato: 9,72 s vuelve completo; 15,72 s
// y 25,44 s vuelven con la primera frase y nada más, sin error y sin aviso. El
// propio SDK trae un ejemplo para audios largos que corta por silencios y
// transcribe un segmento a la vez.
//
// Aquí se corta por silencios igual que ese ejemplo, pero sin ffmpeg: el
// renderer ya entrega PCM 16-bit, 16 kHz, mono (D13), así que el corte se hace
// sobre las muestras. Los límites son deliberadamente cortos: la única duración
// que se comprobó que vuelve íntegra es de menos de diez segundos.

const HEADER_BYTES = 44

export interface Wav {
  sampleRate: number
  channels: number
  bitsPerSample: number
  samples: Int16Array
}

export interface Tramo {
  /** Índice de la primera muestra, inclusive. */
  from: number
  /** Índice de la última muestra, exclusivo. */
  to: number
}

/**
 * Lee un WAV PCM 16-bit recorriendo los bloques de la cabecera RIFF. No asume
 * que `data` empiece en el byte 44: algunos grabadores meten bloques `LIST`
 * antes, y leer a ciegas ahí mete basura al principio del audio.
 */
export function parseWav(bytes: Uint8Array): Wav {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (o: number): string => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3])
  if (bytes.byteLength < HEADER_BYTES || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') {
    throw new Error('El audio no es un WAV RIFF')
  }

  let sampleRate = 0
  let channels = 0
  let bitsPerSample = 0
  let dataFrom = 0
  let dataLen = 0

  let o = 12
  while (o + 8 <= bytes.byteLength) {
    const id = tag(o)
    const size = v.getUint32(o + 4, true)
    const body = o + 8
    if (id === 'fmt ') {
      channels = v.getUint16(body + 2, true)
      sampleRate = v.getUint32(body + 4, true)
      bitsPerSample = v.getUint16(body + 14, true)
    } else if (id === 'data') {
      dataFrom = body
      dataLen = Math.min(size, bytes.byteLength - body)
    }
    // Los bloques van alineados a dos bytes.
    o = body + size + (size % 2)
  }

  if (!sampleRate || !dataFrom) throw new Error('Al WAV le falta el bloque fmt o el bloque data')
  if (bitsPerSample !== 16) throw new Error(`El WAV es de ${bitsPerSample} bits: se esperaban 16`)

  const total = Math.floor(dataLen / 2)
  const samples = new Int16Array(total)
  for (let i = 0; i < total; i++) samples[i] = v.getInt16(dataFrom + i * 2, true)
  return { sampleRate, channels: channels || 1, bitsPerSample, samples }
}

/** Vuelve a empaquetar un tramo de muestras como WAV mono. */
export function encodeWav(samples: Int16Array, sampleRate: number): Uint8Array {
  const dataLen = samples.length * 2
  const buf = new ArrayBuffer(HEADER_BYTES + dataLen)
  const v = new DataView(buf)
  const str = (o: number, s: string): void => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  str(0, 'RIFF')
  v.setUint32(4, 36 + dataLen, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sampleRate, true)
  v.setUint32(28, sampleRate * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  str(36, 'data')
  v.setUint32(40, dataLen, true)
  const out = new Uint8Array(buf)
  const body = new DataView(buf, HEADER_BYTES)
  for (let i = 0; i < samples.length; i++) body.setInt16(i * 2, samples[i], true)
  return out
}

export interface SplitOptions {
  /** Ningún tramo se cierra antes de esto, aunque haya silencio. */
  minSegmentS?: number
  /** Sin silencio a la vista, se corta aquí a secas. */
  maxSegmentS?: number
  /** Cuánto silencio seguido cuenta como final de frase. */
  silenceS?: number
  /** Nivel por debajo del cual una ventana se considera silencio, 0..1 del pico. */
  silenceRatio?: number
}

const VENTANA_S = 0.02

/**
 * Elige los cortes de un audio largo. Devuelve un solo tramo si ya cabe entero.
 *
 * La regla es "cierra en el primer silencio que llegue pasado el mínimo": eso
 * deja un tramo por frase dictada, que es la unidad que el motor devuelve bien.
 * Buscar el silencio más largo daría tramos más parejos, pero también junta dos
 * frases en uno, que es justo lo que se está evitando.
 */
export function splitOnSilence(samples: Int16Array, sampleRate: number, opts: SplitOptions = {}): Tramo[] {
  const minS = opts.minSegmentS ?? 5
  const maxS = opts.maxSegmentS ?? 15
  const silS = opts.silenceS ?? 0.35
  const ratio = opts.silenceRatio ?? 0.06

  const total = samples.length
  if (total === 0) return []
  if (total <= maxS * sampleRate) return [{ from: 0, to: total }]

  // Energía por ventana corta. Se compara contra el pico del propio audio, no
  // contra un absoluto: el volumen de dictado cambia con el micrófono y con la
  // distancia, y un umbral fijo o corta por todos lados o no corta nunca.
  const paso = Math.max(1, Math.round(VENTANA_S * sampleRate))
  const ventanas = Math.ceil(total / paso)
  const rms = new Float64Array(ventanas)
  let pico = 0
  for (let w = 0; w < ventanas; w++) {
    const a = w * paso
    const b = Math.min(a + paso, total)
    let sum = 0
    for (let i = a; i < b; i++) {
      const s = samples[i] / 32768
      sum += s * s
    }
    const r = Math.sqrt(sum / Math.max(1, b - a))
    rms[w] = r
    if (r > pico) pico = r
  }
  const umbral = pico * ratio

  const minVent = Math.round((minS * sampleRate) / paso)
  const maxVent = Math.round((maxS * sampleRate) / paso)
  const silVent = Math.max(1, Math.round((silS * sampleRate) / paso))

  const tramos: Tramo[] = []
  let inicio = 0
  let w = 0
  let corrida = 0

  while (w < ventanas) {
    const enSilencio = rms[w] <= umbral
    corrida = enSilencio ? corrida + 1 : 0
    const largo = w - inicio + 1

    // Silencio suficiente y ya pasamos el mínimo: se cierra en mitad del
    // silencio, para no morder la última sílaba ni la primera de la siguiente.
    if (corrida >= silVent && largo >= minVent) {
      const corte = Math.min(total, (w - Math.floor(corrida / 2) + 1) * paso)
      if (corte > inicio * paso) {
        tramos.push({ from: inicio * paso, to: corte })
        inicio = Math.ceil(corte / paso)
        corrida = 0
      }
    } else if (largo >= maxVent) {
      const corte = Math.min(total, (w + 1) * paso)
      tramos.push({ from: inicio * paso, to: corte })
      inicio = Math.ceil(corte / paso)
      corrida = 0
    }
    w++
  }

  const resto = inicio * paso
  if (resto < total) {
    // Una cola muy corta se pega al tramo anterior en vez de ir sola: un
    // "gracias" de medio segundo no merece una llamada al modelo.
    const ultimo = tramos[tramos.length - 1]
    if (ultimo && total - resto < minS * sampleRate * 0.4) ultimo.to = total
    else tramos.push({ from: resto, to: total })
  }

  return tramos.length ? tramos : [{ from: 0, to: total }]
}
