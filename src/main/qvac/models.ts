// Carga única de los tres modelos con SU configuración medida.
// Sin Electron: importable desde Node puro para el humo del motor.

import * as sdk from '@qvac/sdk'
import type { ModelKey, ModelStatus } from '../../shared/types.ts'
import { whisperHint } from './prompts.ts'

// El worker tarda más de 30 s en arrancar en Windows en frío. Sin esto, RPC_INIT_TIMEOUT.
process.env.QVAC_RPC_INIT_TIMEOUT_MS ??= '240000'

const ids: Partial<Record<ModelKey, string>> = {}
const status: ModelStatus = {
  gemma: { state: 'idle' },
  whisper: { state: 'idle' },
  embed: { state: 'idle' }
}

export function getModelStatus(): ModelStatus {
  return JSON.parse(JSON.stringify(status)) as ModelStatus
}

export function requireModel(key: ModelKey): string {
  const id = ids[key]
  if (!id) throw new Error(`Modelo ${key} no está listo (${status[key].state})`)
  return id
}

export function isReady(key: ModelKey): boolean {
  return status[key].state === 'ready'
}

type Progress = (p: { percentage: number }) => void

async function track<T>(key: ModelKey, loader: () => Promise<T>): Promise<T> {
  status[key] = { state: 'loading' }
  const t0 = Date.now()
  try {
    const result = await loader()
    status[key] = { state: 'ready', ms: Date.now() - t0 }
    return result
  } catch (e) {
    status[key] = { state: 'error', error: e instanceof Error ? e.message : String(e) }
    throw e
  }
}

export async function loadGemma(onProgress?: Progress): Promise<string> {
  if (ids.gemma) return ids.gemma
  return track('gemma', async () => {
    ids.gemma = await sdk.loadModel({
      modelSrc: sdk.GEMMA4_2B_MULTIMODAL_Q4_K_M,
      // El default es 1024 y desborda con dictados largos o caché acumulada.
      modelConfig: { ctx_size: 4096 },
      onProgress
    })
    return ids.gemma
  })
}

export async function loadWhisper(customerNames: string[], onProgress?: Progress): Promise<string> {
  if (ids.whisper) return ids.whisper
  return track('whisper', async () => {
    ids.whisper = await sdk.loadModel({
      modelSrc: sdk.WHISPER_BASE_Q8_0,
      modelConfig: {
        language: 'es', // Sin esto, Whisper autodetecta y TRADUCE al inglés
        translate: false,
        no_timestamps: true,
        initial_prompt: whisperHint(customerNames)
      },
      onProgress
    })
    return ids.whisper
  })
}

/** Whisper lleva el catálogo de clientes en su prompt. Si cambian, se recarga. */
export async function reloadWhisper(customerNames: string[]): Promise<string> {
  if (ids.whisper) {
    const old = ids.whisper
    ids.whisper = undefined
    status.whisper = { state: 'idle' }
    await sdk.unloadModel({ modelId: old }).catch(() => undefined)
  }
  return loadWhisper(customerNames)
}

export async function loadEmbed(onProgress?: Progress): Promise<string> {
  if (ids.embed) return ids.embed
  return track('embed', async () => {
    ids.embed = await sdk.loadModel({ modelSrc: sdk.EMBEDDINGGEMMA_300M_Q8_0, onProgress })
    return ids.embed
  })
}

/** Carga los tres en paralelo. No lanza: cada fallo queda en status[key]. */
export async function warmup(customerNames: string[]): Promise<ModelStatus> {
  await Promise.allSettled([loadGemma(), loadWhisper(customerNames), loadEmbed()])
  return getModelStatus()
}

export async function unloadAll(): Promise<void> {
  for (const key of Object.keys(ids) as ModelKey[]) {
    const id = ids[key]
    if (id) await sdk.unloadModel({ modelId: id }).catch(() => undefined)
    ids[key] = undefined
    status[key] = { state: 'idle' }
  }
}
