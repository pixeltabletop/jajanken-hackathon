import { useMemo, type JSX } from 'react'
import type { Observation, QueryFilter } from '../../../shared/types.ts'
import { MODALITIES, MODALITY_LABEL_ES } from '../../../shared/catalog.ts'
import { applyFilter, describeFilter, EMPTY_FILTER, flatten, isEmptyFilter } from '../lib/filter.ts'
import { countryLabel } from '../lib/labels.ts'
import { Charts } from './Charts.tsx'
import { DataTable } from './DataTable.tsx'

interface Props {
  observations: Observation[]
  filter: QueryFilter
  onFilter: (f: QueryFilter) => void
  /** Ranura para la barra de pregunta en español (Bloque 5). */
  queryBar?: JSX.Element | null
}

export function Dashboard({ observations, filter, onFilter, queryBar }: Props): JSX.Element {
  const all = useMemo(() => flatten(observations), [observations])
  const rows = useMemo(() => applyFilter(all, filter), [all, filter])
  const countries = useMemo(() => [...new Set(all.map((r) => r.obs.country).filter((c): c is string => !!c))].sort(), [all])
  const chips = describeFilter(filter)

  return (
    <section aria-labelledby="dash-h">
      <div className="filters">
        <h2 id="dash-h">3 · Base instalada local</h2>
        <label htmlFor="f-country" className="sr-only">País</label>
        <select id="f-country" value={filter.country ?? ''} onChange={(e) => onFilter({ ...filter, country: e.target.value || null })}>
          <option value="">Todos los países</option>
          {countries.map((c) => <option key={c} value={c}>{countryLabel(c)}</option>)}
        </select>
        <label htmlFor="f-modality" className="sr-only">Modalidad</label>
        <select id="f-modality" value={filter.modality ?? ''} onChange={(e) => onFilter({ ...filter, modality: (e.target.value || null) as QueryFilter['modality'] })}>
          <option value="">Todas las modalidades</option>
          {MODALITIES.map((m) => <option key={m} value={m}>{MODALITY_LABEL_ES[m]}</option>)}
        </select>
      </div>

      {queryBar}

      {!isEmptyFilter(filter) && (
        <div className="chips" aria-live="polite">
          Filtro: {chips.map((c) => <span key={c} className="chip">{c}</span>)}
          <button type="button" className="ghost small" onClick={() => onFilter(EMPTY_FILTER)}>Limpiar</button>
          <span className="muted">{rows.length} de {all.length} filas</span>
        </div>
      )}

      <DataTable rows={rows} />
      <Charts rows={rows} />
    </section>
  )
}
