// Voz a texto. Recibe bytes WAV (PCM 16-bit, 16 kHz, mono) del renderer, los
// escribe a un archivo temporal y transcribe con Whisper ya configurado.
// El idioma y el vocabulario van en la carga del modelo, no aquí.
//
// Una nota larga NO va en una sola llamada. `sdk.transcribe` recibe un
// `audioChunk` y con una grabación entera devuelve solo el primer tramo, sin
// error: medido, 9,72 s vuelve completo y 15,72 s vuelve con la primera frase.
// Aquí se trocea por silencios (`wav-split.ts`) y se transcribe tramo a tramo,
// que es el patrón del ejemplo de audios largos del propio SDK.
//
// Después de transcribir se corrigen los términos del dominio contra el
// catálogo: Whisper acierta la frase pero deforma lo que no conoce
// ("rayosex" por "rayos X"). Cada corrección se devuelve para que la
// interfaz la muestre; nada se cambia en silencio. La corrección se aplica al
// texto ya unido, una sola vez, para que un término partido entre dos tramos no
// se cuente dos veces.

import * as sdk from '@qvac/sdk'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeTranscript } from '../../shared/transcript.ts'
import type { TranscribeResult } from '../../shared/types.ts'
import { encodeWav, parseWav, splitOnSilence } from './wav-split.ts'

export interface TranscribeOptions {
  brands?: readonly string[]
  customers?: readonly string[]
}

const DIR = (): string => join(tmpdir(), 'mam-audio')

const nombreTemporal = (): string =>
  join(DIR(), `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.wav`)

/** Una llamada al motor con un archivo ya en disco. */
async function transcribirTramo(whisperId: string, path: string): Promise<string> {
  const out = await sdk.transcribe({ modelId: whisperId, audioChunk: path })
  return String(out ?? '').trim()
}

/**
 * Transcribe los bytes de un WAV, troceándolo si hace falta.
 *
 * `pathOriginal` evita una copia cuando el audio ya está en disco y cabe en un
 * solo tramo, que es el caso normal de una nota corta.
 */
async function transcribirBytes(
  whisperId: string,
  bytes: Uint8Array,
  opts: TranscribeOptions,
  pathOriginal?: string
): Promise<TranscribeResult> {
  const t0 = Date.now()
  const { samples, sampleRate } = parseWav(bytes)
  const tramos = splitOnSilence(samples, sampleRate)

  const temporales: string[] = []
  let rawText = ''
  try {
    if (tramos.length === 1 && pathOriginal) {
      rawText = await transcribirTramo(whisperId, pathOriginal)
    } else {
      await mkdir(DIR(), { recursive: true })
      const partes: string[] = []
      for (const t of tramos) {
        const path = nombreTemporal()
        temporales.push(path)
        await writeFile(path, encodeWav(samples.subarray(t.from, t.to), sampleRate))
        const parte = await transcribirTramo(whisperId, path)
        if (parte) partes.push(parte)
      }
      rawText = partes.join(' ').replace(/\s+/g, ' ').trim()
    }
  } finally {
    for (const p of temporales) await unlink(p).catch(() => undefined)
  }

  const { text, fixes } = normalizeTranscript(rawText, opts)
  return { text, rawText, fixes, ms: Date.now() - t0, segments: tramos.length }
}

export async function transcribeFile(
  whisperId: string,
  path: string,
  opts: TranscribeOptions = {}
): Promise<TranscribeResult> {
  const bytes = new Uint8Array(await readFile(path))
  return transcribirBytes(whisperId, bytes, opts, path)
}

export async function transcribeWav(
  whisperId: string,
  wav: Uint8Array,
  opts: TranscribeOptions = {}
): Promise<TranscribeResult> {
  return transcribirBytes(whisperId, wav, opts)
}
