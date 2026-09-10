// "Interpretado como: país = Panamá · desglose por estatus". En palabras, no en
// JSON. El usuario ve qué entendió el modelo antes de confiar en la cifra.
//
// Cada parte se quita con un clic, y el chip distingue qué vino de la pregunta
// y qué vino de un clic en un gráfico.

import type { JSX } from 'react'
import {
  describeFilterParts,
  groupByLabel,
  type QueryPlan
} from '../../../shared/query-engine.ts'
import type { QueryFilter } from '../../../shared/types.ts'

export type PartOrigin = 'question' | 'chart' | 'manual'

interface Props {
  plan: QueryPlan
  /** De dónde salió cada campo del filtro. Lo que no está, vino de la pregunta. */
  origin: Partial<Record<keyof QueryFilter, PartOrigin>>
  onRemove: (field: keyof QueryFilter) => void
  onClear: () => void
  /** La pregunta tal como se escribió, si la hubo. */
  question: string | null
}

const ORIGIN_LABEL: Record<PartOrigin, string> = {
  question: 'de la pregunta',
  chart: 'de un clic en el gráfico',
  manual: 'del filtro manual'
}

export function InterpretChip({ plan, origin, onRemove, onClear, question }: Props): JSX.Element | null {
  const parts = describeFilterParts(plan.filter)
  const hasGroup = plan.intent === 'breakdown' && plan.groupBy
  if (!parts.length && !hasGroup) return null

  return (
    <div className="interp" aria-live="polite">
      <span className="interp-title">Interpretado como</span>
      <div className="interp-parts">
        {parts.map((p) => {
          const from = origin[p.field] ?? 'question'
          return (
            <span key={p.field} className={`ichip from-${from}`}>
              <span className="ichip-text">{p.text}</span>
              <span className="ichip-from">{ORIGIN_LABEL[from]}</span>
              <button
                type="button"
                className="ichip-x"
                onClick={() => onRemove(p.field)}
                aria-label={`Quitar ${p.text}`}
                title={`Quitar ${p.text}`}
              >
                ×
              </button>
            </span>
          )
        })}
        {hasGroup && (
          <span className="ichip group">
            <span className="ichip-text">desglose por {groupByLabel(plan.groupBy)}</span>
          </span>
        )}
        {parts.length > 0 && (
          <button type="button" className="ghost small" onClick={onClear}>
            Limpiar filtros ({parts.length})
          </button>
        )}
      </div>
      {question && <p className="interp-q muted">Pregunta: “{question}”</p>}
    </div>
  )
}
