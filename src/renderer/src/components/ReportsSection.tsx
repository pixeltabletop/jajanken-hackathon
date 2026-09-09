import { useState, type JSX } from 'react'
import type { ColumnKey } from '../../../shared/columns.ts'
import { REPORTS, type ReportKind, type ReportRequest } from '../../../shared/reports.ts'
import type { Observation, QueryFilter } from '../../../shared/types.ts'
import { describeFilter } from '../lib/filter.ts'
import { call } from '../lib/api.ts'

interface Props {
  observations: Observation[]
  filter: QueryFilter
  columns: ColumnKey[]
  operator: string
  onOperator: (o: string) => void
  rowsShown: number
}

export function ReportsSection({ observations, filter, columns, operator, onOperator, rowsShown }: Props): JSX.Element {
  const [kind, setKind] = useState<ReportKind>('inventario')
  const [facility, setFacility] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const sites = [...new Set(observations.map((o) => o.facilityCanonical ?? o.facility))].sort()
  const def = REPORTS.find((r) => r.kind === kind)!
  const chips = describeFilter(filter)
  const needsFacility = kind === 'cliente'
  const disabled = busy || (needsFacility && !facility)

  async function run(action: 'save' | 'open' | 'mail'): Promise<void> {
    setBusy(true); setMsg('Componiendo el PDF…')
    try {
      const req: ReportRequest = { kind, requestedBy: operator, filter, columns, facility: needsFacility ? facility : undefined, note: note.trim() || undefined }
      const r = await call(window.api.report(req, action))
      setMsg(
        r.action === 'cancelado' ? 'Cancelado.'
          : r.action === 'correo' ? `PDF guardado en ${r.path}. Se abrió tu correo: adjunta el archivo antes de enviarlo.`
          : r.action === 'abierto' ? 'Reporte abierto en tu visor de PDF. Desde ahí puedes imprimirlo.'
          : `Guardado en ${r.path}`
      )
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) } finally { setBusy(false) }
  }

  return (
    <section aria-labelledby="rep-h" className="reports">
      <div className="filters">
        <h2 id="rep-h">4 · Reportes</h2>
        <span className="muted">Se generan en esta computadora, sin conexión</span>
      </div>

      <div className="rep-kinds" role="radiogroup" aria-label="Tipo de reporte">
        {REPORTS.map((r) => (
          <button
            key={r.kind}
            type="button"
            role="radio"
            aria-checked={kind === r.kind}
            className={`rep-kind${kind === r.kind ? ' on' : ''}`}
            onClick={() => { setKind(r.kind); setMsg('') }}
          >
            <b>{r.title}</b>
            <span>{r.description}</span>
          </button>
        ))}
      </div>

      <div className="rep-form">
        {needsFacility && (
          <label>Cliente
            <select value={facility} onChange={(e) => setFacility(e.target.value)}>
              <option value="">Elige un cliente</option>
              {sites.map((s2) => <option key={s2} value={s2}>{s2}</option>)}
            </select>
          </label>
        )}
        <label>Solicitado por
          <input value={operator} onChange={(e) => onOperator(e.target.value)} placeholder="Tu nombre" />
        </label>
        <label className="rep-note">Nota para el encabezado (opcional)
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: para la reunión de renovación del Q4" />
        </label>
      </div>

      <p className="muted rep-scope">
        {kind === 'cambios'
          ? 'Este reporte recorre todas las observaciones editadas, sin aplicar los filtros del tablero.'
          : kind === 'cliente'
            ? 'La ficha incluye todo el cliente, sin aplicar los filtros del tablero.'
            : <>Alcance: {chips.length ? <>los filtros activos ({chips.join(' · ')}), {rowsShown} filas</> : <>la base completa, {rowsShown} filas</>}. Columnas: {columns.length}.</>}
      </p>

      <div className="actions">
        <button type="button" className="primary" disabled={disabled} onClick={() => run('save')}>Guardar PDF</button>
        <button type="button" className="ghost" disabled={disabled} onClick={() => run('open')}>Ver e imprimir</button>
        <button type="button" className="ghost" disabled={disabled} onClick={() => run('mail')}>Guardar y redactar correo</button>
        {busy && <span className="muted">{def.title}…</span>}
      </div>
      {msg && <p className="rep-msg" role="status">{msg}</p>}
    </section>
  )
}
