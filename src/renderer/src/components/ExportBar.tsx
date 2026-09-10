// Exportación del resultado. Activa solo cuando hay resultado.
//
// El correo NO se envía desde la aplicación: se abre el cliente de correo del
// usuario con el asunto y el cuerpo ya escritos, y el PDF se guarda antes en
// disco porque un adjunto no viaja por mailto:. La interfaz lo dice así, sin
// prometer un envío automático: el producto se demuestra con el WiFi apagado.

import { useState, type JSX } from 'react'
import type { ColumnKey } from '../../../shared/columns.ts'
import type { QueryPlan, QueryResult } from '../../../shared/query-engine.ts'
import type { ThemeId } from '../assets/themes.ts'
import { call } from '../lib/api.ts'
import { BusyOverlay } from './BusyOverlay.tsx'

interface Props {
  plan: QueryPlan
  result: QueryResult
  question: string
  columns: ColumnKey[]
  operator: string
  onOperator: (v: string) => void
  theme: ThemeId
}

export function ExportBar({ plan, result, question, columns, operator, onOperator, theme }: Props): JSX.Element {
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const enabled = result.rows > 0

  const req = (): Parameters<typeof window.api.report>[0] => ({
    kind: 'consulta',
    requestedBy: operator,
    filter: plan.filter,
    columns,
    question: question || 'Consulta con filtros manuales',
    // La frase redactada y el desglose los recalcula el generador con el mismo
    // motor: aquí solo viaja el plan.
    intent: plan.intent,
    groupBy: plan.groupBy
  })

  async function pdf(action: 'open' | 'save' | 'mail'): Promise<void> {
    setBusy(action); setMsg(null)
    try {
      const r = await call(window.api.report(req(), action))
      setMsg(
        r.action === 'cancelado'
          ? 'No se guardó nada.'
          : action === 'mail'
            ? `El PDF quedó en ${r.path} y se abrió su carpeta. Arrástralo al correo que acaba de abrirse: la aplicación no envía nada por su cuenta.`
            : `PDF ${r.action}: ${r.path}`
      )
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  function csv(): void {
    // La tabla filtrada tal cual, con la columna de evidencia. Se descarga desde
    // el propio renderer: no sale nada de esta computadora.
    const head = ['Sitio', 'Ciudad', 'País', 'Modalidad', 'Cantidad', 'Marca', 'Edad', 'Confianza', 'Estatus', 'Evidencia', 'Observación']
    const q = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [head.map(q).join(',')]
    for (const h of result.hits) {
      lines.push([h.site, h.city ?? '', h.country ?? '', h.eq.modality, h.eq.quantity, h.eq.brand ?? '', h.eq.approxAgeYears ?? '', h.eq.confidence, h.eq.status, h.eq.evidence, h.obs.id].map(q).join(','))
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `MAM-consulta-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    setMsg(`CSV con ${result.rows} filas, incluida la columna de evidencia.`)
  }

  return (
    <div className="exportbar">
      <label className="exp-who">
        Solicitado por
        <input type="text" value={operator} onChange={(e) => onOperator(e.target.value)} />
      </label>
      <div className="actions">
        <button type="button" className="primary" disabled={!enabled || busy !== null} onClick={() => pdf('open')}>
          {busy === 'open' ? 'Generando…' : 'Abrir PDF'}
        </button>
        <button type="button" className="ghost" disabled={!enabled || busy !== null} onClick={() => pdf('save')}>
          Guardar PDF
        </button>
        <button type="button" className="ghost" disabled={!enabled} onClick={csv}>
          Descargar CSV
        </button>
        <button type="button" className="ghost" disabled={!enabled || busy !== null} onClick={() => pdf('mail')}>
          Preparar correo
        </button>
      </div>
      <p className="exp-note muted">
        El correo se prepara en tu cliente de correo con el PDF ya guardado en disco. La aplicación
        no envía nada ni se conecta a ningún servidor.
      </p>
      {msg && <p className="rep-msg" aria-live="polite">{msg}</p>}

      <BusyOverlay
        active={busy !== null}
        theme={theme}
        label="Preparando el reporte"
        hint="Se arma dentro de la aplicación, sin red"
      />
    </div>
  )
}
