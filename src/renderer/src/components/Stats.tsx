import type { JSX } from 'react'
import type { EquipmentRowView } from '../lib/filter.ts'

export function Stats({ rows, total }: { rows: EquipmentRowView[]; total: number }): JSX.Element {
  const obsIds = new Set(rows.map((r) => r.obs.id))
  const sites = new Set(rows.map((r) => r.site))
  const old = rows.reduce((s, r) => s + ((r.eq.approxAgeYears ?? 0) >= 7 ? r.eq.quantity : 0), 0)
  const low = rows.filter((r) => r.eq.confidence === 'Low' || r.eq.evidenceInvalid).length
  return (
    <section className="stats" aria-label="Resumen de la base instalada">
      <article>Observaciones <strong>{obsIds.size}{obsIds.size !== total ? <span className="muted"> / {total}</span> : null}</strong></article>
      <article>Clientes <strong>{sites.size}</strong></article>
      <article>Equipos de 7+ años <strong>{old}</strong></article>
      <article>Filas con baja confianza <strong>{low}</strong></article>
    </section>
  )
}
