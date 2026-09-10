// Puerta derecha: seguimiento del estatus de lo ya registrado.
//
// REGLA DURA: la respuesta sale exclusivamente de los registros guardados. El
// modelo traduce la pregunta a un filtro y nada más. Los conteos, listados y
// agrupaciones los calcula query-engine.ts. Si el filtro no devuelve filas, la
// pantalla lo dice con esas palabras y ofrece relajar el filtro; nunca una tabla
// vacía sin explicación ni una respuesta inventada para llenar el hueco.

import { useCallback, useMemo, useRef, useState, type JSX } from 'react'
import type { ColumnKey } from '../../../shared/columns.ts'
import {
  applyFilterAudited,
  countActive,
  EMPTY_FILTER,
  flatten,
  mostRestrictive,
  redact,
  summarize,
  withoutField,
  type GroupBy,
  type QueryPlan
} from '../../../shared/query-engine.ts'
import type { TimingTable } from '../../../shared/timings.ts'
import type { Observation, QueryFilter } from '../../../shared/types.ts'
import type { ThemeId } from '../assets/themes.ts'
import { call } from '../lib/api.ts'
import { DataTable } from './DataTable.tsx'
import { ExportBar } from './ExportBar.tsx'
import { FilterBar } from './FilterBar.tsx'
import { InterpretChip, type PartOrigin } from './InterpretChip.tsx'
import { KpiRow } from './KpiRow.tsx'
import { QueryBar } from './QueryBar.tsx'
import { ResultCharts } from './ResultCharts.tsx'

interface Props {
  observations: Observation[]
  columns: ColumnKey[]
  onColumns: (c: ColumnKey[]) => void
  modelsReady: boolean
  timings: TimingTable
  operator: string
  onOperator: (v: string) => void
  theme: ThemeId
}

type Tab = 'result' | 'charts'

export function FollowUpMode({
  observations, columns, onColumns, modelsReady, timings, operator, onOperator, theme
}: Props): JSX.Element {
  const [question, setQuestion] = useState('')
  const [asked, setAsked] = useState<string | null>(null)
  const [plan, setPlan] = useState<QueryPlan>({ filter: EMPTY_FILTER, intent: 'list', groupBy: null })
  const [origin, setOrigin] = useState<Partial<Record<keyof QueryFilter, PartOrigin>>>({})
  const [busy, setBusy] = useState(false)
  const [ms, setMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('result')
  const [openKey, setOpenKey] = useState<string | null>(null)
  const lastAdded = useRef<keyof QueryFilter | null>(null)

  const all = useMemo(() => flatten(observations), [observations])
  const audit = useMemo(() => applyFilterAudited(all, plan.filter), [all, plan.filter])
  const result = useMemo(() => summarize(audit, plan.intent, plan.groupBy), [audit, plan])
  const answer = useMemo(() => redact(plan, result), [plan, result])

  const countries = useMemo(
    () => [...new Set(all.map((r) => r.country).filter((c): c is string => !!c))].sort(),
    [all]
  )
  const cities = useMemo(() => {
    const pool = plan.filter.country ? all.filter((r) => r.country === plan.filter.country) : all
    return [...new Set(pool.map((r) => r.city).filter((c): c is string => !!c))].sort()
  }, [all, plan.filter.country])

  const setFilter = useCallback((f: QueryFilter, from: PartOrigin, by?: GroupBy) => {
    setPlan((p) => ({ ...p, filter: f }))
    setOrigin((o) => {
      const next = { ...o }
      for (const k of Object.keys(f) as Array<keyof QueryFilter>) {
        if (f[k] !== null && next[k] === undefined) next[k] = from
        if (f[k] === null) delete next[k]
      }
      return next
    })
    if (by) lastAdded.current = by === 'ageBand' ? 'minAgeYears' : (by === 'facility' ? 'textSearch' : (by as keyof QueryFilter))
  }, [])

  async function onAsk(q: string): Promise<void> {
    if (!q) return
    setBusy(true); setError(null); setOpenKey(null)
    try {
      const r = await call(window.api.queryParse(q))
      setPlan(r.plan)
      setMs(r.ms)
      setAsked(q)
      const o: Partial<Record<keyof QueryFilter, PartOrigin>> = {}
      for (const k of Object.keys(r.plan.filter) as Array<keyof QueryFilter>) {
        if (r.plan.filter[k] !== null) o[k] = 'question'
      }
      setOrigin(o)
      setTab(r.plan.intent === 'breakdown' ? 'charts' : 'result')
    } catch (e) {
      setError(
        e instanceof Error && /no está listo|not ready/i.test(e.message)
          ? 'Gemma 2B todavía se está cargando. Puedes usar los filtros de abajo mientras tanto.'
          : `No se pudo interpretar la pregunta: ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setBusy(false)
    }
  }

  function clearAll(): void {
    setPlan({ filter: EMPTY_FILTER, intent: 'list', groupBy: null })
    setOrigin({}); setAsked(null); setMs(null); lastAdded.current = null
  }

  const active = countActive(plan.filter)
  const last = lastAdded.current
  const restrictive = mostRestrictive(plan.filter)

  // Las pestañas declaran cuántas filas traen: cambiar de pestaña no es un salto
  // a ciegas.
  const tabs: Array<{ id: Tab; label: string; count: string }> = [
    { id: 'result', label: 'Resultados', count: `${result.rows} filas` },
    { id: 'charts', label: 'Gráficos', count: `${result.equipment} equipos` }
  ]

  function onTabKey(e: React.KeyboardEvent, i: number): void {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
    setTab(next.id)
    document.getElementById(`tab-${next.id}`)?.focus()
  }

  return (
    <section className="follow" aria-labelledby="follow-h">
      <h2 id="follow-h">Seguimiento y reportes</h2>

      <QueryBar
        value={question} onValue={setQuestion} onAsk={onAsk}
        busy={busy} ready={modelsReady} ms={ms} error={error} timings={timings} theme={theme}
      />

      <InterpretChip
        plan={plan}
        origin={origin}
        question={asked}
        onRemove={(f) => setFilter(withoutField(plan.filter, f), 'manual')}
        onClear={clearAll}
      />

      <p className="answer" aria-live="polite">{answer}</p>

      <ExportBar
        plan={plan} result={result} question={asked ?? ''}
        columns={columns} operator={operator} onOperator={onOperator}
      />

      <div className="tabs" role="tablist" aria-label="Vistas del resultado">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={tab === t.id ? 'on' : undefined}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => onTabKey(e, i)}
          >
            {t.label} <span className="tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {tab === 'result' ? (
        <div id="panel-result" role="tabpanel" aria-labelledby="tab-result">
          <KpiRow r={result} />
          <FilterBar
            filter={plan.filter}
            onFilter={(f) => setFilter(f, 'manual')}
            countries={countries} cities={cities}
            columns={columns} onColumns={onColumns}
            shown={result.rows} total={all.length}
          />
          {result.rows === 0 ? (
            <div className="empty-state">
              <b>Ningún registro cumple ese filtro.</b>
              <p>{answer}</p>
              <div className="actions">
                {restrictive && (
                  <button type="button" className="primary" onClick={() => setFilter(withoutField(plan.filter, restrictive.field), 'manual')}>
                    Quitar la condición más restrictiva ({restrictive.text})
                  </button>
                )}
                {last && (
                  <button type="button" className="ghost" onClick={() => setFilter(withoutField(plan.filter, last), 'manual')}>
                    Deshacer la última condición
                  </button>
                )}
                {active > 0 && <button type="button" className="ghost" onClick={clearAll}>Limpiar todo</button>}
              </div>
            </div>
          ) : (
            <DataTable
              rows={result.hits}
              columns={columns}
              onEdit={() => undefined}
              editingId={null}
              evidenceMode
              openKey={openKey}
              onOpen={setOpenKey}
            />
          )}
        </div>
      ) : (
        <div id="panel-charts" role="tabpanel" aria-labelledby="tab-charts">
          <KpiRow r={result} />
          <p className="muted">
            Haz clic en una barra para meter ese valor en el filtro. Un segundo clic lo quita.
            El gráfico donde hiciste clic sigue mostrando todas sus categorías, con las no elegidas atenuadas.
          </p>
          <ResultCharts all={all} filter={plan.filter} onFilter={(f, by) => setFilter(f, 'chart', by)} />
          {result.rows === 0 && (
            <div className="empty-state">
              <b>Ningún registro cumple ese filtro.</b>
              <p>{answer}</p>
              {last && (
                <button type="button" className="primary" onClick={() => setFilter(withoutField(plan.filter, last), 'manual')}>
                  Deshacer la última condición
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
