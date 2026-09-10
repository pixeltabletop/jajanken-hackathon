// Comprueba el troceo de audio largo SIN cargar ningún modelo.
//
// El defecto que esto vigila: `sdk.transcribe` devuelve solo el primer tramo de
// una grabación larga, en silencio. El arreglo es cortar por silencios antes de
// llamar al motor. Lo que se puede comprobar sin GPU ni modelos es que el corte
// sea correcto: que no pierda ni duplique una sola muestra, que ningún tramo
// pase del máximo, y que el WAV que se le entrega al motor se pueda volver a
// leer con la misma cabecera con la que se midió el banco.
//
// Uso:  node scripts/check-troceo.mjs

import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { encodeWav, parseWav, splitOnSilence } from '../src/main/qvac/wav-split.ts'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const MAX_S = 15

let fallos = 0
const ok = (cond, texto, detalle = '') => {
  if (cond) console.log(`  OK   ${texto}${detalle ? ` · ${detalle}` : ''}`)
  else {
    fallos++
    console.log(`  FALLA ${texto}${detalle ? ` · ${detalle}` : ''}`)
  }
}

/** Une varios clips en uno solo, con medio segundo de silencio entre frases. */
function unir(wavs, sampleRate) {
  const hueco = new Int16Array(Math.round(0.5 * sampleRate))
  const total = wavs.reduce((s, w) => s + w.length, 0) + hueco.length * (wavs.length - 1)
  const out = new Int16Array(total)
  let o = 0
  for (let i = 0; i < wavs.length; i++) {
    out.set(wavs[i], o)
    o += wavs[i].length
    if (i < wavs.length - 1) {
      out.set(hueco, o)
      o += hueco.length
    }
  }
  return out
}

const dir = join(RAIZ, 'audio')
let nombres = []
try {
  nombres = (await readdir(dir)).filter((n) => n.endsWith('.wav')).sort()
} catch {
  console.log('Sin carpeta audio/: se comprueba solo con audio sintético.')
}

console.log('Troceo de audio largo\n')

// ---------------------------------------------------------------- caso 1
// Audio real, si lo hay: varias frases seguidas con silencio entre ellas.
if (nombres.length >= 3) {
  const clips = []
  let rate = 16000
  for (const n of nombres.slice(0, 5)) {
    const w = parseWav(new Uint8Array(await readFile(join(dir, n))))
    rate = w.sampleRate
    clips.push(w.samples)
  }
  const largo = unir(clips, rate)
  const segundos = largo.length / rate
  console.log(`Caso 1 · ${clips.length} clips reales unidos, ${segundos.toFixed(2)} s a ${rate} Hz`)

  const tramos = splitOnSilence(largo, rate)
  ok(tramos.length > 1, 'el audio largo se trocea', `${tramos.length} tramos`)
  ok(tramos[0].from === 0, 'el primer tramo arranca en cero')
  ok(tramos[tramos.length - 1].to === largo.length, 'el último tramo llega al final')

  let contiguo = true
  for (let i = 1; i < tramos.length; i++) if (tramos[i].from !== tramos[i - 1].to) contiguo = false
  ok(contiguo, 'los tramos son contiguos: ni hueco ni solape')

  const suma = tramos.reduce((s, t) => s + (t.to - t.from), 0)
  ok(suma === largo.length, 'no se pierde ni una muestra', `${suma} de ${largo.length}`)

  const duraciones = tramos.map((t) => (t.to - t.from) / rate)
  ok(
    duraciones.every((d) => d <= MAX_S + 0.05),
    `ningún tramo pasa de ${MAX_S} s`,
    duraciones.map((d) => `${d.toFixed(1)}s`).join(' ')
  )
  ok(
    tramos.every((t) => t.to > t.from),
    'ningún tramo queda vacío'
  )
} else {
  console.log('Caso 1 · omitido: hacen falta 3 clips en audio/')
}

// ---------------------------------------------------------------- caso 2
// Audio sintético: tono, silencio, tono. El corte tiene que caer en el hueco.
{
  const rate = 16000
  const tono = (segundos) => {
    const n = Math.round(segundos * rate)
    const a = new Int16Array(n)
    for (let i = 0; i < n; i++) a[i] = Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 12000)
    return a
  }
  const silencio = (segundos) => new Int16Array(Math.round(segundos * rate))
  const partes = [tono(8), silencio(1), tono(8), silencio(1), tono(8)]
  const total = partes.reduce((s, p) => s + p.length, 0)
  const audio = new Int16Array(total)
  let o = 0
  for (const p of partes) {
    audio.set(p, o)
    o += p.length
  }
  console.log(`\nCaso 2 · sintético, ${(total / rate).toFixed(2)} s con dos silencios de 1 s`)

  const tramos = splitOnSilence(audio, rate)
  ok(tramos.length === 3, 'sale un tramo por frase', `${tramos.length} tramos`)
  const cortes = tramos.slice(0, -1).map((t) => t.to / rate)
  ok(
    cortes.every((c) => (c > 8 && c < 9) || (c > 17 && c < 18)),
    'los cortes caen dentro del silencio',
    cortes.map((c) => `${c.toFixed(2)}s`).join(' ')
  )
}

// ---------------------------------------------------------------- caso 3
// Nota corta: una sola llamada al motor, como hasta ahora.
{
  const rate = 16000
  const corto = new Int16Array(Math.round(9 * rate))
  for (let i = 0; i < corto.length; i++) corto[i] = Math.round(Math.sin((2 * Math.PI * 220 * i) / rate) * 9000)
  console.log('\nCaso 3 · nota de 9 s')
  const tramos = splitOnSilence(corto, rate)
  ok(tramos.length === 1, 'una nota corta sigue yendo en una sola llamada')
}

// ---------------------------------------------------------------- caso 4
// Ida y vuelta: lo que se le entrega al motor tiene que ser un WAV legible con
// el formato exacto con el que se midió el banco.
{
  const rate = 16000
  const muestras = new Int16Array(rate * 2)
  for (let i = 0; i < muestras.length; i++) muestras[i] = ((i * 37) % 65536) - 32768
  console.log('\nCaso 4 · ida y vuelta del WAV de un tramo')
  const w = parseWav(encodeWav(muestras, rate))
  ok(w.sampleRate === 16000, 'vuelve a 16 kHz')
  ok(w.channels === 1, 'vuelve mono')
  ok(w.bitsPerSample === 16, 'vuelve a 16 bits')
  ok(w.samples.length === muestras.length, 'no cambia el número de muestras')
  let iguales = true
  for (let i = 0; i < muestras.length; i++) if (w.samples[i] !== muestras[i]) iguales = false
  ok(iguales, 'las muestras son idénticas')
}

console.log(`\n${fallos === 0 ? 'Troceo correcto.' : `${fallos} comprobaciones fallidas.`}`)
process.exit(fallos === 0 ? 0 : 1)
