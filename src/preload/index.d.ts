import type { ReportRequest } from '../shared/reports.ts'
import type { Settings } from '../main/store.ts'
import type { QueryPlan } from '../shared/query-engine.ts'
import type { TimingTable } from '../shared/timings.ts'
import type {
  ApiError,
  DedupResult,
  ExtractResult,
  Language,
  ModelStatus,
  Observation,
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
  settingsGet(): R<Settings>
  settingsSet(patch: Partial<Settings>): R<Settings>
  report(req: ReportRequest, action: 'save' | 'open' | 'mail'): R<{ path: string; action: string }>
  queryParse(question: string): R<{ plan: QueryPlan; ms: number; warnings: string[] }>
}

declare global {
  interface Window {
    api: EcoApi
  }
}
