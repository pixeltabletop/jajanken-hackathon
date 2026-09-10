// Gráficos que filtran. Un clic en una barra mete ese valor en el filtro activo
// y todo se recalcula: cifras, tabla, frase redactada, chip y los demás
// gráficos. Un segundo clic lo quita. Es un interruptor, no una selección de una
// sola vía.
//
// Las barras son botones de verdad: alcanzables con Tab, activables con Enter y
// con `aria-pressed`. Se distinguen por más que color: borde de 2 px y etiqueta
// en negrita. El jurado puede estar viendo un proyector malo, y hay daltonismo.
//
// Cada gráfico se calcula contra el conjunto filtrado por TODAS las condiciones
// menos la suya. Así el gráfico donde hiciste clic conserva sus categorías, con
// las no elegidas atenuadas, y no te deja sin camino de vuelta.

import type { JSX } from 'react'
import {
  applyFilter,
  groupHits,
  groupShortLabelOf,
  groupValueActive,
  toggleGroupValue,
  type EquipmentHit,
  type GroupBy
} from '../../../shared/query-engine.ts'
import type { QueryFilter } from '../../../shared/types.ts'

type Dim = Exclude<GroupBy, null>

const CHARTS: Array<{ by: Dim; title: string }> = [
  { by: 'modality', title: 'Equipos por modalidad' },
  { by: 'country', title: 'Equipos por país' },
  { by: 'ageBand', title: 'Equipos por antigüedad' },
  { by: 'status', title: 'Equipos por estatus' },
  { by: 'brand', title: 'Equipos por marca' },
  { by: 'confidence', title: 'Filas por confianza' }
]

/** El filtro sin la dimensión del propio gráfico. */
function without(f: QueryFilter, by: Dim): QueryFilter {
  if (by === 'ageBand') return { ...f, minAgeYears: null, maxAgeYears: null }
  if (by === 'facility') return { ...f, textSearch: null }
  return { ...f, [by]: null }
}

interface Props {
  all: EquipmentHit[]
  filter: QueryFilter
  onFilter: (f: QueryFilter, by: Dim) => void
}

export function ResultCharts({ all, filter, onFilter }: Props): JSX.Element {
  return (
    <div className="charts">
      {CHARTS.map(({ by, title }) => {
        const rows = applyFilter(all, without(filter, by))
        const groups = groupHits(rows, by)
        const max = Math.max(1, ...groups.map((g) => g.equipment))
        const anyActive = groups.some((g) => groupValueActive(filter, by, g.key))
        return (
          <div className="chart" key={by}>
            <h3>{title}</h3>
            {groups.length === 0 ? (
              <p className="empty">Sin datos con este filtro.</p>
            ) : (
              <ul className="bars">
                {groups.map((g) => {
                  const on = groupValueActive(filter, by, g.key)
                  const dim = anyActive && !on
                  const label = g.key === 'Sin dato' ? 'Sin dato' : groupShortLabelOf(by, g.key)
                  return (
                    <li key={g.key}>
                      <button
                        type="button"
                        className={`bar-btn${on ? ' on' : ''}${dim ? ' dim' : ''}`}
                        aria-pressed={on}
                        onClick={() => onFilter(toggleGroupValue(filter, by, g.key), by)}
                        title={`${label}: ${g.equipment} equipos en ${g.sites} sitios${on ? ' · quitar del filtro' : ' · añadir al filtro'}`}
                      >
                        <span className="bar-label">{on && <span aria-hidden="true">✓ </span>}{label}</span>
                        <span className="bar-track">
                          <span className="bar-fill" style={{ width: `${Math.round((g.equipment / max) * 100)}%` }} />
                        </span>
                        <span className="bar-value">{g.equipment}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
