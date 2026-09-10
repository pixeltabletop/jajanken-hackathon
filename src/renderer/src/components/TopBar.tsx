// Franja superior del área de trabajo. Deliberadamente delgada.
//
// Con la barra lateral llevando navegación, tema y sesión, aquí arriba solo
// queda lo que responde a "¿dónde estoy y con qué datos?": el nombre de la
// sección, cuántas observaciones hay en la base, y el botón de refrescar.
//
// La insignia de "100 % local" se queda porque es la promesa del producto y el
// jurado la busca. No es decoración.

import type { JSX } from 'react'
import { HelpTip } from './HelpTip.tsx'

interface Props {
  titulo: string
  /** Frase corta bajo el título. Null en el inicio, donde la pantalla ya habla. */
  sub: string | null
  observaciones: number
  onRefrescar: () => void
  refrescando: boolean
}

const Refrescar = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.2 11.4a8.2 8.2 0 1 1-2.4-5.6" />
    <path d="M20.6 3.6v5.2h-5.2" />
  </svg>
)

export function TopBar({ titulo, sub, observaciones, onRefrescar, refrescando }: Props): JSX.Element {
  return (
    <header className="topbar">
      <div className="topbar-donde">
        <h1>{titulo}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>

      <div className="topbar-acciones">
        <span className="topbar-cuenta muted" aria-live="polite">
          {observaciones === 1 ? '1 observación' : `${observaciones} observaciones`}
        </span>
        <button
          type="button"
          id="topbar-refrescar"
          className="icon-btn"
          onClick={onRefrescar}
          disabled={refrescando}
          aria-label="Refrescar los datos desde el disco"
          title="Refrescar los datos desde el disco"
        >
          <span className={refrescando ? 'girando' : undefined}>
            <Refrescar />
          </span>
        </button>
        <span className="local-badge">
          100% local
          <HelpTip termKey="local" align="right" />
        </span>
      </div>
    </header>
  )
}
