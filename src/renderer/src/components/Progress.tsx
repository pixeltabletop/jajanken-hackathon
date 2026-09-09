import { useEffect, useState, type JSX } from 'react'

// Barra de progreso con expectativa REAL: avanza contra el promedio medido de
// esta computadora, no contra una animación decorativa. Si se pasa del promedio
// se frena en 92% y lo dice, en vez de mentir llegando al 100%.

export interface Phase {
  label: string
  /** Fracción del tiempo total en la que esta fase termina. */
  until: number
}

interface Props {
  expectedMs: number | null
  phases: Phase[]
  note: string
  onCancel?: () => void
}

export function Progress({ expectedMs, phases, note, onCancel }: Props): JSX.Element {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setMs(Date.now() - t0), 100)
    return () => clearInterval(id)
  }, [])

  const known = expectedMs !== null && expectedMs > 0
  const ratio = known ? ms / expectedMs : 0
  const over = known && ratio > 1
  const pct = known ? Math.min(92, Math.round(ratio * 92)) : null
  const active = phases.findIndex((p) => ratio < p.until)
  const current = active === -1 ? phases.length - 1 : active

  return (
    <div className="wait" role="status" aria-live="polite">
      <div className="wait-head">
        <span className="wait-elapsed">{(ms / 1000).toFixed(1)} s</span>
        {known && <span className="muted">de ~{(expectedMs / 1000).toFixed(0)} s habituales</span>}
        {!known && <span className="muted">primera vez, midiendo</span>}
      </div>

      <div className={`progress${known ? '' : ' indet'}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
        {known && <span className="progress-fill" style={{ width: `${pct}%` }} />}
      </div>

      <ol className="phases">
        {phases.map((p, i) => (
          <li key={p.label} className={i < current ? 'done' : i === current ? 'now' : ''}>
            <span className="phase-dot" aria-hidden="true" />
            {p.label}
          </li>
        ))}
      </ol>

      <p className="wait-note muted">{note}</p>
      {over && (
        <p className="slow">
          Está tardando más de lo habitual. El modelo sigue trabajando.
          {onCancel && <> <button type="button" className="ghost small" onClick={onCancel}>Dejar de esperar</button></>}
        </p>
      )}
    </div>
  )
}
