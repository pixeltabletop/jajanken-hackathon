import type { JSX } from 'react'

// Resalta cada cita dentro del texto original. La búsqueda ignora mayúsculas y
// acentos pero conserva los índices del texto real, porque cada carácter se
// normaliza a un solo carácter base.

interface Quote {
  text: string
  invalid?: boolean
}

function foldChar(c: string): string {
  const n = c.normalize('NFD')
  return (n[0] ?? c).toLowerCase()
}
function fold(s: string): string {
  let out = ''
  for (const c of s) out += foldChar(c)
  return out
}

interface Segment { start: number; end: number; invalid: boolean }

export function EvidenceHighlight({ rawText, quotes }: { rawText: string; quotes: Quote[] }): JSX.Element {
  const folded = fold(rawText)
  const segs: Segment[] = []
  for (const q of quotes) {
    const f = fold(q.text)
    if (!f.trim()) continue
    let from = 0
    for (;;) {
      const i = folded.indexOf(f, from)
      if (i < 0) break
      segs.push({ start: i, end: i + f.length, invalid: !!q.invalid })
      from = i + f.length
      break // una ocurrencia por cita basta para la lectura
    }
  }
  segs.sort((a, b) => a.start - b.start)

  const parts: JSX.Element[] = []
  let cursor = 0
  segs.forEach((s, i) => {
    if (s.start < cursor) return // solapada con la anterior, se omite
    if (s.start > cursor) parts.push(<span key={`t${i}`}>{rawText.slice(cursor, s.start)}</span>)
    parts.push(<mark key={`m${i}`} className={s.invalid ? 'invalid' : undefined}>{rawText.slice(s.start, s.end)}</mark>)
    cursor = s.end
  })
  if (cursor < rawText.length) parts.push(<span key="tail">{rawText.slice(cursor)}</span>)

  const missing = quotes.filter((q) => q.text.trim() && folded.indexOf(fold(q.text)) < 0).length
  return (
    <>
      <p className="evidence" aria-label="Nota original con la evidencia resaltada">{parts}</p>
      <p className="evidence-legend">
        Cada fila de equipo apunta a las palabras exactas que la justifican.
        {missing > 0 && <strong className="muted"> {missing} cita{missing > 1 ? 's' : ''} no aparece{missing > 1 ? 'n' : ''} en la nota y baja{missing > 1 ? 'n' : ''} a confianza Baja.</strong>}
      </p>
    </>
  )
}
