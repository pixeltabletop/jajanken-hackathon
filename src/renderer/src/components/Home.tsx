// Selector de modo. Dos puertas: registrar lo que se ve en campo, o preguntar
// por el estatus de lo ya registrado.
//
// Las dos tarjetas son <button> reales: alcanzables con Tab, activables con
// Enter, con foco visible. La accesibilidad no es negociable (sección 6).

import { type JSX } from 'react'
import type { EquipmentHit } from '../../../shared/query-engine.ts'
import { Stats } from './Stats.tsx'

interface Props {
  rows: EquipmentHit[]
  total: number
  /** Se dispara al pasar el cursor o al recibir foco: el modo se precarga. */
  onPrepare: (mode: 'capture' | 'follow') => void
  onPick: (mode: 'capture' | 'follow') => void
  /** Los modelos aún cargando no bloquean la entrada, solo se avisa. */
  modelsReady: boolean
}

export function Home({ rows, total, onPrepare, onPick, modelsReady }: Props): JSX.Element {
  const card = (mode: 'capture' | 'follow'): Record<string, unknown> => ({
    className: 'door',
    type: 'button',
    onClick: () => onPick(mode),
    onMouseEnter: () => onPrepare(mode),
    onFocus: () => onPrepare(mode)
  })

  return (
    <section className="home" aria-labelledby="home-h">
      <h2 id="home-h">¿Qué vas a hacer?</h2>
      <div className="doors">
        <button {...card('capture')} id="door-capture">
          <span className="door-kicker">Puerta izquierda</span>
          <b>Registrar equipos</b>
          <span className="door-sub">Dictar o escribir una nota de visita y convertirla en registros.</span>
          <span className="door-go" aria-hidden="true">Entrar →</span>
        </button>
        <button {...card('follow')} id="door-follow">
          <span className="door-kicker">Puerta derecha</span>
          <b>Seguimiento y reportes</b>
          <span className="door-sub">Preguntar en español por el estatus de lo ya registrado.</span>
          <span className="door-go" aria-hidden="true">Entrar →</span>
        </button>
      </div>
      <Stats rows={rows} total={total} />
      <p className="home-note muted">
        {modelsReady
          ? 'Los tres modelos están cargados. Todo corre en esta computadora, sin red.'
          : 'Los modelos siguen cargando. Puedes entrar a Seguimiento: los filtros y las cifras no dependen de ellos.'}
      </p>
    </section>
  )
}
