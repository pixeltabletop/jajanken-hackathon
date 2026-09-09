// Voz a texto. Recibe bytes WAV (PCM 16-bit, 16 kHz, mono) del renderer, los escribe
// a un archivo temporal y transcribe con Whisper ya configurado en models.ts.
// El idioma y el vocabulario van en la carga del modelo, no aquí.

import * as sdk from '@qvac/sdk'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TranscribeResult } from '../../shared/types.ts'

export async function transcribeFile(whisperId: string, path: string): Promise<TranscribeResult> {
  const t0 = Date.now()
  const text = await sdk.transcribe({ modelId: whisperId, audioChunk: path })
  return { text: String(text ?? '').trim(), ms: Date.now() - t0 }
}

export async function transcribeWav(whisperId: string, wav: Uint8Array): Promise<TranscribeResult> {
  const dir = join(tmpdir(), 'fieldlens-audio')
  await mkdir(dir, { recursive: true })
  const path = join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.wav`)
  await writeFile(path, wav)
  try {
    return await transcribeFile(whisperId, path)
  } finally {
    await unlink(path).catch(() => undefined)
  }
}
