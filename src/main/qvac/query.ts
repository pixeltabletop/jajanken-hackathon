// Interpretación de la pregunta en español. El modelo devuelve un plan con
// índices cerrados; este archivo lo resuelve contra el catálogo y lo valida.
//
// Lo que el modelo NO hace: contar, promediar, agrupar, nombrar un hospital.
// Eso es src/shared/query-engine.ts, código determinista sobre los registros.
//
// Misma configuración medida que la extracción: json_schema, temp 0, seed 42,
// ctx 4096, sin caché de contexto.

import * as sdk from '@qvac/sdk'
import { z } from 'zod'
import { BRANDS, CONFIDENCE, MODALITIES, STATUSES } from '../../shared/catalog.ts'
import { COUNTRY_ES, EMPTY_FILTER, norm, type GroupBy, type QueryIntent, type QueryPlan } from '../../shared/query-engine.ts'
import type { InferenceStats } from '../../shared/types.ts'
import { PROMPT_QUERY_ES } from './prompts.ts'

export const INTENTS: QueryIntent[] = ['list', 'count', 'breakdown']
export const GROUPS: Array<Exclude<GroupBy, null>> = [
  'country',
  'city',
  'facility',
  'modality',
  'brand',
  'status',
  'confidence',
  'ageBand'
]

/** Listas cerradas con las que se construye el prompt y se resuelven los índices. */
export interface QueryContext {
  /** Países canónicos ya presentes en la base, en inglés. */
  countries: string[]
  /** Ciudades ya registradas. */
  cities: string[]
}

export const QUERY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lugar', 'm', 'b', 'amin', 'amax', 's', 'c', 'i', 'g'],
  properties: {
    lugar: { type: ['string', 'null'] },
    m: { type: 'integer', minimum: -1, maximum: MODALITIES.length - 1 },
    b: { type: 'integer', minimum: -1, maximum: BRANDS.length - 1 },
    amin: { type: ['number', 'null'] },
    amax: { type: ['number', 'null'] },
    s: { type: 'integer', minimum: -1, maximum: STATUSES.length - 1 },
    c: { type: 'integer', minimum: -1, maximum: CONFIDENCE.length - 1 },
    i: { type: 'integer', minimum: 0, maximum: 2 },
    g: { type: 'integer', minimum: -1, maximum: 7 }
  }
} as const

const CompactPlan = z.object({
  lugar: z.string().nullable(),
  m: z.number().int().min(-1).max(MODALITIES.length - 1),
  b: z.number().int().min(-1).max(BRANDS.length - 1),
  amin: z.number().nullable(),
  amax: z.number().nullable(),
  s: z.number().int().min(-1).max(STATUSES.length - 1),
  c: z.number().int().min(-1).max(CONFIDENCE.length - 1),
  i: z.number().int().min(0).max(2),
  g: z.number().int().min(-1).max(7)
})

const at = <T>(arr: readonly T[], i: number): T | null => (i >= 0 && i < arr.length ? arr[i] : null)

const clampAge = (v: number | null): number | null =>
  v === null || !Number.isFinite(v) || v < 0 || v > 60 ? null : Math.round(v)

export type PlaceKind = 'country' | 'city' | 'site' | 'none'

export interface ResolvedPlace {
  kind: PlaceKind
  value: string | null
}

/**
 * Decide si el lugar que nombró la pregunta es un país, una ciudad o un sitio.
 * Lo decide el código, no el modelo: la versión 1 del prompt le pedía elegir la
 * categoría y confundía "Panamá" (país) con "Panama City" (ciudad) y
 * "DemoCare Chiriquí" (sitio) con "Chitré" (ciudad).
 *
 * Orden: país exacto → ciudad exacta → ciudad contenida → sitio (texto libre).
 */
export function resolvePlace(raw: string | null, ctx: QueryContext): ResolvedPlace {
  const q = norm(raw)
  if (!q || q.length < 3) return { kind: 'none', value: null }

  // País: el nombre canónico en inglés o su etiqueta en español.
  for (const c of ctx.countries) {
    if (norm(c) === q || norm(COUNTRY_ES[c] ?? '') === q) return { kind: 'country', value: c }
  }
  // Ciudad exacta, y solo después la contenida: "Ciudad de Panamá" tiene que
  // ganarle a cualquier coincidencia parcial con "Panamá".
  for (const c of ctx.cities) if (norm(c) === q) return { kind: 'city', value: c }
  for (const c of ctx.cities) if (norm(c).includes(q) || q.includes(norm(c))) return { kind: 'city', value: c }

  return { kind: 'site', value: raw!.trim() }
}

/**
 * Resuelve la salida compacta contra el catálogo. Función pura: el banco la
 * ejercita sin cargar el modelo. Un índice fuera de rango se descarta en vez de
 * inventar un valor, y se deja constancia en `warnings`.
 */
export function resolvePlan(raw: unknown, ctx: QueryContext): { plan: QueryPlan; warnings: string[] } {
  const p = CompactPlan.parse(raw)
  const warnings: string[] = []

  const place = resolvePlace(p.lugar, ctx)
  if (place.kind === 'site') warnings.push(`"${place.value}" no es un país ni una ciudad de la base: se busca como sitio`)

  let minAgeYears = clampAge(p.amin)
  let maxAgeYears = clampAge(p.amax)
  if (minAgeYears !== null && maxAgeYears !== null && minAgeYears > maxAgeYears) {
    warnings.push('Rango de edad invertido, se conserva solo el mínimo')
    maxAgeYears = null
  }

  let intent = INTENTS[p.i] ?? 'list'
  let groupBy: GroupBy = p.g >= 0 ? (GROUPS[p.g] ?? null) : null
  if (intent === 'breakdown' && groupBy === null) {
    warnings.push('Desglose sin grupo: se responde como lista')
    intent = 'list'
  }
  if (intent !== 'breakdown' && groupBy !== null) groupBy = null

  return {
    plan: {
      filter: {
        ...EMPTY_FILTER,
        country: place.kind === 'country' ? place.value : null,
        city: place.kind === 'city' ? place.value : null,
        modality: at(MODALITIES, p.m),
        brand: at(BRANDS, p.b),
        minAgeYears,
        maxAgeYears,
        status: at(STATUSES, p.s),
        confidence: at(CONFIDENCE, p.c),
        textSearch: place.kind === 'site' ? place.value : null
      },
      intent,
      groupBy
    },
    warnings
  }
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

export interface QueryParseResult {
  plan: QueryPlan
  ms: number
  warnings: string[]
  stats: InferenceStats
  /** La salida cruda del modelo, para poder auditar el banco. */
  raw: unknown
}

export async function parseQuestion(
  gemmaId: string,
  question: string,
  ctx: QueryContext
): Promise<QueryParseResult> {
  const t0 = Date.now()
  const run = sdk.completion({
    modelId: gemmaId,
    history: [
      { role: 'system', content: PROMPT_QUERY_ES },
      { role: 'user', content: question }
    ],
    stream: true,
    responseFormat: { type: 'json_schema', json_schema: { name: 'plan', schema: QUERY_SCHEMA } },
    generationParams: { temp: 0, seed: 42, top_k: 1, predict: 160 }
  })

  let text = ''
  for await (const ev of run.events) if (ev.type === 'contentDelta') text += ev.text
  const fin = await run.final
  const ms = Date.now() - t0

  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error(`El modelo no devolvió JSON válido tras ${ms} ms`)
  }
  const { plan, warnings } = resolvePlan(raw, ctx)
  return { plan, ms, warnings, stats: pickStats(fin as { stats?: Record<string, unknown> }), raw }
}
