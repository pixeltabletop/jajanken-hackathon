// Etiquetas en español para valores guardados en inglés canónico (D10, D20).

import type { Language } from '../../../shared/types.ts'

export const COUNTRY_ES: Record<string, string> = {
  Panama: 'Panamá',
  Brazil: 'Brasil',
  Mexico: 'México',
  Peru: 'Perú',
  'Dominican Republic': 'República Dominicana',
  Chile: 'Chile',
  Argentina: 'Argentina',
  Colombia: 'Colombia',
  'Costa Rica': 'Costa Rica',
  Ecuador: 'Ecuador'
}

export const countryLabel = (c: string | null | undefined): string => (c ? COUNTRY_ES[c] ?? c : '—')

export const AGE_BUCKETS = ['0–3 años', '4–7 años', '8+ años', 'Sin dato'] as const

export function ageBucket(a: number | null): (typeof AGE_BUCKETS)[number] {
  if (a === null) return 'Sin dato'
  if (a <= 3) return '0–3 años'
  if (a <= 7) return '4–7 años'
  return '8+ años'
}

// Heurística barata. El prompt de extracción entiende ambos idiomas; esto solo
// etiqueta la observación y decide la fuente del texto.
export function detectLanguage(text: string): Language {
  const es = (text.match(/\b(el|la|los|las|un|una|unos|tiene|tienen|de|y|con|en|hay|vi)\b/gi) ?? []).length
  const en = (text.match(/\b(the|has|have|and|with|is|are|of|there|saw)\b/gi) ?? []).length
  return en > es ? 'en' : 'es'
}

export const pct = (n: number): string => `${Math.round(n * 100)}%`
