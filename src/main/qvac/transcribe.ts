// Voz a texto. Recibe bytes WAV (PCM 16-bit, 16 kHz, mono) del renderer, los
// escribe a un archivo temporal y transcribe con Whisper ya configurado.
// El idioma y el vocabulario van en la carga del modelo, no aquí.
//
// Después de transcribir se corrigen los términos del dominio contra el
// catálogo: Whisper acierta la frase pero deforma lo que no conoce
// ("rayosex" por "rayos X"). Cada corrección se devuelve para que la
// interfaz la muestre; nada se cambia en silencio.

import * as sdk from '@qvac/sdk'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeTranscript } from '../../shared/transcript.ts'
import type { TranscribeResult } from '../../shared/types.ts'

export interface TranscribeOptions {
  brands?: readonly string[]
  customers?: readonly string[]
}

export async function transcribeFile(whisperId: string, path: string, opts: TranscribeOptions = {}): Promise<TranscribeResult> {
  const t0 = Date.now()
  const out = await sdk.transcribe({ modelId: whisperId, audioChunk: path })
  const rawText = String(out ?? '').trim()
  const { text, fixes } = normalizeTranscript(rawText, opts)
  return { text, rawText, fixes, ms: Date.now() - t0 }
}

export async function transcribeWav(whisperId: string, wav: Uint8Array, opts: TranscribeOptions = {}): Promise<TranscribeResult> {
  const dir = join(tmpdir(), 'eco-audio')
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.wav`)
  await writeFile(path, wav)
  try {
    return await transcribeFile(whisperId, path, opts)
  } finally {
    await unlink(path).catch(() => undefined)
  }
}
