// La pregunta en español. Enter dispara. Debajo, preguntas de ejemplo pulsables.
//
// Entrar al modo Seguimiento no está bloqueado por la carga de modelos: si Gemma
// no está lista, la barra dice que se está preparando y los filtros manuales
// siguen funcionando.

import { useEffect, useRef, useState, type JSX } from 'react'
import { fmt, type TimingTable } from '../../../shared/timings.ts'
import { LogoMotion } from './LogoMotion.tsx'
import type { ThemeId } from '../assets/themes.ts'

const EXAMPLES = [
  'cuál es el estatus de las unidades en Panamá',
  'cuántas son de baja confianza',
  'dame los ecógrafos de más de siete años',
  'qué marcas hay en Ciudad de Panamá'
]

interface Props {
  value: string
  onValue: (v: string) => void
  onAsk: (q: string) => void
  busy: boolean
  ready: boolean
  ms: number | null
  error: string | null
  timings: TimingTable
  theme: ThemeId
}

export function QueryBar({ value, onValue, onAsk, busy, ready, ms, error, timings, theme }: Props): JSX.Element {
  const input = useRef<HTMLInputElement>(null)
  const [waited, setWaited] = useState(0)

  // Umbral de 150 ms: por debajo no se muestra nada, un indicador que parpadea
  // se ve peor que ninguno.
  useEffect(() => {
    if (!busy) { setWaited(0); return }
    const t0 = Date.now()
    const id = setInterval(() => setWaited(Date.now() - t0), 100)
    return () => clearInterval(id)
  }, [busy])

  const show = busy && waited > 150

  return (
    <div className="qbar">
      <label htmlFor="q-input" className="qbar-label">
        Pregunta en español sobre lo ya registrado
      </label>
      <div className="qbar-row">
        <input
          id="q-input"
          ref={input}
          type="text"
          value={value}
          placeholder={ready ? 'Por ejemplo: cuál es el estatus de las unidades en Panamá' : 'Preparando Gemma 2B…'}
          onChange={(e) => onValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && value.trim() && ready && !busy) onAsk(value.trim()) }}
          disabled={busy}
        />
        <button
          type="button"
          className="primary"
          disabled={!ready || busy || !value.trim()}
          onClick={() => onAsk(value.trim())}
        >
          {busy ? 'Interpretando…' : 'Preguntar'}
        </button>
      </div>

      <div className="qbar-examples">
        <span className="muted">Prueba con:</span>
        {EXAMPLES.map((e) => (
          <button key={e} type="button" className="linkish" disabled={busy || !ready} onClick={() => { onValue(e); onAsk(e) }}>
            {e}
          </button>
        ))}
      </div>

      {show && (
        <p className="qbar-wait" aria-live="polite">
          <LogoMotion size="inline" theme={theme} />
          <span>
            Interpretando la pregunta con Gemma 2B · local · sin red
            {timings.query && <> · suele tardar {fmt(timings.query.avgMs)}</>}
          </span>
        </p>
      )}
      {!ready && !busy && (
        <p className="qbar-wait muted" aria-live="polite">
          <LogoMotion size="inline" theme={theme} />
          <span>
            Gemma 2B se está cargando · local · sin red. Mientras tanto los filtros de abajo,
            las cifras y los gráficos funcionan igual.
          </span>
        </p>
      )}
      {error && <p className="qbar-error" role="alert">{error}</p>}
      {!busy && !error && ms !== null && (
        <p className="qbar-ms muted">Interpretada en {fmt(ms)}. Las cifras las calculó la aplicación sobre los registros, no el modelo.</p>
      )}
    </div>
  )
}
