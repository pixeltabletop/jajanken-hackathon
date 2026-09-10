// Estado del tema para el renderer. Un solo lugar decide qué tokens están
// activos; los componentes que necesitan un color en JavaScript (Recharts pinta
// atributos SVG, no acepta var()) lo piden aquí en vez de escribirlo a mano.

import { useEffect, useState } from 'react'
import {
  applyTheme,
  DEFAULT_THEME,
  isThemeId,
  THEME_BY_ID,
  type Theme,
  type ThemeId,
  type ThemeTokens
} from '../assets/themes.ts'

let current: ThemeId = DEFAULT_THEME
const listeners = new Set<(id: ThemeId) => void>()

/** Aplica el tema y avisa a los componentes que pintan colores en JS. */
export function setTheme(id: ThemeId): void {
  current = isThemeId(id) ? id : DEFAULT_THEME
  applyTheme(current)
  for (const l of listeners) l(current)
}

export function getTheme(): ThemeId {
  return current
}

export function useThemeId(): ThemeId {
  const [id, setId] = useState<ThemeId>(current)
  useEffect(() => {
    listeners.add(setId)
    setId(current)
    return () => { listeners.delete(setId) }
  }, [])
  return id
}

export function useThemeTokens(): ThemeTokens {
  return (THEME_BY_ID[useThemeId()] ?? THEME_BY_ID[DEFAULT_THEME]).tokens
}

export function useTheme(): Theme {
  return THEME_BY_ID[useThemeId()] ?? THEME_BY_ID[DEFAULT_THEME]
}
