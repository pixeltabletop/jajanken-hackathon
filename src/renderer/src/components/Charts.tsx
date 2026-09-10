// Los tres gráficos de la base registrada, dibujados sin librería.
//
// Antes esto era Recharts: 9 MB en el paquete y unos 400 KB en el bundle del
// renderer para pintar tres gráficos de barras. Se sustituyó por las mismas
// barras que ya usa el modo Seguimiento, que además se leen igual en los dos
// temas y llevan su descripción accesible. Recharts salió de las dependencias.
//
// Aquí las barras NO filtran, a diferencia de las de Seguimiento: este tablero
// es la vista de apoyo del modo Registrar, y consultar es lo que hay detrás de
// la otra puerta.

import type { JSX } from 'react'
import {
  groupHits,
  groupShortLabelOf,
  type EquipmentHit,
  type GroupBy
} from '../../../shared/query-engine.ts'

type Dim = Exclude<GroupBy, null>

const GRAFICOS: Array<{ by: Dim; title: string }> = [
  { by: 'modality', title: 'Equipos por modalidad' },
  { by: 'country', title: 'Equipos por país' },
  { by: 'ageBand', title: 'Equipos por antigüedad' }
]

export function Charts({ rows }: { rows: EquipmentHit[] }): JSX.Element | null {
  if (!rows.length) return null
  return (
    <div className="charts">
      {GRAFICOS.map(({ by, title }) => {
        const grupos = groupHits(rows, by)
        const max = Math.max(1, ...grupos.map((g) => g.equipment))
        return (
          <div className="chart" key={by}>
            <h3>{title}</h3>
            {grupos.length === 0 ? (
              <p className="empty">Sin datos con este filtro.</p>
            ) : (
              <ul
                className="bars"
                role="img"
                aria-label={`${title}: ${grupos.map((g) => `${g.label} ${g.equipment}`).join(', ')}`}
              >
                {grupos.map((g) => (
                  <li key={g.key}>
                    <span className="bar-btn estatico">
                      <span className="bar-label">{g.label === g.key ? groupShortLabelOf(by, g.key) : g.label}</span>
                      <span className="bar-track">
                        <span className="bar-fill" style={{ width: `${Math.round((g.equipment / max) * 100)}%` }} />
                      </span>
                      <span className="bar-value">{g.equipment}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
