// Etiquetas en español para valores guardados en inglés canónico (D10, D20).

import type { Language } from '../../../shared/types.ts'

// Los catálogos de etiquetas viven en shared/: aquí solo el puente y lo que
// es propio del renderer.
export { COUNTRY_ES, countryLabel } from '../../../shared/columns.ts'
export { AGE_BANDS as AGE_BUCKETS, ageBand as ageBucket } from '../../../shared/query-engine.ts'

// Heurística barata. El prompt de extracción entiende ambos idiomas; esto solo
// etiqueta la observación y decide la fuente del texto.
export function detectLanguage(text: string): Language {
  const es = (text.match(/\b(el|la|los|las|un|una|unos|tiene|tienen|de|y|con|en|hay|vi)\b/gi) ?? []).length
  const en = (text.match(/\b(the|has|have|and|with|is|are|of|there|saw)\b/gi) ?? []).length
  return en > es ? 'en' : 'es'
}

export const pct = (n: number): string => `${Math.round(n * 100)}%`
