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

export interface Observation {
  id: string
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
  reviewed: boolean
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

export interface QueryFilter {
  country: string | null
  city: string | null
  modality: Modality | null
  brand: Brand | null
  minAgeYears: number | null
  maxAgeYears: number | null
  status: Status | null
  confidence: Confidence | null
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
