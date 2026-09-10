// Tipos de reporte y el diff que alimenta el historial de cambios.

import { countryLabel, type ColumnKey } from './columns.ts'
import { CONFIDENCE_LABEL_ES, MODALITY_LABEL_ES, STATUS_LABEL_ES } from './catalog.ts'
import type { GroupBy, QueryIntent } from './query-engine.ts'
import type { Equipment, Observation, QueryFilter } from './types.ts'

export type ReportKind = 'inventario' | 'cliente' | 'validacion' | 'cambios' | 'resumen' | 'consulta'

export interface ReportDef {
  kind: ReportKind
  title: string
  description: string
  /** Qué contesta este reporte, para el encabezado del PDF. */
  purpose: string
}

export const REPORTS: ReportDef[] = [
  {
    kind: 'inventario',
    title: 'Inventario de base instalada',
    description: 'La tabla tal como la tienes filtrada, con las columnas que elegiste.',
    purpose: 'Qué equipo hay y dónde'
  },
  {
    kind: 'cliente',
    title: 'Ficha de cliente',
    description: 'Un solo cliente: sus equipos, cada visita registrada y el historial de cambios.',
    purpose: 'Todo lo que sabemos de un cliente'
  },
  {
    kind: 'validacion',
    title: 'Pendiente de validar',
    description: 'Filas con confianza baja, estado sin confirmar o datos que faltan. Es la cola de trabajo.',
    purpose: 'Qué hay que verificar antes de usarlo para decidir'
  },
  {
    kind: 'cambios',
    title: 'Historial de cambios',
    description: 'Qué se corrigió, cuándo y quién. Solo aparecen las observaciones que se editaron.',
    purpose: 'Trazabilidad de las correcciones'
  },
  {
    kind: 'consulta',
    title: 'Respuesta a una consulta',
    description: 'La pregunta tal como se hizo, qué entendió la app, la respuesta redactada y la tabla que la sostiene.',
    purpose: 'Qué se preguntó y qué contestaron los registros'
  },
  {
    kind: 'resumen',
    title: 'Resumen ejecutivo',
    description: 'Agregados por país, modalidad y antigüedad, con las oportunidades de renovación.',
    purpose: 'La foto del parque instalado en una página'
  }
]

export const REPORT_BY_KIND: Record<ReportKind, ReportDef> = Object.fromEntries(REPORTS.map((r) => [r.kind, r])) as Record<ReportKind, ReportDef>

export interface ReportRequest {
  kind: ReportKind
  /** Quién lo pide, va en el encabezado del PDF. */
  requestedBy: string
  filter: QueryFilter
  columns: ColumnKey[]
  /** Para la ficha de cliente. */
  facility?: string
  /** Texto libre del usuario que se imprime bajo el título. */
  note?: string
  /** Solo para el reporte de consulta: la pregunta tal como se escribió. */
  question?: string
  /**
   * Intención y agrupación del plan. La frase redactada y el desglose NO viajan
   * en la petición: los recalcula el generador con el mismo motor que la
   * pantalla. Si viajaran como texto, un PDF podría contradecir a su propia
   * tabla cuando el filtro cambia entre que se lee la frase y se pulsa el botón.
   */
  intent?: QueryIntent
  groupBy?: GroupBy
}

// ---------------------------------------------------------------------------
// Diff entre dos versiones de una observación, en lenguaje llano.

function equipLabel(e: Equipment): string {
  return `${MODALITY_LABEL_ES[e.modality]}${e.brand ? ` ${e.brand}` : ''}`
}

function describeEquip(a: Equipment, b: Equipment): string[] {
  const out: string[] = []
  const L = equipLabel(b)
  if (a.quantity !== b.quantity) out.push(`${L}: cantidad ${a.quantity} → ${b.quantity}`)
  if (a.quantityIsEstimate !== b.quantityIsEstimate) out.push(`${L}: cantidad ${b.quantityIsEstimate ? 'pasa a aproximada' : 'deja de ser aproximada'}`)
  if (a.brand !== b.brand) out.push(`${MODALITY_LABEL_ES[b.modality]}: marca ${a.brand ?? 'desconocida'} → ${b.brand ?? 'desconocida'}`)
  if (a.model !== b.model) out.push(`${L}: modelo ${a.model ?? '—'} → ${b.model ?? '—'}`)
  if (a.approxAgeYears !== b.approxAgeYears) out.push(`${L}: edad ${a.approxAgeYears ?? '—'} → ${b.approxAgeYears ?? '—'} años`)
  if (a.confidence !== b.confidence) out.push(`${L}: confianza ${CONFIDENCE_LABEL_ES[a.confidence]} → ${CONFIDENCE_LABEL_ES[b.confidence]}`)
  if (a.status !== b.status) out.push(`${L}: estado ${STATUS_LABEL_ES[a.status]} → ${STATUS_LABEL_ES[b.status]}`)
  if (a.notes !== b.notes) out.push(`${L}: notas actualizadas`)
  return out
}

/** Lista legible de qué cambió entre dos versiones. Vacía si no cambió nada. */
export function diffObservation(before: Observation, after: Observation): string[] {
  const out: string[] = []
  if (before.facility !== after.facility) out.push(`Cliente: "${before.facility}" → "${after.facility}"`)
  if ((before.facilityCanonical ?? '') !== (after.facilityCanonical ?? '')) out.push(`Cliente canónico: ${before.facilityCanonical ?? '—'} → ${after.facilityCanonical ?? '—'}`)
  if (before.city !== after.city) out.push(`Ciudad: ${before.city ?? '—'} → ${after.city ?? '—'}`)
  if (before.country !== after.country) out.push(`País: ${countryLabel(before.country)} → ${countryLabel(after.country)}`)
  if (before.createdAt !== after.createdAt) out.push(`Fecha de visita: ${before.createdAt} → ${after.createdAt}`)
  if (before.observer !== after.observer) out.push(`Observador: ${before.observer} → ${after.observer}`)
  if ((before.followUpAnswer ?? '') !== (after.followUpAnswer ?? '')) out.push('Respuesta del técnico actualizada')

  // Los equipos se emparejan por posición, que es como los edita la interfaz.
  const n = Math.max(before.equipment.length, after.equipment.length)
  for (let i = 0; i < n; i++) {
    const a = before.equipment[i]
    const b = after.equipment[i]
    if (a && !b) out.push(`Se quitó ${equipLabel(a)} (${a.quantity} unidades)`)
    else if (!a && b) out.push(`Se añadió ${equipLabel(b)} (${b.quantity} unidades)`)
    else if (a && b) out.push(...describeEquip(a, b))
  }
  return out
}
