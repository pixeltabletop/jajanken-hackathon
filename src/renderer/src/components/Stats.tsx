import type { JSX } from 'react'
import type { EquipmentRowView } from '../lib/filter.ts'
import { HelpTip } from './HelpTip.tsx'

export function Stats({ rows, total }: { rows: EquipmentRowView[]; total: number }): JSX.Element {
  const obsIds = new Set(rows.map((r) => r.obs.id))
  const sites = new Set(rows.map((r) => r.site))
  const old = rows.reduce((s, r) => s + ((r.eq.approxAgeYears ?? 0) >= 7 ? r.eq.quantity : 0), 0)
  const low = rows.filter((r) => r.eq.confidence === 'Low' || r.eq.evidenceInvalid).length
  const cards = [
    { key: 'observaciones' as const, label: 'Observaciones', value: obsIds.size, of: obsIds.size !== total ? total : null },
    { key: 'clientes' as const, label: 'Clientes', value: sites.size, of: null },
    { key: 'equipos7' as const, label: 'Equipos de 7+ años', value: old, of: null },
    { key: 'bajaConfianza' as const, label: 'Filas con baja confianza', value: low, of: null }
  ]
  return (
    <section className="stats" aria-label="Resumen de la base instalada">
      {cards.map((c) => (
        <article key={c.key}>
          <span className="stat-label">{c.label}<HelpTip termKey={c.key} /></span>
          <strong>{c.value}{c.of !== null && <span className="muted"> / {c.of}</span>}</strong>
        </article>
      ))}
    </section>
  )
}
