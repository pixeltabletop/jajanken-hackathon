// Corrección del dictado contra el vocabulario del dominio.
//
// Whisper Base acierta la frase pero destroza los términos que no conoce:
// "rayos X" salió como "rayosex", "DemoCare" como "mocare", "Zenith MedTech"
// como "zenit medtec". Sembrar el vocabulario en initial_prompt ayuda pero no
// basta, porque el modelo ya cerró la palabra antes de que el prompt pese.
//
// Aquí se corrige DESPUÉS, contra una lista cerrada y con distancia de edición.
// Dos reglas que hacen esto seguro:
//   1. Solo se toca lo que se parece mucho a un término conocido.
//   2. Cada cambio se devuelve en `fixes` y la interfaz lo muestra. Nada se
//      corrige en silencio: el técnico ve qué se cambió y puede deshacerlo
//      editando el texto.

export interface TranscriptFix {
  from: string
  to: string
}

export interface NormalizedTranscript {
  text: string
  fixes: TranscriptFix[]
}

// Solo se corrige lo que el dictado transcribió MAL. Los sinónimos legítimos
// ("ultrasonido", "resonancia magnética", "tomografía") se dejan intactos: de
// esos ya se encarga el prompt del extractor, y forzarlos aquí empeora el texto
// que Whisper acertó. Medido: colapsar sinónimos subía el error de 17% a 18.1%.
const LITERAL_FIXES: Array<[RegExp, string]> = [
  // "rayos X" es el caso más frecuente: el dictado lo pega en una palabra.
  [/\brayos?\s*(?:ex|equis)\b/gi, 'rayos X'],
  [/\brayos?ex\b/gi, 'rayos X'],
  [/\brayos?x\b/gi, 'rayos X'],
  // Adjetivo por sustantivo: "tomográfico" no es un equipo, "tomografía" sí.
  [/\btomogr[áa]fico(s?)\b/gi, 'tomógrafo$1'],
  [/\becogr[áa]fico(s?)\b/gi, 'ecógrafo$1'],
  [/\bresonanciador(es)?\b/gi, 'resonador$1'],
  // "DemoCare" es prefijo fijo de toda la cartera y el dictado se come la
  // primera sílaba: mocare, mocar, mokare, moccare, demo care.
  [/\bdemo\s+care\b/gi, 'DemoCare'],
  [/\bmo+c+a?re?\b/gi, 'DemoCare'],
  [/\bmokare\b/gi, 'DemoCare'],
  [/\bmocar\b/gi, 'DemoCare']
]

/** Términos multipalabra del catálogo que el difuso trata como una unidad. */
function vocabulary(brands: readonly string[], customers: readonly string[]): string[] {
  const base = [
    'DemoCare',
    'resonador',
    'resonadores',
    'tomógrafo',
    'tomógrafos',
    'ecógrafo',
    'ecógrafos'
  ]
  // De los nombres de cliente interesan las palabras propias, no "Hospital" ni "Clínica".
  const proper = customers.flatMap((c) =>
    c
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !/^(hospital|cl[íi]nica|centro|instituto|polic[íi]nica|m[ée]dico|diagn[óo]stico|del|de|la|el)$/i.test(w))
  )
  return [...new Set([...base, ...brands, ...proper])]
}

const fold = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')

function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1])
  return d[a.length][b.length]
}

/** Similitud 0..1 entre dos cadenas ya plegadas. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const max = Math.max(a.length, b.length)
  return 1 - distance(a, b) / max
}

// Umbral alto a propósito: preferimos dejar un error visible antes que
// inventar una marca que nadie dijo. Es la misma regla que el extractor.
const THRESHOLD = 0.78

export function normalizeTranscript(
  raw: string,
  opts: { brands?: readonly string[]; customers?: readonly string[] } = {}
): NormalizedTranscript {
  const fixes: TranscriptFix[] = []
  let text = raw

  for (const [re, to] of LITERAL_FIXES) {
    text = text.replace(re, (match) => {
      const replaced = match.replace(re, to)
      if (fold(match) !== fold(replaced)) fixes.push({ from: match.trim(), to: replaced })
      return replaced
    })
  }

  const vocab = vocabulary(opts.brands ?? [], opts.customers ?? [])
  if (vocab.length === 0) return { text, fixes }

  // Ventanas de 1 a 3 palabras, de la más larga a la más corta, para que
  // "Aurelia Health" gane sobre "Aurelia" suelta.
  const words = text.split(/(\s+)/) // conserva los separadores
  const isWord = (i: number): boolean => i % 2 === 0
  const idx = words.map((_, i) => i).filter(isWord)

  for (let size = 3; size >= 1; size--) {
    for (let k = 0; k + size <= idx.length; k++) {
      const from = idx[k]
      const to = idx[k + size - 1]
      const phrase = words.slice(from, to + 1).join('')
      const folded = fold(phrase)
      if (folded.length < 4) continue

      let best: { term: string; score: number } | null = null
      for (const term of vocab) {
        const ft = fold(term)
        if (Math.abs(ft.length - folded.length) > 4) continue
        if (ft === folded) { best = null; break } // ya está bien escrito
        const score = similarity(folded, ft)
        if (score >= THRESHOLD && (!best || score > best.score)) best = { term, score }
      }
      if (!best) continue

      // Conserva la mayúscula inicial si la traía.
      const replacement = /^[A-ZÁÉÍÓÚÑ]/.test(phrase.trim()) || /^[A-Z]/.test(best.term) ? best.term : best.term.toLowerCase()
      fixes.push({ from: phrase.trim(), to: replacement })
      words[from] = replacement
      for (let w = from + 1; w <= to; w++) words[w] = ''
    }
  }

  text = words.join('').replace(/\s+/g, ' ').trim()
  return { text, fixes }
}
