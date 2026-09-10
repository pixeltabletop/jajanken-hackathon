// Medición de tiempos de cada proceso. Promedios reales de esta computadora,
// no estimaciones: la app los acumula en userData/timings.json y los muestra.

export type TimingKey =
  | 'load:gemma'
  | 'load:whisper'
  | 'load:embed'
  | 'load:all'
  | 'transcribe'
  | 'extract'
  | 'dedup'
  | 'save'
  | 'query'

export interface TimingStat {
  count: number
  lastMs: number
  avgMs: number
  minMs: number
  maxMs: number
  /** Primera medición de la sesión: en los modelos es la carga en frío. */
  firstMs: number
}

export type TimingTable = Partial<Record<TimingKey, TimingStat>>

export const TIMING_LABEL: Record<TimingKey, string> = {
  'load:gemma': 'Cargar extracción (Gemma 2B)',
  'load:whisper': 'Cargar voz (Whisper Base)',
  'load:embed': 'Cargar deduplicación (EmbeddingGemma)',
  'load:all': 'Arranque completo, los tres en paralelo',
  transcribe: 'Transcribir el dictado',
  extract: 'Interpretar la nota',
  dedup: 'Buscar el cliente en la base',
  save: 'Guardar',
  query: 'Interpretar la pregunta'
}

/** Qué se le promete al usuario mientras espera, en segundos. */
export const TIMING_HINT: Record<TimingKey, string> = {
  'load:gemma': 'Es el más pesado: 3.4 GB a memoria',
  'load:whisper': 'Ligero, suele estar listo primero',
  'load:embed': 'Ligero',
  'load:all': 'Solo la primera vez que abres la app',
  transcribe: 'Depende de cuánto hables',
  extract: 'Lo más lento del ciclo, es el modelo escribiendo',
  dedup: 'Casi instantáneo con el modelo caliente',
  save: 'Escritura local en disco',
  query: 'Solo traduce la pregunta a un filtro; las cifras las calcula el código'
}

export function record(table: TimingTable, key: TimingKey, ms: number): TimingTable {
  const prev = table[key]
  const next: TimingStat = prev
    ? {
        count: prev.count + 1,
        lastMs: ms,
        avgMs: Math.round((prev.avgMs * prev.count + ms) / (prev.count + 1)),
        minMs: Math.min(prev.minMs, ms),
        maxMs: Math.max(prev.maxMs, ms),
        firstMs: prev.firstMs
      }
    : { count: 1, lastMs: ms, avgMs: ms, minMs: ms, maxMs: ms, firstMs: ms }
  return { ...table, [key]: next }
}

export function fmt(ms: number | undefined): string {
  if (ms === undefined) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`
  return `${Math.floor(ms / 60000)} min ${Math.round((ms % 60000) / 1000)} s`
}
