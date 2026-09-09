import { useMemo, type JSX } from 'react'
import type { ColumnKey } from '../../../shared/columns.ts'
import type { Observation, QueryFilter } from '../../../shared/types.ts'
import { applyFilter, describeFilter, EMPTY_FILTER, flatten, isEmptyFilter } from '../lib/filter.ts'
import { Charts } from './Charts.tsx'
import { DataTable } from './DataTable.tsx'
import { FilterBar } from './FilterBar.tsx'

interface Props {
  observations: Observation[]
  filter: QueryFilter
  onFilter: (f: QueryFilter) => void
  columns: ColumnKey[]
  onColumns: (c: ColumnKey[]) => void
  onEdit: (o: Observation) => void
  editingId: string | null
  /** Ranura para la barra de pregunta en español (Bloque 5). */
  queryBar?: JSX.Element | null
}

export function Dashboard({ observations, filter, onFilter, columns, onColumns, onEdit, editingId, queryBar }: Props): JSX.Element {
  const all = useMemo(() => flatten(observations), [observations])
  const rows = useMemo(() => applyFilter(all, filter), [all, filter])
  const countries = useMemo(() => [...new Set(all.map((r) => r.obs.country).filter((c): c is string => !!c))].sort(), [all])
  const cities = useMemo(() => {
    const pool = filter.country ? all.filter((r) => r.obs.country === filter.country) : all
    return [...new Set(pool.map((r) => r.obs.city).filter((c): c is string => !!c))].sort()
  }, [all, filter.country])
  const chips = describeFilter(filter)

  return (
    <section aria-labelledby="dash-h">
      <div className="filters">
        <h2 id="dash-h">3 · Base instalada local</h2>
      </div>

      {queryBar}

      <FilterBar
        filter={filter} onFilter={onFilter}
        countries={countries} cities={cities}
        columns={columns} onColumns={onColumns}
        shown={rows.length} total={all.length}
      />

      {!isEmptyFilter(filter) && (
        <div className="chips" aria-live="polite">
          Filtro activo: {chips.map((c) => <span key={c} className="chip">{c}</span>)}
          <button type="button" className="ghost small" onClick={() => onFilter(EMPTY_FILTER)}>Limpiar</button>
        </div>
      )}

      <DataTable rows={rows} columns={columns} onEdit={onEdit} editingId={editingId} />
      <Charts rows={rows} />
    </section>
  )
}
