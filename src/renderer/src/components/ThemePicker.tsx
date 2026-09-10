// Elección de tema. Dos formas: el paso corto de la primera ejecución, y el
// selector del encabezado. Las dos escriben el mismo ajuste, que se guarda en
// settings.json al lado de las observaciones.
//
// La aplicación NO sigue el tema del sistema operativo: la elección es explícita.

import type { JSX } from 'react'
import { THEMES, type ThemeId } from '../assets/themes.ts'

interface Props {
  value: ThemeId
  onChange: (id: ThemeId) => void
}

/** Paso de primera ejecución, con una miniatura de cada tema. */
export function ThemeFirstRun({ value, onChange, onDone }: Props & { onDone: () => void }): JSX.Element {
  return (
    <section className="theme-first" aria-labelledby="theme-h">
      <h2 id="theme-h">Elige cómo se ve la aplicación</h2>
      <p className="muted">Se puede cambiar cuando quieras desde el encabezado. Por defecto, Blanco clásico.</p>
      <div className="theme-cards">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`theme-card${value === t.id ? ' on' : ''}`}
            aria-pressed={value === t.id}
            onClick={() => onChange(t.id)}
          >
            <span
              className="theme-thumb"
              style={{ background: t.tokens.page, borderColor: t.tokens.line }}
            >
              <span className="theme-thumb-bar" style={{ background: t.tokens.primary }} />
              <span className="theme-thumb-card" style={{ background: t.tokens.surface, borderColor: t.tokens.line }}>
                <span className="theme-thumb-ink" style={{ background: t.tokens.ink }} />
                <span className="theme-thumb-mark" style={{ background: t.tokens.mark }} />
              </span>
            </span>
            <b>{value === t.id && <span aria-hidden="true">✓ </span>}{t.label}</b>
            <span className="muted">{t.hint}</span>
          </button>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="primary" onClick={onDone}>Continuar</button>
      </div>
    </section>
  )
}

/** Selector compacto del encabezado. Se aplica al instante, sin reiniciar. */
export function ThemeSwitch({ value, onChange }: Props): JSX.Element {
  return (
    <label className="theme-switch">
      <span className="sr-only">Tema de la aplicación</span>
      <select value={value} onChange={(e) => onChange(e.target.value as ThemeId)} aria-label="Tema de la aplicación">
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
    </label>
  )
}
