// Carga única de los tres modelos con SU configuración medida.
// Sin Electron: importable desde Node puro para el humo del motor.

import * as sdk from '@qvac/sdk'
import type { ModelKey, ModelStatus } from '../../shared/types.ts'
import { whisperHint } from './prompts.ts'

// El worker tarda más de 30 s en arrancar en Windows en frío. Sin esto, RPC_INIT_TIMEOUT.
process.env.QVAC_RPC_INIT_TIMEOUT_MS ??= '240000'

const ids: Partial<Record<ModelKey, string>> = {}
// Cargas en curso. Sin esto, dos llamadas concurrentes al mismo modelo arrancan
// dos cargas: el dictado que llega antes de que termine el calentamiento
// duplicaría 150 MB de Whisper, o peor, 3.4 GB de Gemma.
const inflight: Partial<Record<ModelKey, Promise<string>>> = {}
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

/**
 * El identificador de un modelo puede morir con la aplicación abierta: si el
 * worker de QVAC se reinicia, los handles que guardamos en memoria dejan de
 * existir y el SDK responde `Model with ID "..." not found`.
 *
 * Pasó, y de la peor manera posible: `models:status` seguía diciendo que los
 * tres estaban listos, la pantalla pintaba tres puntos verdes, y TODA inferencia
 * fallaba. Un estado en memoria que nadie revalida es una mentira con fecha de
 * caducidad.
 */
export function isStaleModelError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /not found|no such model|unknown model|invalid model|model .* not loaded/i.test(msg)
}

/** Olvida el modelo: el siguiente uso lo vuelve a cargar y el estado lo dice. */
export function forget(key: ModelKey): void {
  ids[key] = undefined
  inflight[key] = undefined
  status[key] = { state: 'idle' }
}

const LOADER: Record<ModelKey, (names: string[]) => Promise<string>> = {
  gemma: () => loadGemma(),
  whisper: (names) => loadWhisper(names),
  embed: () => loadEmbed()
}

/**
 * Ejecuta algo que usa un modelo y, si el handle estaba muerto, lo recarga y lo
 * intenta UNA vez más. Un reintento y no más: si vuelve a fallar, el problema no
 * es el handle y hay que verlo, no esconderlo detrás de un bucle.
 */
export async function withModel<T>(
  key: ModelKey,
  customerNames: string[],
  fn: (modelId: string) => Promise<T>
): Promise<T> {
  const id = await LOADER[key](customerNames)
  try {
    return await fn(id)
  } catch (e) {
    if (!isStaleModelError(e)) throw e
    // Si el worker se reinició, se llevó a los TRES por delante. Olvidarlos a
    // todos hace que el semáforo diga la verdad de inmediato, en vez de seguir
    // en verde hasta que alguien tropiece con el siguiente.
    console.error(`[qvac] el modelo ${key} ya no existía en el worker; se recargan y se reintenta`)
    for (const k of ['gemma', 'whisper', 'embed'] as ModelKey[]) forget(k)
    const fresco = await LOADER[key](customerNames)
    return fn(fresco)
  }
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
    status[key] = { state: 'error', error: describeLoadError(e) }
    throw e
  }
}

// El SDK reporta "RPC initialization timed out" aunque el worker haya muerto al
// instante. La causa real viene en cause.stderrTail. Sin esto se pierde una hora.
function describeLoadError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const cause = (e as { cause?: { message?: string; stderrTail?: string; exitCode?: number } })?.cause
  if (!cause) return msg
  const tail = (cause.stderrTail ?? '').split(/\r?\n/).find((l) => l.trim()) ?? ''
  const parts = [msg]
  if (cause.exitCode != null) parts.push(`worker exit ${cause.exitCode}`)
  if (tail) parts.push(tail.slice(0, 300))
  return parts.join(' · ')
}

export async function loadGemma(onProgress?: Progress): Promise<string> {
  if (ids.gemma) return ids.gemma
  if (inflight.gemma) return inflight.gemma
  inflight.gemma = track('gemma', async () => {
    ids.gemma = await sdk.loadModel({
      modelSrc: sdk.GEMMA4_2B_MULTIMODAL_Q4_K_M,
      // El default es 1024 y desborda con dictados largos o caché acumulada.
      modelConfig: { ctx_size: 4096 },
      onProgress
    })
    return ids.gemma
  }).finally(() => { inflight.gemma = undefined }) as Promise<string>
  return inflight.gemma
}

export async function loadWhisper(customerNames: string[], onProgress?: Progress): Promise<string> {
  if (ids.whisper) return ids.whisper
  if (inflight.whisper) return inflight.whisper
  inflight.whisper = track('whisper', async () => {
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
  }).finally(() => { inflight.whisper = undefined }) as Promise<string>
  return inflight.whisper
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
  if (inflight.embed) return inflight.embed
  inflight.embed = track('embed', async () => {
    ids.embed = await sdk.loadModel({ modelSrc: sdk.EMBEDDINGGEMMA_300M_Q8_0, onProgress })
    return ids.embed
  }).finally(() => { inflight.embed = undefined }) as Promise<string>
  return inflight.embed
}

/**
 * Calienta los tres modelos EN PARALELO. No lanza: cada fallo queda en status.
 *
 * Medido el 2026-09-09 en la HP ProBook 450 G10, con la tabla de tiempos limpia
 * y el reloj interno del proceso principal:
 *
 * | Orden                           | Voz    | Dedup  | Extracción | Total  |
 * |---------------------------------|--------|--------|------------|--------|
 * | Los tres en paralelo            | 23.6 s | 29.0 s | 61.3 s     | 61.3 s |
 * | Whisper primero, luego los otros| 24.3 s |  4.7 s | 30.1 s     | 54.4 s |
 * | Paralelo, promedio de 4 corridas| 19.2 s | 23.9 s | 48.8 s     | 48.8 s |
 *
 * Conclusión: el orden no mueve la aguja, las dos formas caen alrededor del
 * minuto y la diferencia entre corridas es mayor que la diferencia entre
 * órdenes. El suelo son unos 20 s de arranque del worker de QVAC, que paga
 * entero el primer modelo que se cargue sea cual sea, más la lectura de los
 * 3.4 GB de Gemma. Cargar Whisper solo y primero NO lo hizo llegar antes
 * (24.3 s frente a 23.6 s), así que serializar solo añadía a Gemma detrás.
 *
 * Lo que sí bajó la espera real no fue el orden, sino dejar de esperar: el
 * arranque de marca dura 5 s fijos, escribir funciona desde el primer segundo,
 * dictar también (transcribir espera a Whisper si hace falta) e interpretar
 * avisa de que Gemma sigue cargando. Cambiar el modelo o la cuantización sí
 * bajaría el minuto, pero invalidaría el 8/10 medido (D03) a 36 horas de la
 * entrega.
 */
export async function warmup(customerNames: string[]): Promise<ModelStatus> {
  await Promise.allSettled([loadGemma(), loadWhisper(customerNames), loadEmbed()])
  return getModelStatus()
}

/** Espera a que Whisper esté listo, cargándolo si hiciera falta. */
export async function whisperReady(customerNames: string[]): Promise<string> {
  return loadWhisper(customerNames)
}

export async function unloadAll(): Promise<void> {
  for (const key of Object.keys(ids) as ModelKey[]) {
    const id = ids[key]
    if (id) await sdk.unloadModel({ modelId: id }).catch(() => undefined)
    ids[key] = undefined
    status[key] = { state: 'idle' }
  }
}
