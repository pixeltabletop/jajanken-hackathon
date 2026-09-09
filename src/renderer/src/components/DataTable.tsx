import type { JSX } from 'react'
import { CONFIDENCE_LABEL_ES, MODALITY_LABEL_ES, STATUS_LABEL_ES } from '../../../shared/catalog.ts'
import type { EquipmentRowView } from '../lib/filter.ts'
import { countryLabel } from '../lib/labels.ts'

const AGE_WORD_ES: Record<string, string> = { new: 'nuevo', recent: 'reciente', old: 'viejo', 'very old': 'muy viejo' }

export function DataTable({ rows }: { rows: EquipmentRowView[] }): JSX.Element {
  if (!rows.length) return <p className="empty">No hay equipos para este filtro.</p>
  const sorted = [...rows].sort((a, b) => b.obs.createdAt.localeCompare(a.obs.createdAt) || a.site.localeCompare(b.site))
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Base instalada, una fila por equipo observado</caption>
        <thead>
          <tr>
            <th scope="col">Cliente</th>
            <th scope="col">Ubicación</th>
            <th scope="col">Modalidad</th>
            <th scope="col" className="num">Cant.</th>
            <th scope="col">Marca</th>
            <th scope="col" className="num">Edad</th>
            <th scope="col">Confianza</th>
            <th scope="col">Estado</th>
            <th scope="col">Visto</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ key, obs, eq, site }) => (
            <tr key={key} title={eq.evidence}>
              <td>{site}</td>
              <td>{[obs.city, countryLabel(obs.country)].filter((x) => x && x !== '—').join(', ') || '—'}</td>
              <td>{MODALITY_LABEL_ES[eq.modality]}</td>
              <td className="num">{eq.quantityIsEstimate ? '~' : ''}{eq.quantity}</td>
              <td>{eq.brand ?? <span className="muted">Desconocida</span>}</td>
              <td className="num">{eq.approxAgeYears !== null ? `${eq.approxAgeYears} a` : eq.ageQualitative ? <span className="muted">{AGE_WORD_ES[eq.ageQualitative] ?? eq.ageQualitative}</span> : '—'}</td>
              <td><span className={`badge ${eq.confidence.toLowerCase()}`}>{CONFIDENCE_LABEL_ES[eq.confidence]}</span></td>
              <td>{STATUS_LABEL_ES[eq.status]}</td>
              <td className="muted">{obs.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
