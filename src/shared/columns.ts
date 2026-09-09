// Definición única de las columnas. La usan la tabla del tablero, el selector
// de columnas y el generador de reportes, para que nunca diverjan.
//
// Cobertura de las 19 columnas del workbook de Philips:
//   Observation ID → id · Country → country · City → city
//   Customer/Hospital → site · Observer → observer · Visit Date → visitDate
//   Modality → modality · Quantity → quantity · Dummy Brand → brand
//   Dummy Model → model · Approx. Age → age · Est. Installation Year → installYear
//   Confidence → confidence · Status → status · Source → source
//   Voice Input Example → rawText · Agent Follow-up Question → followUpQuestion
//   Follow-up Answer → followUpAnswer · Notes → notes

import { CONFIDENCE_LABEL_ES, MODALITY_LABEL_ES, STATUS_LABEL_ES } from './catalog.ts'
import { FOLLOW_UP_ES } from './catalog.ts'
import type { GLOSSARY } from './glossary.ts'
import type { Equipment, Observation } from './types.ts'

export const COUNTRY_ES: Record<string, string> = {
  Panama: 'Panamá', Brazil: 'Brasil', Mexico: 'México', Peru: 'Perú',
  'Dominican Republic': 'República Dominicana', Chile: 'Chile', Argentina: 'Argentina',
  Colombia: 'Colombia', 'Costa Rica': 'Costa Rica', Ecuador: 'Ecuador'
}
export const countryLabel = (c: string | null | undefined): string => (c ? COUNTRY_ES[c] ?? c : '—')

const AGE_WORD_ES: Record<string, string> = { new: 'nuevo', recent: 'reciente', old: 'viejo', 'very old': 'muy viejo' }
const SOURCE_ES: Record<string, string> = { Voice: 'Voz', Text: 'Texto', Seed: 'Semilla' }

export type ColumnKey =
  | 'site' | 'city' | 'country' | 'modality' | 'quantity' | 'brand' | 'model'
  | 'age' | 'installYear' | 'confidence' | 'status' | 'visitDate' | 'observer'
  | 'source' | 'notes' | 'evidence' | 'rawText' | 'followUpQuestion' | 'followUpAnswer' | 'id'

export interface ColumnDef {
  key: ColumnKey
  label: string
  /** Término del glosario para el globo "?" de la cabecera. */
  help?: keyof typeof GLOSSARY
  numeric?: boolean
  /** Visible por defecto en la tabla. */
  base: boolean
  /** Texto plano, para exportar y para los reportes. */
  text: (o: Observation, e: Equipment) => string
}

export const COLUMNS: ColumnDef[] = [
  { key: 'site', label: 'Cliente', base: true, text: (o) => o.facilityCanonical ?? o.facility },
  { key: 'city', label: 'Ciudad', base: true, text: (o) => o.city ?? '—' },
  { key: 'country', label: 'País', base: true, text: (o) => countryLabel(o.country) },
  { key: 'modality', label: 'Modalidad', base: true, text: (_, e) => MODALITY_LABEL_ES[e.modality] },
  { key: 'quantity', label: 'Cantidad', help: 'cantidadAprox', numeric: true, base: true, text: (_, e) => `${e.quantityIsEstimate ? '~' : ''}${e.quantity}` },
  { key: 'brand', label: 'Marca', help: 'marcaDesconocida', base: true, text: (_, e) => e.brand ?? 'Desconocida' },
  { key: 'model', label: 'Modelo', base: false, text: (_, e) => e.model ?? '—' },
  { key: 'age', label: 'Edad', help: 'edad', numeric: true, base: true, text: (_, e) => e.approxAgeYears !== null ? `${e.approxAgeYears} a` : e.ageQualitative ? (AGE_WORD_ES[e.ageQualitative] ?? e.ageQualitative) : '—' },
  { key: 'installYear', label: 'Año instalación', numeric: true, base: false, text: (_, e) => e.installYearEstimate !== null ? String(e.installYearEstimate) : '—' },
  { key: 'confidence', label: 'Confianza', help: 'confianza', base: true, text: (_, e) => CONFIDENCE_LABEL_ES[e.confidence] },
  { key: 'status', label: 'Estado', help: 'estado', base: true, text: (_, e) => STATUS_LABEL_ES[e.status] },
  { key: 'visitDate', label: 'Fecha de visita', base: true, text: (o) => o.createdAt },
  { key: 'observer', label: 'Observador', base: false, text: (o) => o.observer },
  { key: 'source', label: 'Fuente', base: false, text: (o) => SOURCE_ES[o.source] ?? o.source },
  { key: 'notes', label: 'Notas', base: false, text: (_, e) => e.notes ?? '—' },
  { key: 'evidence', label: 'Evidencia', help: 'evidencia', base: false, text: (_, e) => e.evidence || '—' },
  { key: 'rawText', label: 'Nota original', base: false, text: (o) => o.rawText },
  { key: 'followUpQuestion', label: 'Pregunta pendiente', base: false, text: (o) => { const f = o.missingFields.find((x) => FOLLOW_UP_ES[x]); return f ? FOLLOW_UP_ES[f] : '—' } },
  { key: 'followUpAnswer', label: 'Respuesta del técnico', base: false, text: (o) => o.followUpAnswer ?? '—' },
  { key: 'id', label: 'ID observación', base: false, text: (o) => o.id }
]

export const COLUMN_BY_KEY: Record<ColumnKey, ColumnDef> = Object.fromEntries(COLUMNS.map((c) => [c.key, c])) as Record<ColumnKey, ColumnDef>
export const DEFAULT_COLUMNS: ColumnKey[] = COLUMNS.filter((c) => c.base).map((c) => c.key)
