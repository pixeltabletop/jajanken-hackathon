// Los cuatro números del filtro activo. Contar equipos no es contar filas ni
// contar sitios, así que los tres se muestran por separado y con su explicación.
//
// Ninguna fila se descarta en silencio: si el filtro dejó fuera registros por un
// campo vacío, aparece el total "sin dato" debajo.

import type { JSX } from 'react'
import { missingLabel, type QueryResult } from '../../../shared/query-engine.ts'
import { HelpTip } from './HelpTip.tsx'

export function KpiRow({ r }: { r: QueryResult }): JSX.Element {
  const cards = [
    { label: 'Equipos', value: r.equipment, hint: 'Suma de cantidades, no de filas' },
    { label: 'Sitios', value: r.sites, hint: 'Clientes distintos dentro del filtro' },
    { label: 'Observaciones', value: r.observations, hint: 'Visitas que sostienen estas filas' },
    { label: 'Filas de baja confianza', value: r.lowConfidence, key: 'bajaConfianza' as const }
  ]
  return (
    <>
      <section className="stats" aria-label="Cifras del filtro activo">
        {cards.map((c) => (
          <article key={c.label}>
            <span className="stat-label">
              {c.label}
              {c.key ? <HelpTip termKey={c.key} /> : null}
            </span>
            <strong>{c.value}</strong>
            {c.hint && <span className="kpi-hint muted">{c.hint}</span>}
          </article>
        ))}
      </section>
      {r.missing.length > 0 && (
        <p className="kpi-missing" aria-live="polite">
          Fuera del filtro por falta de dato:{' '}
          {r.missing.map((m) => `${m.rows} fila${m.rows === 1 ? '' : 's'} ${missingLabel(m.field)} (${m.equipment} equipos)`).join(' · ')}.
          No se descartan en silencio: siguen en la base y se pueden completar desde Registrar.
        </p>
      )}
    </>
  )
}
