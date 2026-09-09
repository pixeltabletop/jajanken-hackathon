// Aplana observaciones a filas de equipo y aplica un QueryFilter.
// Lo usan la tabla, los gráficos y las métricas. En el Bloque 5 la pregunta en
// español produce el mismo QueryFilter, así que no hay dos caminos.

import type { Equipment, Observation, QueryFilter } from '../../../shared/types.ts'
import { MODALITY_LABEL_ES, STATUS_LABEL_ES, CONFIDENCE_LABEL_ES } from '../../../shared/catalog.ts'
import { countryLabel } from './labels.ts'

export interface EquipmentRowView {
  obs: Observation
  eq: Equipment
  key: string
  site: string
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

export const norm = (s: string | null | undefined): string =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

export function flatten(observations: Observation[]): EquipmentRowView[] {
  return observations.flatMap((obs) =>
    obs.equipment.map((eq, i) => ({
      obs,
      eq,
      key: `${obs.id}-${i}`,
      site: obs.facilityCanonical ?? obs.facility
    }))
  )
}

export function applyFilter(rows: EquipmentRowView[], f: QueryFilter): EquipmentRowView[] {
  return rows.filter(({ obs, eq, site }) => {
    if (f.country && norm(obs.country) !== norm(f.country)) return false
    if (f.city && !norm(obs.city).includes(norm(f.city))) return false
    if (f.modality && eq.modality !== f.modality) return false
    if (f.brand && eq.brand !== f.brand) return false
    if (f.minAgeYears !== null && (eq.approxAgeYears === null || eq.approxAgeYears < f.minAgeYears)) return false
    if (f.maxAgeYears !== null && (eq.approxAgeYears === null || eq.approxAgeYears > f.maxAgeYears)) return false
    if (f.status && eq.status !== f.status) return false
    if (f.confidence && eq.confidence !== f.confidence) return false
    if (f.textSearch) {
      const hay = norm(`${site} ${obs.facility} ${obs.city ?? ''} ${eq.brand ?? ''} ${eq.model ?? ''} ${obs.rawText}`)
      if (!hay.includes(norm(f.textSearch))) return false
    }
    return true
  })
}

export function isEmptyFilter(f: QueryFilter): boolean {
  return Object.values(f).every((v) => v === null)
}

/** Descripción en palabras del filtro activo, para el chip "Interpretado como". */
export function describeFilter(f: QueryFilter): string[] {
  const out: string[] = []
  if (f.country) out.push(`país: ${countryLabel(f.country)}`)
  if (f.city) out.push(`ciudad: ${f.city}`)
  if (f.modality) out.push(`modalidad: ${MODALITY_LABEL_ES[f.modality]}`)
  if (f.brand) out.push(`marca: ${f.brand}`)
  if (f.minAgeYears !== null && f.maxAgeYears !== null) out.push(`edad: ${f.minAgeYears}–${f.maxAgeYears} años`)
  else if (f.minAgeYears !== null) out.push(`edad: ${f.minAgeYears}+ años`)
  else if (f.maxAgeYears !== null) out.push(`edad: hasta ${f.maxAgeYears} años`)
  if (f.status) out.push(`estado: ${STATUS_LABEL_ES[f.status]}`)
  if (f.confidence) out.push(`confianza: ${CONFIDENCE_LABEL_ES[f.confidence]}`)
  if (f.textSearch) out.push(`texto: "${f.textSearch}"`)
  return out
}
