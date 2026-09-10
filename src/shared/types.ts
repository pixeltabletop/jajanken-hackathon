// Tipos compartidos entre main, preload y renderer.
// Una Observation es una visita con N equipos. El modelo plano de v1 no podía
// representar el primer caso oficial de Philips ("dos resonadores y un tomógrafo").

import type { AgeQualitative, Brand, Confidence, Modality, Status } from './catalog.ts'

export type Source = 'Voice' | 'Text' | 'Seed'
export type Language = 'es' | 'en'

export interface Equipment {
  modality: Modality
  quantity: number
  quantityIsEstimate: boolean
  brand: Brand | null
  model: string | null
  approxAgeYears: number | null
  ageQualitative: AgeQualitative | null
  /** Derivado: año de createdAt menos approxAgeYears. No lo extrae el modelo. */
  installYearEstimate: number | null
  confidence: Confidence
  status: Status
  /** Cita textual de rawText. Se valida como substring antes de guardar. */
  evidence: string
  /** true si evidence no se encontró en rawText. La fila se resalta y baja a Low. */
  evidenceInvalid?: boolean
  notes: string | null
}

/** Una versión anterior de la observación, guardada al editarla. */
export interface Revision {
  /** Cuándo se hizo el cambio, no cuándo fue la visita. */
  at: string
  by: string
  /** Descripción legible de qué cambió, calculada al guardar. */
  changes: string[]
  /** La observación tal como estaba antes del cambio. */
  before: Omit<Observation, 'history'>
}

export interface Observation {
  id: string
  /** Fecha de la visita (Visit Date en el workbook de Philips). */
  createdAt: string
  observer: string
  source: Source
  language: Language
  rawText: string
  facility: string
  facilityCanonical: string | null
  city: string | null
  country: string | null
  equipment: Equipment[]
  missingFields: string[]
  /** Respuesta del técnico a la pregunta de seguimiento (columna 18 de Philips). */
  followUpAnswer?: string | null
  reviewed: boolean
  /** Historial de cambios, más reciente primero. Vacío si nunca se editó. */
  history?: Revision[]
}

export interface Customer {
  name: string
  city: string | null
  country: string | null
}

export interface DedupCandidate extends Customer {
  score: number
  sameCity: boolean
}

export interface DedupResult {
  candidates: DedupCandidate[]
  /** Nombre canónico sugerido, o null si parece cliente nuevo. */
  suggestion: string | null
  reason: string
}

/**
 * Un campo del filtro admite un valor, varios o ninguno. Varios significa "o":
 * "confianza baja o media" es `confidence: ['Low', 'Medium']`. La comparación
 * vive en `matches()` de query-engine.ts, para que exista un solo criterio.
 */
export type OneOrMany<T> = T | T[] | null

export interface QueryFilter {
  country: OneOrMany<string>
  city: OneOrMany<string>
  modality: OneOrMany<Modality>
  brand: OneOrMany<Brand>
  minAgeYears: number | null
  maxAgeYears: number | null
  status: OneOrMany<Status>
  confidence: OneOrMany<Confidence>
  textSearch: string | null
}

export type ModelKey = 'gemma' | 'whisper' | 'embed'
export type ModelState = 'idle' | 'loading' | 'ready' | 'error'
export type ModelStatus = Record<ModelKey, { state: ModelState; error?: string; ms?: number }>

export interface InferenceStats {
  ttftMs?: number
  tokensPerSecond?: number
  promptTokens?: number
  generatedTokens?: number
  backendDevice?: 'cpu' | 'gpu'
}

export interface ExtractResult {
  observation: Observation
  ms: number
  stats: InferenceStats
  warnings: string[]
}

export interface TranscribeResult {
  text: string
  ms: number
  /** Términos corregidos contra el catálogo. La interfaz los muestra. */
  fixes: import('./transcript.ts').TranscriptFix[]
  /** Lo que devolvió Whisper antes de corregir, para poder auditar. */
  rawText: string
}

export interface ApiError {
  error: { code: string; message: string }
}
