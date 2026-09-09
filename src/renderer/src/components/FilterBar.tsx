import { useState, type JSX } from 'react'
import { BRANDS, CONFIDENCE, CONFIDENCE_LABEL_ES, MODALITIES, MODALITY_LABEL_ES, STATUSES, STATUS_LABEL_ES } from '../../../shared/catalog.ts'
import { COLUMNS, countryLabel, type ColumnKey } from '../../../shared/columns.ts'
import type { QueryFilter } from '../../../shared/types.ts'
import { EMPTY_FILTER } from '../lib/filter.ts'

interface Props {
  filter: QueryFilter
  onFilter: (f: QueryFilter) => void
  countries: string[]
  cities: string[]
  columns: ColumnKey[]
  onColumns: (c: ColumnKey[]) => void
  shown: number
  total: number
}

export function FilterBar({ filter, onFilter, countries, cities, columns, onColumns, shown, total }: Props): JSX.Element {
  const [openCols, setOpenCols] = useState(false)
  const set = (patch: Partial<QueryFilter>): void => onFilter({ ...filter, ...patch })
  const num = (v: string): number | null => (v.trim() === '' ? null : Number(v))
  const active = Object.values(filter).filter((v) => v !== null).length

  return (
    <div className="filterbar">
      <div className="fb-row">
        <label className="fb-search">
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            placeholder="Buscar cliente, marca, modelo o texto de la nota…"
            value={filter.textSearch ?? ''}
            onChange={(e) => set({ textSearch: e.target.value.trim() || null })}
          />
        </label>

        <button type="button" className="ghost small" aria-expanded={openCols} onClick={() => setOpenCols((o) => !o)}>
          Columnas ({columns.length})
        </button>
        {active > 0 && (
          <button type="button" className="ghost small" onClick={() => onFilter(EMPTY_FILTER)}>Limpiar filtros</button>
        )}
        <span className="muted fb-count">{shown} de {total} filas</span>
      </div>

      {openCols && (
        <div className="colpick" role="group" aria-label="Columnas visibles">
          {COLUMNS.map((c) => {
            const on = columns.includes(c.key)
            return (
              <label key={c.key} className={on ? 'on' : ''}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onColumns(on ? columns.filter((k) => k !== c.key) : [...COLUMNS.map((x) => x.key)].filter((k) => columns.includes(k) || k === c.key))}
                />
                {c.label}
              </label>
            )
          })}
        </div>
      )}

      <div className="fb-row fb-selects">
        <label>País
          <select value={filter.country ?? ''} onChange={(e) => set({ country: e.target.value || null })}>
            <option value="">Todos</option>
            {countries.map((c) => <option key={c} value={c}>{countryLabel(c)}</option>)}
          </select>
        </label>
        <label>Ciudad
          <select value={filter.city ?? ''} onChange={(e) => set({ city: e.target.value || null })}>
            <option value="">Todas</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Modalidad
          <select value={filter.modality ?? ''} onChange={(e) => set({ modality: (e.target.value || null) as QueryFilter['modality'] })}>
            <option value="">Todas</option>
            {MODALITIES.map((m) => <option key={m} value={m}>{MODALITY_LABEL_ES[m]}</option>)}
          </select>
        </label>
        <label>Marca
          <select value={filter.brand ?? ''} onChange={(e) => set({ brand: (e.target.value || null) as QueryFilter['brand'] })}>
            <option value="">Todas</option>
            {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label>Estado
          <select value={filter.status ?? ''} onChange={(e) => set({ status: (e.target.value || null) as QueryFilter['status'] })}>
            <option value="">Todos</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL_ES[s]}</option>)}
          </select>
        </label>
        <label>Confianza
          <select value={filter.confidence ?? ''} onChange={(e) => set({ confidence: (e.target.value || null) as QueryFilter['confidence'] })}>
            <option value="">Todas</option>
            {CONFIDENCE.map((c) => <option key={c} value={c}>{CONFIDENCE_LABEL_ES[c]}</option>)}
          </select>
        </label>
        <div className="fb-age">
          <span className="fb-age-label" id="fb-age-lbl">Edad (años)</span>
          <span>
            <input type="number" min={0} placeholder="desde" aria-label="Edad mínima en años" value={filter.minAgeYears ?? ''} onChange={(e) => set({ minAgeYears: num(e.target.value) })} />
            <input type="number" min={0} placeholder="hasta" aria-label="Edad máxima en años" value={filter.maxAgeYears ?? ''} onChange={(e) => set({ maxAgeYears: num(e.target.value) })} />
          </span>
        </div>
      </div>
    </div>
  )
}
