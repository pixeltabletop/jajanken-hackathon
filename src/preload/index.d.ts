import type { TimingTable } from '../shared/timings.ts'
import type {
  ApiError,
  DedupResult,
  ExtractResult,
  Language,
  ModelStatus,
  Observation,
  QueryFilter,
  Source,
  TranscribeResult
} from '../shared/types.ts'

// Todo handler puede devolver ApiError en vez de lanzar. El renderer lo comprueba con isApiError().
type R<T> = Promise<T | ApiError>

export interface EcoApi {
  modelsStatus(): R<ModelStatus>
  modelsWarmup(): R<ModelStatus>
  timings(): R<TimingTable>
  cities(): R<Record<string, string[]>>
  transcribe(wav: Uint8Array): R<TranscribeResult>
  extract(text: string, language: Language, source?: Extract<Source, 'Voice' | 'Text'>): R<ExtractResult>
  dedup(facility: string, city: string | null): R<DedupResult>
  save(observation: Observation): R<Observation[]>
  list(): R<Observation[]>
  queryParse(question: string): R<{ filter: QueryFilter; ms: number }>
}

declare global {
  interface Window {
    api: EcoApi
  }
}
