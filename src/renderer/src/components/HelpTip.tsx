import { useEffect, useId, useRef, useState, type JSX } from 'react'
import { GLOSSARY } from '../../../shared/glossary.ts'

// Globo de ayuda anclado a un término del glosario. Se abre al pasar el ratón y
// también al pulsar o con el teclado, porque un tooltip que solo responde al
// hover deja fuera a quien navega con Tab.
export function HelpTip({ termKey, align = 'left' }: { termKey: keyof typeof GLOSSARY; align?: 'left' | 'right' }): JSX.Element {
  const entry = GLOSSARY[termKey]
  const [open, setOpen] = useState(false)
  const id = useId()
  const box = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    const onClick = (e: MouseEvent): void => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [open])

  return (
    <span className="helptip" ref={box} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className="helptip-btn"
        aria-label={`Qué significa ${entry.term}`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        ?
      </button>
      {open && (
        <span className={`helptip-box ${align}`} id={id} role="tooltip">
          <strong>{entry.term}</strong>
          <span>{entry.short}</span>
          {entry.long && <span className="helptip-long">{entry.long}</span>}
        </span>
      )}
    </span>
  )
}
