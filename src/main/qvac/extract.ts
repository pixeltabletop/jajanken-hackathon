// Extracción con esquema compacto forzado por gramática, resuelto contra el catálogo
// y validado antes de tocar el estado. Portado de bench/bench7.js, que es la evidencia.

import * as sdk from '@qvac/sdk'
import { z } from 'zod'
import {
  AGE_QUALITATIVE,
  BRANDS,
  CONFIDENCE,
  MODALITIES,
  STATUSES
} from '../../shared/catalog.ts'
import type {
  Equipment,
  ExtractResult,
  InferenceStats,
  Language,
  Observation
} from '../../shared/types.ts'
import { PROMPT_EXTRACT_ES } from './prompts.ts'

// Exactamente el esquema medido. Claves de una letra: el modelo genera las claves,
// y "quantity_is_estimate" cuesta cinco tokens por fila donde "e" cuesta uno.
export const COMPACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['f', 'eq'],
  properties: {
    f: { type: 'string' },
    ci: { type: ['string', 'null'] },
    eq: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['m', 'q', 'e', 'b', 'a', 'c', 's', 'ev'],
        properties: {
          m: { type: 'integer', minimum: 0, maximum: MODALITIES.length - 1 },
          q: { type: 'integer', minimum: 1 },
          e: { type: 'boolean' },
          b: { type: 'integer', minimum: -1, maximum: BRANDS.length - 1 },
          a: { type: ['number', 'null'] },
          c: { type: 'integer', minimum: 0, maximum: CONFIDENCE.length - 1 },
          s: { type: 'integer', minimum: 0, maximum: STATUSES.length - 1 },
          ev: { type: 'string' }
        }
      }
    }
  }
} as const

// Validación de la salida cruda del modelo. La gramática garantiza la forma,
// esto garantiza que nada raro pasó por el parseo.
const CompactRow = z.object({
  m: z.number().int().min(0).max(MODALITIES.length - 1),
  q: z.number().int().min(1),
  e: z.boolean(),
  b: z.number().int().min(-1).max(BRANDS.length - 1),
  a: z.number().nullable(),
  c: z.number().int().min(0).max(CONFIDENCE.length - 1),
  s: z.number().int().min(0).max(STATUSES.length - 1),
  ev: z.string()
})
const Compact = z.object({
  f: z.string(),
  ci: z.string().nullable().optional(),
  eq: z.array(CompactRow)
})
export type CompactOutput = z.infer<typeof Compact>

// Misma normalización que el banco: minúsculas, sin acentos, solo alfanumérico.
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function evidenceIsValid(rawText: string, evidence: string): boolean {
  if (!evidence.trim()) return false
  return normalize(rawText).includes(normalize(evidence))
}

const AGE_WORDS: Array<[RegExp, (typeof AGE_QUALITATIVE)[number]]> = [
  [/muy viej|antiqu|catorce|quince|obsolet/i, 'very old'],
  [/viej|antig|con anios|con años/i, 'old'],
  [/recien|reciente|hace poco|nuevo|nueva|nuevos|nuevas/i, 'new']
]

function ageQualitativeFrom(evidence: string): Equipment['ageQualitative'] {
  for (const [re, v] of AGE_WORDS) if (re.test(evidence)) return v
  return null
}

export function newObservationId(): string {
  return `obs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export interface ResolveOptions {
  rawText: string
  language: Language
  createdAt?: string
  observer?: string
  source?: Observation['source']
}

/** Traduce la salida compacta al modelo Observation y valida la evidencia. */
export function resolveCompact(
  raw: unknown,
  opts: ResolveOptions
): { observation: Observation; warnings: string[] } {
  const parsed = Compact.parse(raw)
  const warnings: string[] = []
  const createdAt = opts.createdAt ?? new Date().toISOString().slice(0, 10)
  const year = Number(createdAt.slice(0, 4))

  const equipment: Equipment[] = parsed.eq.map((r, i) => {
    const valid = evidenceIsValid(opts.rawText, r.ev)
    if (!valid) warnings.push(`Fila ${i + 1}: la cita no aparece en la nota, se marca confianza Baja`)
    const age = r.a !== null && Number.isFinite(r.a) ? Math.round(r.a) : null
    return {
      modality: MODALITIES[r.m],
      quantity: r.q,
      quantityIsEstimate: r.e,
      brand: r.b === -1 ? null : BRANDS[r.b],
      model: null,
      approxAgeYears: age,
      ageQualitative: age === null ? ageQualitativeFrom(r.ev) : null,
      installYearEstimate: age !== null ? year - age : null,
      confidence: valid ? CONFIDENCE[r.c] : 'Low',
      status: STATUSES[r.s],
      evidence: r.ev,
      evidenceInvalid: !valid,
      notes: null
    }
  })

  if (equipment.length === 0) warnings.push('El modelo no identificó ningún equipo en la nota')

  const missing = new Set<string>()
  for (const e of equipment) {
    if (e.brand === null) missing.add('brand')
    if (e.model === null) missing.add('model')
    if (e.approxAgeYears === null) missing.add('approxAgeYears')
  }
  if (!parsed.ci) missing.add('city')

  const observation: Observation = {
    id: newObservationId(),
    createdAt,
    observer: opts.observer ?? 'Técnico de campo',
    source: opts.source ?? 'Text',
    language: opts.language,
    rawText: opts.rawText,
    facility: parsed.f.trim(),
    facilityCanonical: null,
    city: parsed.ci?.trim() || null,
    country: null, // se infiere en la capa IPC desde el catálogo de clientes
    equipment,
    missingFields: [...missing],
    reviewed: false
  }
  return { observation, warnings }
}

function pickStats(fin: { stats?: Record<string, unknown> } | undefined): InferenceStats {
  const s = fin?.stats ?? {}
  return {
    ttftMs: typeof s.timeToFirstToken === 'number' ? s.timeToFirstToken : undefined,
    tokensPerSecond: typeof s.tokensPerSecond === 'number' ? s.tokensPerSecond : undefined,
    promptTokens: typeof s.promptTokens === 'number' ? s.promptTokens : undefined,
    generatedTokens: typeof s.generatedTokens === 'number' ? s.generatedTokens : undefined,
    backendDevice: s.backendDevice === 'gpu' || s.backendDevice === 'cpu' ? s.backendDevice : undefined
  }
}

export interface ExtractOptions extends ResolveOptions {
  onToken?: (partial: string) => void
}

/** Corre la extracción. Sin kvCache: cada nota es independiente, una llave compartida desborda. */
export async function extractObservation(gemmaId: string, opts: ExtractOptions): Promise<ExtractResult> {
  const t0 = Date.now()
  const run = sdk.completion({
    modelId: gemmaId,
    history: [
      { role: 'system', content: PROMPT_EXTRACT_ES },
      { role: 'user', content: opts.rawText }
    ],
    stream: true,
    responseFormat: { type: 'json_schema', json_schema: { name: 'obs', schema: COMPACT_SCHEMA } },
    generationParams: { temp: 0, seed: 42, top_k: 1, predict: 600 }
  })

  let text = ''
  for await (const ev of run.events) {
    if (ev.type === 'contentDelta') {
      text += ev.text
      opts.onToken?.(text)
    }
  }
  const fin = await run.final
  const ms = Date.now() - t0

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error(`El modelo no devolvió JSON válido tras ${ms} ms`)
  }
  const { observation, warnings } = resolveCompact(raw, opts)
  return { observation, ms, stats: pickStats(fin as { stats?: Record<string, unknown> }), warnings }
}
