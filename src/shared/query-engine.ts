// Motor de consulta determinista. Funciones puras, sin Electron y sin QVAC, para
// que el banco de mediciones las ejercite desde Node.
//
// REGLA DURA DEL BLOQUE 4B: la respuesta sale exclusivamente de los registros
// guardados. El modelo de lenguaje traduce la pregunta a un QueryPlan y nada más.
// Los conteos, promedios, listados y agrupaciones los calcula este archivo.
// Ninguna cifra de la pantalla la escribe un modelo.

import {
  CONFIDENCE,
  CONFIDENCE_LABEL_ES,
  MODALITIES,
  STATUSES,
  MODALITY_LABEL_ES,
  MODALITY_SHORT_ES,
  STATUS_LABEL_ES,

  type Confidence,
  type Modality,
  type Status
} from './catalog.ts'
import type { Equipment, Observation, OneOrMany, QueryFilter } from './types.ts'

export type QueryIntent = 'list' | 'count' | 'breakdown'
export type GroupBy =
  | 'country'
  | 'city'
  | 'facility'
  | 'modality'
  | 'brand'
  | 'status'
  | 'confidence'
  | 'ageBand'
  | null

export interface QueryPlan {
  filter: QueryFilter
  /** list = enumera filas · count = una cifra · breakdown = desglose por grupo. */
  intent: QueryIntent
  /** Obligatorio cuando intent = 'breakdown', null en los demás. */
  groupBy: GroupBy
}

export const EMPTY_FILTER: QueryFilter = {
  country: null,
  city: null,
  modality: null,
  brand: null,
  minAgeYears: null,
  maxAgeYears: null,
  status: null,
  confidence: null,
  textSearch: null
}


// ---------------------------------------------------------------- etiquetas

// Un solo catálogo de países: el de columns.ts, que ya lo usan tabla y reportes.
export { COUNTRY_ES, countryLabel } from './columns.ts'
import { countryLabel } from './columns.ts'

export const AGE_BANDS = ['0–3 años', '4–7 años', '8+ años', 'Sin dato'] as const
export type AgeBand = (typeof AGE_BANDS)[number]

export function ageBand(a: number | null): AgeBand {
  if (a === null) return 'Sin dato'
  if (a <= 3) return '0–3 años'
  if (a <= 7) return '4–7 años'
  return '8+ años'
}

/** Lista de valores de un campo del filtro, sea uno, varios o ninguno. */
export function listOf<T>(f: OneOrMany<T>): T[] {
  return f === null || f === undefined ? [] : Array.isArray(f) ? f : [f]
}

/** Si el campo filtra algo. Un array vacio no filtra nada. */
export const isSet = <T>(f: OneOrMany<T>): boolean => listOf(f).length > 0

/**
 * Criterio unico de comparacion. Varios valores significan "o": un equipo de
 * confianza media casa con ['Low', 'Medium'].
 */
export function matches<T>(f: OneOrMany<T>, value: T | null, eq: (a: T, b: T) => boolean = (a, b) => a === b): boolean {
  const vals = listOf(f)
  if (!vals.length) return true
  if (value === null) return false
  return vals.some((v) => eq(v, value))
}

export const norm = (s: string | null | undefined): string =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

// ---------------------------------------------------------------- aplanado

/** Una fila por equipo, con su sitio, ciudad, país, cita textual y observación. */
export interface EquipmentHit {
  obs: Observation
  eq: Equipment
  /** Clave estable para React: id de observación más índice del equipo. */
  key: string
  site: string
  city: string | null
  country: string | null
  ageBand: AgeBand
}

export function flatten(observations: Observation[]): EquipmentHit[] {
  return observations.flatMap((obs) =>
    obs.equipment.map((eq, i) => ({
      obs,
      eq,
      key: `${obs.id}-${i}`,
      site: obs.facilityCanonical ?? obs.facility,
      city: obs.city,
      country: obs.country,
      ageBand: ageBand(eq.approxAgeYears)
    }))
  )
}

// ---------------------------------------------------------------- filtrado

/** Campo del filtro que dejó una fila fuera por venir vacía en el registro. */
export type MissingField = 'country' | 'city' | 'brand' | 'age'

export interface FilterAudit {
  kept: EquipmentHit[]
  /**
   * Filas descartadas porque el campo que se filtró viene vacío en el registro.
   * Nunca se descartan en silencio: la pantalla las declara como "sin dato".
   */
  missing: Array<{ field: MissingField; rows: number; equipment: number }>
}

const FIELD_LABEL_ES: Record<MissingField, string> = {
  country: 'sin país registrado',
  city: 'sin ciudad registrada',
  brand: 'sin marca registrada',
  age: 'sin edad registrada'
}

export const missingLabel = (f: MissingField): string => FIELD_LABEL_ES[f]

export function applyFilterAudited(hits: EquipmentHit[], f: QueryFilter): FilterAudit {
  const kept: EquipmentHit[] = []
  const miss = new Map<MissingField, { rows: number; equipment: number }>()
  const note = (field: MissingField, h: EquipmentHit): void => {
    const cur = miss.get(field) ?? { rows: 0, equipment: 0 }
    miss.set(field, { rows: cur.rows + 1, equipment: cur.equipment + h.eq.quantity })
  }

  const igualTexto = (a: string, b: string): boolean => norm(a) === norm(b)
  const contieneTexto = (a: string, b: string): boolean => norm(b).includes(norm(a))

  for (const h of hits) {
    const { obs, eq, site } = h
    // Campos vacíos primero: se cuentan aparte en vez de desaparecer.
    if (isSet(f.country) && !obs.country) { note('country', h); continue }
    if (isSet(f.city) && !obs.city) { note('city', h); continue }
    if (isSet(f.brand) && !eq.brand) { note('brand', h); continue }
    if ((f.minAgeYears !== null || f.maxAgeYears !== null) && eq.approxAgeYears === null) {
      note('age', h); continue
    }

    if (!matches(f.country, obs.country, igualTexto)) continue
    if (!matches(f.city, obs.city, contieneTexto)) continue
    if (!matches(f.modality, eq.modality)) continue
    if (!matches(f.brand, eq.brand)) continue
    if (f.minAgeYears !== null && (eq.approxAgeYears as number) < f.minAgeYears) continue
    if (f.maxAgeYears !== null && (eq.approxAgeYears as number) > f.maxAgeYears) continue
    if (!matches(f.status, eq.status)) continue
    if (!matches(f.confidence, eq.confidence)) continue
    if (f.textSearch) {
      // Búsqueda tolerante solo en el nombre del sitio, más la ciudad para
      // desambiguar. El resto de campos se filtra por catálogo, exacto.
      const hay = norm(`${site} ${obs.facility} ${obs.city ?? ''}`)
      if (!hay.includes(norm(f.textSearch))) continue
    }
    kept.push(h)
  }

  return {
    kept,
    missing: [...miss.entries()].map(([field, v]) => ({ field, ...v })).sort((a, b) => b.rows - a.rows)
  }
}

export function applyFilter(hits: EquipmentHit[], f: QueryFilter): EquipmentHit[] {
  return applyFilterAudited(hits, f).kept
}

export function isEmptyFilter(f: QueryFilter): boolean {
  return countActive(f) === 0
}

export function countActive(f: QueryFilter): number {
  return Object.values(f).filter((v) => (Array.isArray(v) ? v.length > 0 : v !== null)).length
}

// ---------------------------------------------------------------- resumen

export interface GroupCount {
  /** Valor canónico, el que entra al filtro al hacer clic. */
  key: string
  /** Etiqueta en español para la pantalla. */
  label: string
  /** Suma de cantidades. */
  equipment: number
  /** Filas de equipo. */
  rows: number
  /** Sitios distintos. */
  sites: number
}

export interface QueryResult {
  hits: EquipmentHit[]
  intent: QueryIntent
  groupBy: GroupBy
  /** Suma de cantidades. Contar equipos no es contar filas ni contar sitios. */
  equipment: number
  rows: number
  sites: number
  observations: number
  /** Filas con confianza Baja dentro del filtro activo. */
  lowConfidence: number
  /** Filas cuya cantidad viene marcada como estimada. */
  estimated: number
  groups: GroupCount[]
  missing: FilterAudit['missing']
}

const GROUP_LABEL: Record<Exclude<GroupBy, null>, string> = {
  country: 'país',
  city: 'ciudad',
  facility: 'sitio',
  modality: 'modalidad',
  brand: 'marca',
  status: 'estatus',
  confidence: 'confianza',
  ageBand: 'antigüedad'
}

export const groupByLabel = (g: GroupBy): string => (g ? GROUP_LABEL[g] : '')

/** Valor canónico del grupo para una fila. null cuando el registro no lo trae. */
export function groupKeyOf(h: EquipmentHit, by: Exclude<GroupBy, null>): string | null {
  switch (by) {
    case 'country': return h.country
    case 'city': return h.city
    case 'facility': return h.site
    case 'modality': return h.eq.modality
    case 'brand': return h.eq.brand
    case 'status': return h.eq.status
    case 'confidence': return h.eq.confidence
    case 'ageBand': return h.ageBand
  }
}

export function groupLabelOf(by: Exclude<GroupBy, null>, key: string): string {
  switch (by) {
    case 'country': return countryLabel(key)
    case 'modality': return MODALITY_LABEL_ES[key as Modality] ?? key
    case 'status': return STATUS_LABEL_ES[key as Status] ?? key
    case 'confidence': return CONFIDENCE_LABEL_ES[key as Confidence] ?? key
    default: return key
  }
}

/** Etiqueta corta para ejes de gráficos, donde las largas se pisan. */
export function groupShortLabelOf(by: Exclude<GroupBy, null>, key: string): string {
  if (by === 'modality') return MODALITY_SHORT_ES[key as Modality] ?? key
  return groupLabelOf(by, key)
}

export const SIN_DATO = 'Sin dato'

/**
 * Dimensiones con catálogo cerrado: siempre se muestran completas, aunque una
 * categoría esté en cero. Un gráfico de antigüedad con una sola barra no dice
 * nada; con las cuatro bandas se ve dónde está y dónde no está el parque.
 * Las abiertas (país, ciudad, sitio) solo muestran lo que existe: una lista de
 * ciudades con ceros sería ruido.
 */
const ESCALA_FIJA: Partial<Record<Exclude<GroupBy, null>, readonly string[]>> = {
  ageBand: AGE_BANDS,
  confidence: CONFIDENCE,
  status: STATUSES,
  modality: MODALITIES
}

export function groupHits(hits: EquipmentHit[], by: Exclude<GroupBy, null>): GroupCount[] {
  const m = new Map<string, { equipment: number; rows: number; sites: Set<string> }>()
  for (const h of hits) {
    const key = groupKeyOf(h, by) ?? SIN_DATO
    const cur = m.get(key) ?? { equipment: 0, rows: 0, sites: new Set<string>() }
    cur.equipment += h.eq.quantity
    cur.rows += 1
    cur.sites.add(h.site)
    m.set(key, cur)
  }
  const fija = ESCALA_FIJA[by]
  if (fija) for (const k of fija) if (!m.has(k)) m.set(k, { equipment: 0, rows: 0, sites: new Set<string>() })

  const out = [...m.entries()].map(([key, v]) => ({
    key,
    label: key === SIN_DATO ? SIN_DATO : groupLabelOf(by, key),
    equipment: v.equipment,
    rows: v.rows,
    sites: v.sites.size
  }))

  // Con escala fija manda el orden del catálogo, que es el que el usuario ya
  // conoce; sin ella, de mayor a menor.
  if (fija) {
    const orden = new Map(fija.map((k, i) => [k, i]))
    return out.sort((a, b) => (orden.get(a.key) ?? 99) - (orden.get(b.key) ?? 99))
  }
  return out.sort((a, b) => b.equipment - a.equipment || a.label.localeCompare(b.label, 'es'))
}

export function summarize(
  audit: FilterAudit,
  intent: QueryIntent,
  groupBy: GroupBy
): QueryResult {
  const hits = audit.kept
  let equipment = 0
  let lowConfidence = 0
  let estimated = 0
  const sites = new Set<string>()
  const observations = new Set<string>()
  for (const h of hits) {
    equipment += h.eq.quantity
    if (h.eq.confidence === 'Low') lowConfidence += 1
    if (h.eq.quantityIsEstimate) estimated += 1
    sites.add(h.site)
    observations.add(h.obs.id)
  }
  return {
    hits,
    intent,
    groupBy,
    equipment,
    rows: hits.length,
    sites: sites.size,
    observations: observations.size,
    lowConfidence,
    estimated,
    groups: groupBy ? groupHits(hits, groupBy) : [],
    missing: audit.missing
  }
}

/** Atajo: aplana, filtra y resume en un paso. Lo usa el banco de mediciones. */
export function runPlan(observations: Observation[], plan: QueryPlan): QueryResult {
  return summarize(applyFilterAudited(flatten(observations), plan.filter), plan.intent, plan.groupBy)
}

// ---------------------------------------------------------------- en palabras

export interface FilterPart {
  /** Campo del QueryFilter, para poder quitarlo con un clic. */
  field: keyof QueryFilter
  text: string
}

/** El filtro activo en palabras, parte por parte. Alimenta el chip removible. */
export function describeFilterParts(f: QueryFilter): FilterPart[] {
  const out: FilterPart[] = []
  // Varios valores se leen con "o": "confianza: Baja o Media".
  const unir = (vs: string[]): string => (vs.length < 2 ? vs[0] : `${vs.slice(0, -1).join(', ')} o ${vs[vs.length - 1]}`)
  const country = listOf(f.country)
  const city = listOf(f.city)
  const modality = listOf(f.modality)
  const brand = listOf(f.brand)
  if (country.length) out.push({ field: 'country', text: `país: ${unir(country.map(countryLabel))}` })
  if (city.length) out.push({ field: 'city', text: `ciudad: ${unir(city)}` })
  if (modality.length) out.push({ field: 'modality', text: `modalidad: ${unir(modality.map((m) => MODALITY_LABEL_ES[m]))}` })
  if (brand.length) out.push({ field: 'brand', text: `marca: ${unir(brand)}` })
  if (f.minAgeYears !== null && f.maxAgeYears !== null) {
    out.push({ field: 'minAgeYears', text: `edad: ${f.minAgeYears}–${f.maxAgeYears} años` })
  } else if (f.minAgeYears !== null) {
    out.push({ field: 'minAgeYears', text: `edad: ${f.minAgeYears} años o más` })
  } else if (f.maxAgeYears !== null) {
    out.push({ field: 'maxAgeYears', text: `edad: hasta ${f.maxAgeYears} años` })
  }
  const status = listOf(f.status)
  const confidence = listOf(f.confidence)
  if (status.length) out.push({ field: 'status', text: `estatus: ${unir(status.map((v) => STATUS_LABEL_ES[v]))}` })
  if (confidence.length) out.push({ field: 'confidence', text: `confianza: ${unir(confidence.map((v) => CONFIDENCE_LABEL_ES[v]))}` })
  if (f.textSearch) out.push({ field: 'textSearch', text: `texto: "${f.textSearch}"` })
  return out
}

export const describeFilter = (f: QueryFilter): string[] => describeFilterParts(f).map((p) => p.text)

/** Quita una parte del filtro. El rango de edad se quita completo. */
export function withoutField(f: QueryFilter, field: keyof QueryFilter): QueryFilter {
  if (field === 'minAgeYears' || field === 'maxAgeYears') {
    return { ...f, minAgeYears: null, maxAgeYears: null }
  }
  return { ...f, [field]: null }
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/**
 * La frase de respuesta, construida por plantilla a partir de los números ya
 * calculados. Ni una cifra viene del modelo. Si no hay filas, lo dice.
 */
export function redact(plan: QueryPlan, r: QueryResult): string {
  const parts = describeFilterParts(plan.filter)
  const scope = parts.length ? parts.map((p) => p.text).join(' · ') : 'toda la base registrada'

  if (r.rows === 0) {
    return `Ningún registro cumple ese filtro (${scope}). No hay nada que contar.`
  }

  const base = `${plural(r.equipment, 'equipo registrado', 'equipos registrados')} en ${plural(r.sites, 'sitio', 'sitios')}, sobre ${plural(r.observations, 'observación', 'observaciones')}`
  // El alcance ya viene con sus propios dos puntos ("pais: Panama"), asi que
  // encadenarlo con otro daba "Con pais: Panama: 58 equipos...". Entre
  // parentesis, igual que en la frase de "ningun registro" de mas arriba.
  const head = parts.length ? `${base} (${scope}).` : `En toda la base: ${base}.`

  if (plan.intent === 'breakdown' && r.groups.length) {
    const detail = r.groups.map((g) => `${g.label} ${g.equipment}`).join(', ')
    return `${head} Por ${groupByLabel(plan.groupBy)}: ${detail}.`
  }
  if (plan.intent === 'count') {
    const low = r.lowConfidence ? ` ${plural(r.lowConfidence, 'fila es', 'filas son')} de confianza baja.` : ''
    return `${head}${low}`
  }
  const low = r.lowConfidence ? ` ${plural(r.lowConfidence, 'fila', 'filas')} de confianza baja.` : ''
  return `${head} Se enumeran ${plural(r.rows, 'fila de equipo', 'filas de equipo')}.${low}`
}

/** La condición más restrictiva del filtro, para el botón del estado vacío. */
export function mostRestrictive(f: QueryFilter): FilterPart | null {
  const parts = describeFilterParts(f)
  return parts.length ? parts[parts.length - 1] : null
}

/** Alterna un valor de grupo dentro del filtro. Un segundo clic lo quita. */
export function toggleGroupValue(f: QueryFilter, by: Exclude<GroupBy, null>, key: string): QueryFilter {
  if (by === 'ageBand') {
    const same =
      (key === '0–3 años' && f.minAgeYears === null && f.maxAgeYears === 3) ||
      (key === '4–7 años' && f.minAgeYears === 4 && f.maxAgeYears === 7) ||
      (key === '8+ años' && f.minAgeYears === 8 && f.maxAgeYears === null)
    if (same || key === SIN_DATO) return { ...f, minAgeYears: null, maxAgeYears: null }
    if (key === '0–3 años') return { ...f, minAgeYears: null, maxAgeYears: 3 }
    if (key === '4–7 años') return { ...f, minAgeYears: 4, maxAgeYears: 7 }
    return { ...f, minAgeYears: 8, maxAgeYears: null }
  }
  if (key === SIN_DATO) return f
  const field = by === 'facility' ? 'textSearch' : (by as 'country' | 'city' | 'modality' | 'brand' | 'status' | 'confidence')
  if (field === 'textSearch') return { ...f, textSearch: f.textSearch === key ? null : key }
  // Con varios valores activos, el clic quita o anade el suyo sin tocar los demas.
  const vals = listOf(f[field] as OneOrMany<string>)
  const next = vals.includes(key) ? vals.filter((v) => v !== key) : [...vals, key]
  return { ...f, [field]: next.length === 0 ? null : next.length === 1 ? next[0] : next }
}

/** True si ese valor de grupo está activo en el filtro. Para `aria-pressed`. */
export function groupValueActive(f: QueryFilter, by: Exclude<GroupBy, null>, key: string): boolean {
  if (by === 'ageBand') {
    if (key === '0–3 años') return f.minAgeYears === null && f.maxAgeYears === 3
    if (key === '4–7 años') return f.minAgeYears === 4 && f.maxAgeYears === 7
    if (key === '8+ años') return f.minAgeYears === 8 && f.maxAgeYears === null
    return false
  }
  const field = by === 'facility' ? 'textSearch' : by
  return listOf(f[field as keyof QueryFilter] as OneOrMany<string>).includes(key)
}
