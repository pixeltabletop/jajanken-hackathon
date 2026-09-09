import { useState, type JSX } from 'react'
import type { Observation } from '../../../shared/types.ts'

// Historial de correcciones de una observación. Philips pregunta en el brief
// cómo distinguir un dato reportado de uno verificado; esto responde la otra
// mitad: quién cambió qué y cuándo.
export function HistoryPanel({ obs }: { obs: Observation }): JSX.Element | null {
  const [open, setOpen] = useState(false)
  const revs = obs.history ?? []
  if (!revs.length) {
    return <p className="muted hist-none">Sin correcciones: este registro está tal como se guardó el {obs.createdAt}.</p>
  }
  return (
    <div className="hist">
      <button type="button" className="ghost small" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Ocultar' : 'Ver'} historial de cambios ({revs.length})
      </button>
      {open && (
        <ol className="hist-list">
          {revs.map((r, i) => (
            <li key={i}>
              <div className="hist-when">
                {new Date(r.at).toLocaleString('es-PA')} · <b>{r.by}</b>
              </div>
              <ul>
                {r.changes.map((c, j) => <li key={j}>{c}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
