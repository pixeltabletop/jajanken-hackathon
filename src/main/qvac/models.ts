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
// Inferencias en curso. El worker es de un solo hilo: mientras razona no atiende
// nada más, ni siquiera un latido. Si el semáforo preguntara en ese momento y
// tomara el silencio por muerte, tiraría los tres modelos EN MITAD del trabajo.
// Ese sería un fallo peor que el que este archivo arregla.
let enUso = 0
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
  // El SDK numera sus errores y ese numero es la senal fiable. El texto queda de
  // respaldo por si el error llega envuelto y pierde el codigo por el camino.
  const code = (e as { code?: number })?.code
  if (code === sdk.SDK_SERVER_ERROR_CODES.MODEL_NOT_FOUND) return true
  if (code === sdk.SDK_SERVER_ERROR_CODES.MODEL_NOT_LOADED) return true
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
  enUso += 1
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
  } finally {
    enUso -= 1
  }
}

/**
 * Cuánto puede pasar entre dos comprobaciones REALES contra el worker. El
 * renderer sondea `models:status` cada 2 s mientras carga y cada 15 s después;
 * preguntarle al worker en cada sondeo sería ruido de RPC sin ninguna ganancia.
 */
const MS_ENTRE_REVISIONES = 5000
let ultimaRevision = 0
let revision: Promise<ModelStatus> | null = null

/**
 * Devuelve el estado de los modelos DESPUÉS de contrastarlo con el worker.
 *
 * El estado en memoria puede mentir. Si el worker de QVAC se reinicia o muere,
 * los identificadores que guardamos dejan de existir, y el semáforo se queda en
 * verde mientras toda inferencia falla. Pasó exactamente así: tres puntos
 * verdes en pantalla y ni una sola respuesta.
 *
 * `withModel` repara eso cuando alguien tropieza. Esto lo detecta ANTES de que
 * nadie tropiece, con dos preguntas al SDK que no cargan nada:
 *
 * - `heartbeat()`: ¿sigue respondiendo el worker?
 * - `getLoadedModelInfo()`: ¿sigue existiendo ESTE identificador?
 *
 * Medido matando `bare.exe` (`npm run smoke:semaforo`), y el resultado decide cuál
 * de las dos llamadas sostiene esto:
 *
 * | Momento tras matarlo | `heartbeat()`        | `getLoadedModelInfo()` |
 * |----------------------|----------------------|------------------------|
 * | +0,5 s               | rechaza, WorkerCrashed | ausente, 52002       |
 * | +2 s, +5 s, +10 s    | responde VIVO        | ausente, 52002         |
 *
 * El latido solo delata la muerte durante el primer segundo: el SDK levanta un
 * worker nuevo por su cuenta y a partir de ahí contesta que todo va bien, con los
 * modelos ya sin cargar. La que aguanta es la pregunta por identificador. Si algún
 * día se recorta este archivo, `getLoadedModelInfo` es la que no se puede quitar.
 *
 * No se pregunta si no hay nada que verificar, ni mientras haya una carga en
 * curso: durante el calentamiento el worker ya está ocupado, y un identificador
 * que todavía no ha nacido no puede estar muerto.
 */
export async function verifyStatus(customerNames: () => Promise<string[]>): Promise<ModelStatus> {
  if (revision) return revision
  const cargando = Object.values(inflight).some(Boolean)
  const listos = (Object.keys(status) as ModelKey[]).filter((k) => status[k].state === 'ready' && ids[k])
  if (enUso > 0 || cargando || listos.length === 0 || Date.now() - ultimaRevision < MS_ENTRE_REVISIONES) {
    return getModelStatus()
  }
  ultimaRevision = Date.now()
  revision = revisar(listos, customerNames).finally(() => {
    revision = null
  })
  return revision
}

async function revisar(listos: ModelKey[], customerNames: () => Promise<string[]>): Promise<ModelStatus> {
  const latido = await latir()
  if (latido === 'muerto') {
    // El worker rechazó el latido. No se llevó un modelo: se llevó los tres.
    console.error('[qvac] el worker no responde al latido; se olvidan los tres modelos')
    for (const k of ['gemma', 'whisper', 'embed'] as ModelKey[]) forget(k)
    recalentar(customerNames)
    return getModelStatus()
  }
  // 'mudo' es que tardó más de la cuenta, y eso NO prueba nada. Se deja el estado
  // como está y se vuelve a preguntar en la siguiente ronda.
  if (latido === 'mudo') return getModelStatus()

  let perdido = false
  for (const k of listos) {
    const id = ids[k]
    if (!id) continue
    try {
      await sdk.getLoadedModelInfo({ modelId: id })
    } catch (e) {
      // Un error de otro tipo (un RPC lento, un tropiezo puntual) NO es prueba de
      // que el modelo haya muerto. Solo se olvida lo que el SDK declara ausente.
      if (!isStaleModelError(e)) continue
      console.error(`[qvac] ${k} ya no existe en el worker; el semáforo lo refleja`)
      forget(k)
      perdido = true
    }
  }
  if (perdido) recalentar(customerNames)
  return getModelStatus()
}

/** Cuánto se espera un latido antes de darlo por no contestado. */
const MS_LATIDO = 4000

/**
 * Tres respuestas posibles, y la del medio es la que importa: un latido que
 * tarda demasiado significa "no puedo afirmarlo", nunca "está muerto". Declarar
 * la muerte por un silencio es cambiar un semáforo que miente en verde por uno
 * que miente en gris.
 */
async function latir(): Promise<'vivo' | 'muerto' | 'mudo'> {
  let temporizador: NodeJS.Timeout | undefined
  const reloj = new Promise<'mudo'>((resolve) => {
    temporizador = setTimeout(() => resolve('mudo'), MS_LATIDO)
  })
  try {
    return await Promise.race([sdk.heartbeat().then((): 'vivo' => 'vivo'), reloj])
  } catch {
    return 'muerto'
  } finally {
    if (temporizador) clearTimeout(temporizador)
  }
}

let recalentando = false

/**
 * Vuelve a cargar en segundo plano lo que se perdió, uno a la vez.
 *
 * Sin esto el semáforo sería honesto pero inútil: las luces se apagarían y ahí
 * se quedarían hasta que alguien intentara dictar. Si la recarga vuelve a
 * fallar, ningún modelo queda en `ready`, `verifyStatus` deja de preguntar y no
 * hay bucle.
 */
function recalentar(customerNames: () => Promise<string[]>): void {
  if (recalentando) return
  recalentando = true
  void customerNames()
    .then((names) => warmup(names))
    .catch((e) => console.error('[qvac] no se pudo recalentar tras perder el worker', e))
    .finally(() => {
      recalentando = false
    })
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
