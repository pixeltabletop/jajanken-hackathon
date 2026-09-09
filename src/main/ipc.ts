// Handlers IPC. Cada uno delega a un módulo del motor o al almacén.
// Nunca lanzan al renderer: devuelven { error: { code, message } }.
// Este es el único archivo del motor que importa Electron.

import { ipcMain } from 'electron'
import type {
  ApiError,
  DedupResult,
  ExtractResult,
  Language,
  ModelStatus,
  Observation,
  TranscribeResult
} from '../shared/types.ts'
import { buildCanonical, rankCandidates } from './qvac/dedup.ts'
import { extractObservation } from './qvac/extract.ts'
import * as models from './qvac/models.ts'
import { transcribeWav } from './qvac/transcribe.ts'
import type { Store } from './store.ts'

type Handler<A extends unknown[], R> = (...args: A) => Promise<R> | R

function safe<A extends unknown[], R>(code: string, fn: Handler<A, R>) {
  return async (_e: unknown, ...args: A): Promise<R | ApiError> => {
    try {
      return await fn(...args)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[ipc:${code}]`, message)
      return { error: { code, message } }
    }
  }
}

export function registerIpc(store: Store): void {
  ipcMain.handle(
    'models:status',
    safe<[], ModelStatus>('MODELS_STATUS', () => models.getModelStatus())
  )

  ipcMain.handle(
    'models:warmup',
    safe<[], ModelStatus>('MODELS_WARMUP', async () => {
      const customers = await store.customers()
      return models.warmup(customers.map((c) => c.name))
    })
  )

  ipcMain.handle(
    'audio:transcribe',
    safe<[{ wav: Uint8Array | ArrayBuffer }], TranscribeResult>('TRANSCRIBE', ({ wav }) => {
      const bytes = wav instanceof Uint8Array ? wav : new Uint8Array(wav)
      return transcribeWav(models.requireModel('whisper'), bytes)
    })
  )

  ipcMain.handle(
    'obs:extract',
    safe<[{ text: string; language: Language; source?: Observation['source'] }], ExtractResult>(
      'EXTRACT',
      async ({ text, language, source }) => {
        const r = await extractObservation(models.requireModel('gemma'), {
          rawText: text,
          language,
          source: source ?? 'Text'
        })
        // La extracción no adivina el país. Se infiere del catálogo por ciudad.
        r.observation.country = await store.inferCountry(r.observation.city)
        return r
      }
    )
  )

  ipcMain.handle(
    'obs:dedup',
    safe<[{ facility: string; city: string | null }], DedupResult>('DEDUP', async ({ facility, city }) => {
      const embedId = models.requireModel('embed')
      const customers = await store.customers()
      const { canonical, cache, embedded } = await buildCanonical(embedId, customers, await store.getVectors())
      if (embedded > 0) await store.setVectors(cache)
      return rankCandidates(embedId, facility, city, canonical)
    })
  )

  ipcMain.handle(
    'obs:save',
    safe<[Observation], Observation[]>('SAVE', async (obs) => {
      const before = new Set((await store.customers()).map((c) => c.name))
      const all = await store.save(obs)
      // Cliente nuevo: Whisper lleva el catálogo en su prompt y hay que recargarlo.
      const name = obs.facilityCanonical ?? obs.facility
      if (!before.has(name)) {
        const names = (await store.customers()).map((c) => c.name)
        void models.reloadWhisper(names).catch((e) => console.error('[whisper reload]', e))
      }
      return all
    })
  )

  ipcMain.handle(
    'obs:list',
    safe<[], Observation[]>('LIST', () => store.list())
  )

  // Bloque 5. Se conecta solo si mide >= 7/10 en bench/bench_query.js.
  ipcMain.handle(
    'query:parse',
    safe<[{ question: string }], never>('QUERY', () => {
      throw new Error('La pregunta en español se construye en el Bloque 5')
    })
  )
}
