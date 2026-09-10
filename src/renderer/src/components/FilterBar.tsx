import { useState, type JSX } from 'react'
import { BRANDS, CONFIDENCE, CONFIDENCE_LABEL_ES, MODALITIES, MODALITY_LABEL_ES, STATUSES, STATUS_LABEL_ES } from '../../../shared/catalog.ts'
import type { Confidence, Modality, Status } from '../../../shared/catalog.ts'
import { COLUMNS, countryLabel, type ColumnKey } from '../../../shared/columns.ts'
import type { QueryFilter } from '../../../shared/types.ts'
import { EMPTY_FILTER } from '../lib/filter.ts'
import { listOf } from '../../../shared/query-engine.ts'

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


/**
 * Un campo del filtro puede traer varios valores ("confianza baja o media"), y
 * un desplegable solo sabe mostrar uno. Cuando hay varios se muestra una opcion
 * sintetica que los declara; elegir cualquier otra cosa reemplaza el conjunto, y
 * quitarlos por separado se hace desde el chip de interpretacion.
 */
function selValue<T extends string>(v: T | T[] | null): string {
  const vs = listOf(v)
  return vs.length > 1 ? '__varios__' : (vs[0] ?? '')
}

function variosLabel<T extends string>(v: T | T[] | null, etiqueta: (x: T) => string): string | null {
  const vs = listOf(v)
  return vs.length > 1 ? 'Varios: ' + vs.map(etiqueta).join(' o ') : null
}

const limpio = (v: string): string => (v === '__varios__' ? '' : v)

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
          <select value={selValue(filter.country)} onChange={(e) => set({ country: limpio(e.target.value) || null })}>
            {variosLabel(filter.country, (c: string) => countryLabel(c)) && <option value="__varios__">{variosLabel(filter.country, (c: string) => countryLabel(c))}</option>}
            <option value="">Todos</option>
            {countries.map((c) => <option key={c} value={c}>{countryLabel(c)}</option>)}
          </select>
        </label>
        <label>Ciudad
          <select value={selValue(filter.city)} onChange={(e) => set({ city: limpio(e.target.value) || null })}>
            {variosLabel(filter.city, (c: string) => c) && <option value="__varios__">{variosLabel(filter.city, (c: string) => c)}</option>}
            <option value="">Todas</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label>Modalidad
          <select value={selValue(filter.modality)} onChange={(e) => set({ modality: (limpio(e.target.value) || null) as QueryFilter['modality'] })}>
            {variosLabel(filter.modality, (m: string) => MODALITY_LABEL_ES[m as Modality]) && <option value="__varios__">{variosLabel(filter.modality, (m: string) => MODALITY_LABEL_ES[m as Modality])}</option>}
            <option value="">Todas</option>
            {MODALITIES.map((m) => <option key={m} value={m}>{MODALITY_LABEL_ES[m]}</option>)}
          </select>
        </label>
        <label>Marca
          <select value={selValue(filter.brand)} onChange={(e) => set({ brand: (limpio(e.target.value) || null) as QueryFilter['brand'] })}>
            {variosLabel(filter.brand, (b: string) => b) && <option value="__varios__">{variosLabel(filter.brand, (b: string) => b)}</option>}
            <option value="">Todas</option>
            {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label>Estado
          <select value={selValue(filter.status)} onChange={(e) => set({ status: (limpio(e.target.value) || null) as QueryFilter['status'] })}>
            {variosLabel(filter.status, (v: string) => STATUS_LABEL_ES[v as Status]) && <option value="__varios__">{variosLabel(filter.status, (v: string) => STATUS_LABEL_ES[v as Status])}</option>}
            <option value="">Todos</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL_ES[s]}</option>)}
          </select>
        </label>
        <label>Confianza
          <select value={selValue(filter.confidence)} onChange={(e) => set({ confidence: (limpio(e.target.value) || null) as QueryFilter['confidence'] })}>
            {variosLabel(filter.confidence, (v: string) => CONFIDENCE_LABEL_ES[v as Confidence]) && <option value="__varios__">{variosLabel(filter.confidence, (v: string) => CONFIDENCE_LABEL_ES[v as Confidence])}</option>}
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
