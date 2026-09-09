import type { JSX } from 'react'
import { FOLLOW_UP_ES } from '../../../shared/catalog.ts'

// Paso 12 de la lógica de agente de Philips: una pregunta por el dato que más vale.
export function FollowUp({ missingFields }: { missingFields: string[] }): JSX.Element | null {
  const first = missingFields.find((f) => FOLLOW_UP_ES[f])
  if (!first) return null
  return (
    <aside role="note">
      <b>Pregunta sugerida al técnico:</b> {FOLLOW_UP_ES[first]}
      {missingFields.length > 1 && <span className="muted"> · faltan también: {missingFields.filter((f) => f !== first).join(', ')}</span>}
    </aside>
  )
}
