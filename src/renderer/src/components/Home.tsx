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
  /** Gemma lista: sin ella se puede entrar igual, pero no preguntar. */
  gemmaReady: boolean
  operator: string
}

const PUERTAS = [
  {
    id: 'capture' as const,
    kicker: 'Registrar',
    titulo: 'Registrar equipos',
    sub: 'Dictas o escribes lo que viste en la visita y queda como registros, con la cita de la nota que justifica cada dato.',
    hacer: ['Dictar o escribir la nota', 'Revisar fila por fila con su evidencia', 'Resolver el cliente y guardar'],
    listo: 'Puedes empezar ya: escribir y dictar no esperan a ningún modelo.'
  },
  {
    id: 'follow' as const,
    kicker: 'Consultar',
    titulo: 'Seguimiento y reportes',
    sub: 'Preguntas en español por lo ya registrado y la aplicación contesta con cifras calculadas sobre los registros.',
    hacer: ['Preguntar en español o filtrar a mano', 'Ver el desglose y los gráficos', 'Exportar a PDF o CSV'],
    listo: 'Los filtros, las cifras y los gráficos funcionan aunque los modelos sigan cargando.'
  }
]

export function Home({ rows, total, onPrepare, onPick, modelsReady, gemmaReady, operator }: Props): JSX.Element {
  return (
    <section className="home" aria-labelledby="home-h">
      <div className="home-head">
        <h2 id="home-h">¿Qué vas a hacer?</h2>
        <p className="home-quien muted">
          Entraste como <b>{operator}</b>. Todo lo que registres queda a tu nombre.
        </p>
      </div>

      <div className="doors">
        {PUERTAS.map((p, i) => (
          <button
            key={p.id}
            id={`door-${p.id}`}
            type="button"
            className="door"
            onClick={() => onPick(p.id)}
            onMouseEnter={() => onPrepare(p.id)}
            onFocus={() => onPrepare(p.id)}
          >
            <span className="door-top">
              <span className="door-num" aria-hidden="true">{i + 1}</span>
              <span className="door-kicker">{p.kicker}</span>
            </span>
            <b>{p.titulo}</b>
            <span className="door-sub">{p.sub}</span>
            <ul className="door-list">
              {p.hacer.map((h) => <li key={h}>{h}</li>)}
            </ul>
            <span className="door-foot">
              <span className="door-go" aria-hidden="true">Entrar →</span>
              {!modelsReady && <span className="door-listo muted">{p.id === 'follow' && !gemmaReady ? p.listo : p.listo}</span>}
            </span>
          </button>
        ))}
      </div>

      <Stats rows={rows} total={total} />

      <p className="home-note muted">
        {modelsReady
          ? 'Los tres modelos están cargados. Todo corre en esta computadora, sin red.'
          : 'Los modelos siguen cargando en segundo plano. Puedes entrar por cualquiera de las dos puertas; cada pantalla avisa de lo que todavía no puede hacer.'}
      </p>
    </section>
  )
}
