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
export function ThemeSwitch({ value, onChange }: Props): JSX.Element {
  return (
    <label className="theme-switch">
      <span className="theme-switch-label">Tema</span>
      <select value={value} onChange={(e) => onChange(e.target.value as ThemeId)} aria-label="Tema de la aplicación">
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>{t.label}</option>
        ))}
      </select>
    </label>
  )
}
