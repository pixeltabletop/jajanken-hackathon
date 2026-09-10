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
  required: ['lugares', 'm', 'b', 'amin', 'amax', 's', 'c', 'i', 'g'],
  properties: {
    lugares: { type: 'array', maxItems: 4, items: { type: 'string' } },
    m: { type: 'array', maxItems: 4, items: { type: 'integer', minimum: 0, maximum: MODALITIES.length - 1 } },
    b: { type: 'array', maxItems: 4, items: { type: 'integer', minimum: 0, maximum: BRANDS.length - 1 } },
    amin: { type: ['number', 'null'] },
    amax: { type: ['number', 'null'] },
    s: { type: 'array', maxItems: 4, items: { type: 'integer', minimum: 0, maximum: STATUSES.length - 1 } },
    c: { type: 'array', maxItems: 3, items: { type: 'integer', minimum: 0, maximum: CONFIDENCE.length - 1 } },
    i: { type: 'integer', minimum: 0, maximum: 2 },
    g: { type: 'integer', minimum: -1, maximum: 7 }
  }
} as const

const CompactPlan = z.object({
  lugares: z.array(z.string()).max(4),
  m: z.array(z.number().int().min(0).max(MODALITIES.length - 1)).max(4),
  b: z.array(z.number().int().min(0).max(BRANDS.length - 1)).max(4),
  amin: z.number().nullable(),
  amax: z.number().nullable(),
  s: z.array(z.number().int().min(0).max(STATUSES.length - 1)).max(4),
  c: z.array(z.number().int().min(0).max(CONFIDENCE.length - 1)).max(3),
  i: z.number().int().min(0).max(2),
  g: z.number().int().min(-1).max(7)
})

const clampAge = (v: number | null): number | null =>
  v === null || !Number.isFinite(v) || v < 0 || v > 60 ? null : Math.round(v)

const uniq = <T>(xs: T[]): T[] => [...new Set(xs)]

/** Ninguno, uno o varios: así lo espera QueryFilter. */
const one = <T>(xs: T[]): T | T[] | null => (xs.length === 0 ? null : xs.length === 1 ? xs[0] : xs)

/**
 * Frases que piden un desglose, con la dimensión por la que se pide. Es una
 * regla determinista ENCIMA del modelo: "qué marcas hay en Ciudad de Panamá" le
 * salía como lista una y otra vez, y ninguna redacción del prompt lo arregló.
 * El modelo propone, el código decide, igual que con el lugar.
 */
const DESGLOSE: Array<[RegExp, Exclude<GroupBy, null>]> = [
  [/\b(cu[aá]l|qu[eé])\s+es\s+el\s+(estatus|estado)\b/i, 'status'],
  [/\bqu[eé]\s+(marcas|fabricantes)\b/i, 'brand'],
  [/\bqu[eé]\s+(modalidades|tipos de equipo)\b/i, 'modality'],
  [/\bqu[eé]\s+pa[ií]ses\b/i, 'country'],
  [/\bqu[eé]\s+ciudades\b/i, 'city'],
  [/\bqu[eé]\s+(sitios|hospitales|clientes)\b/i, 'facility'],
  [/\b(distribuci[oó]n|reparto|se reparte)\b[^.]*\bpor\s+pa[ií]s/i, 'country'],
  [/\b(distribuci[oó]n|reparto|se reparte)\b[^.]*\bpor\s+ciudad/i, 'city'],
  [/\b(distribuci[oó]n|reparto|se reparte)\b[^.]*\bpor\s+modalidad/i, 'modality'],
  [/\b(distribuci[oó]n|reparto|se reparte)\b[^.]*\bpor\s+marca/i, 'brand'],
  [/\b(distribuci[oó]n|reparto|se reparte)\b[^.]*\bpor\s+(estado|estatus)/i, 'status'],
  [/\b(distribuci[oó]n|reparto|se reparte)\b[^.]*\bpor\s+confianza/i, 'confidence'],
  [/\b(distribuci[oó]n|reparto|se reparte)\b[^.]*\bpor\s+antig/i, 'ageBand'],
  // El brief de Philips esta escrito en ingles y sus ejemplos de consulta
  // tambien. Un juez va a teclear la frase de su propio documento.
  [/\b(what|which)\s+(brands|manufacturers)\b/i, 'brand'],
  [/\b(what|which)\s+(modalities|equipment types)\b/i, 'modality'],
  [/\b(what|which)\s+countries\b/i, 'country'],
  [/\b(what|which)\s+cities\b/i, 'city'],
  [/\b(status|state)\s+of\s+(the\s+)?(equipment|units|systems)\b/i, 'status'],
  [/\b(breakdown|distribution)\b[^.]*\bby\s+countr/i, 'country'],
  [/\b(breakdown|distribution)\b[^.]*\bby\s+cit/i, 'city'],
  [/\b(breakdown|distribution)\b[^.]*\bby\s+modalit/i, 'modality'],
  [/\b(breakdown|distribution)\b[^.]*\bby\s+brand/i, 'brand'],
  [/\b(breakdown|distribution)\b[^.]*\bby\s+status/i, 'status'],
  [/\b(breakdown|distribution)\b[^.]*\bby\s+confidence/i, 'confidence'],
  [/\b(breakdown|distribution)\b[^.]*\bby\s+age/i, 'ageBand']
]

/**
 * "estimated to be around eight years old" habla de la EDAD, no del estado
 * Estimated del catalogo. El ejemplo de consulta que trae el propio brief de
 * Philips cae justo en esa trampa, asi que se desarma en codigo: si la frase
 * usa "estimated" pegado a una edad, el estado no cuenta como pedido.
 */
const EDAD_ESTIMADA = /\bestimated\b[^.]{0,24}\b(years?|age|old)\b|\b(years?|age|old)\b[^.]{0,24}\bestimated\b/i

/** La dimensión de desglose que pide la frase, o null si no pide ninguna. */
export function desgloseDe(question: string): Exclude<GroupBy, null> | null {
  for (const [re, dim] of DESGLOSE) if (re.test(question)) return dim
  return null
}

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
export function resolvePlan(raw: unknown, ctx: QueryContext, question = ''): { plan: QueryPlan; warnings: string[] } {
  const p = CompactPlan.parse(raw)
  const warnings: string[] = []

  // Cada lugar de la pregunta se clasifica por separado y contra el catálogo.
  // Así "de Panamá, en San Francisco" da país + sitio, en vez de una sola cadena
  // pegada que no es ninguna de las dos cosas.
  const countries: string[] = []
  const cities: string[] = []
  const sites: string[] = []
  for (const raw of p.lugares) {
    const place = resolvePlace(raw, ctx)
    if (place.kind === 'country' && place.value) countries.push(place.value)
    else if (place.kind === 'city' && place.value) cities.push(place.value)
    else if (place.kind === 'site' && place.value) {
      sites.push(place.value)
      warnings.push(`"${place.value}" no es un país ni una ciudad de la base: se busca como sitio`)
    }
  }
  if (sites.length > 1) warnings.push('Solo se puede buscar un sitio por consulta; se usa el primero')

  let minAgeYears = clampAge(p.amin)
  let maxAgeYears = clampAge(p.amax)
  if (minAgeYears !== null && maxAgeYears !== null && minAgeYears > maxAgeYears) {
    warnings.push('Rango de edad invertido, se conserva solo el mínimo')
    maxAgeYears = null
  }

  let intent = INTENTS[p.i] ?? 'list'
  let groupBy: GroupBy = p.g >= 0 ? (GROUPS[p.g] ?? null) : null

  // La frase manda sobre el modelo cuando pide un desglose sin lugar a dudas.
  // El estado "Estimated" solo cuenta si la pregunta habla del estado, no de
  // una edad estimada.
  const estadoPorEdad = EDAD_ESTIMADA.test(question)
  const estados = uniq(p.s)
    .map((i) => STATUSES[i])
    .filter((v) => !(estadoPorEdad && v === 'Estimated'))
  if (estadoPorEdad && uniq(p.s).map((i) => STATUSES[i]).includes('Estimated')) {
    warnings.push('"estimated" aquí describe la edad, no el estado: no se filtra por estado')
  }

  const pedido = desgloseDe(question)
  if (pedido) {
    if (intent !== 'breakdown' || groupBy !== pedido) {
      warnings.push(`La pregunta pide un desglose por ${pedido}: se responde así`)
    }
    intent = 'breakdown'
    groupBy = pedido
  }

  if (intent === 'breakdown' && groupBy === null) {
    warnings.push('Desglose sin grupo: se responde como lista')
    intent = 'list'
  }
  if (intent !== 'breakdown' && groupBy !== null) groupBy = null

  return {
    plan: {
      filter: {
        ...EMPTY_FILTER,
        country: one(countries),
        city: one(cities),
        modality: one(uniq(p.m).map((i) => MODALITIES[i])),
        brand: one(uniq(p.b).map((i) => BRANDS[i])),
        minAgeYears,
        maxAgeYears,
        status: one(estados),
        confidence: one(uniq(p.c).map((i) => CONFIDENCE[i])),
        textSearch: sites[0] ?? null
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
  const { plan, warnings } = resolvePlan(raw, ctx, question)
  return { plan, ms, warnings, stats: pickStats(fin as { stats?: Record<string, unknown> }), raw }
}
