import type { JSX } from 'react'
import { COLUMN_BY_KEY, type ColumnKey } from '../../../shared/columns.ts'
import type { Observation } from '../../../shared/types.ts'
import type { EquipmentRowView } from '../lib/filter.ts'
import { HelpTip } from './HelpTip.tsx'

interface Props {
  rows: EquipmentRowView[]
  columns: ColumnKey[]
  onEdit: (o: Observation) => void
  editingId: string | null
}

export function DataTable({ rows, columns, onEdit, editingId }: Props): JSX.Element {
  if (!rows.length) return <p className="empty">No hay equipos para este filtro. Prueba a limpiar los filtros o a ampliar el rango de edad.</p>
  const cols = columns.map((k) => COLUMN_BY_KEY[k]).filter(Boolean)
  const sorted = [...rows].sort((a, b) => b.obs.createdAt.localeCompare(a.obs.createdAt) || a.site.localeCompare(b.site))
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Base instalada, una fila por equipo observado</caption>
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} scope="col" className={c.numeric ? 'num' : undefined}>
                {c.label}{c.help && <HelpTip termKey={c.help} align={c.numeric ? 'right' : 'left'} />}
              </th>
            ))}
            <th scope="col"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ key, obs, eq }) => (
            <tr key={key} className={editingId === obs.id ? 'editing' : undefined}>
              {cols.map((c) => {
                const v = c.text(obs, eq)
                if (c.key === 'confidence') return <td key={c.key}><span className={`badge ${eq.confidence.toLowerCase()}`}>{v}</span></td>
                if (c.key === 'brand' && eq.brand === null) return <td key={c.key}><span className="muted">{v}</span></td>
                if (c.key === 'rawText' || c.key === 'evidence' || c.key === 'notes') return <td key={c.key} className="cell-long" title={v}>{v}</td>
                return <td key={c.key} className={c.numeric ? 'num' : undefined}>{v}</td>
              })}
              <td>
                <span className="row-actions">
                  {(obs.history?.length ?? 0) > 0 && (
                    <span className="badge neutral" title={`${obs.history?.length} corrección(es)`}>{obs.history?.length}✎</span>
                  )}
                  <button type="button" className="ghost small" onClick={() => onEdit(obs)} aria-label={`Corregir la observación de ${obs.facilityCanonical ?? obs.facility} del ${obs.createdAt}`}>
                    Corregir
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
