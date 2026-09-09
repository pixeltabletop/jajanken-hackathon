import { useState, type JSX } from 'react'
import { EXAMPLE_NOTE, FIELD_PROMPTS } from '../../../shared/glossary.ts'

// Guía de qué contar antes de dictar. Sale de los doce pasos de la lógica de
// agente del brief de Philips, reducidos a lo que una persona puede recordar
// hablando. Arranca abierta la primera vez y se puede plegar.

export function FieldGuide({ onUseExample }: { onUseExample: (t: string) => void }): JSX.Element {
  const [open, setOpen] = useState(true)
  return (
    <div className={`guide${open ? ' open' : ''}`}>
      <button type="button" className="guide-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="guide-chev" aria-hidden="true" />
        Qué contar en la nota
        <span className="muted">{open ? 'ocultar' : 'ver las 7 preguntas'}</span>
      </button>
      {open && (
        <div className="guide-body">
          <ol className="guide-list">
            {FIELD_PROMPTS.map((p) => (
              <li key={p.q} className={p.required ? 'req' : ''}>
                <b>{p.q}</b>
                <span>{p.hint}</span>
              </li>
            ))}
          </ol>
          <p className="guide-foot">
            No hace falta seguir el orden ni decirlo todo. Lo que falte, el sistema lo pregunta después.
            {' '}
            <button type="button" className="linkish" onClick={() => onUseExample(EXAMPLE_NOTE)}>Ver un ejemplo completo</button>
          </p>
        </div>
      )}
    </div>
  )
}
