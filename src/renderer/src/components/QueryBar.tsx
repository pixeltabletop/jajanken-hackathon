// La pregunta en español. Enter dispara. Debajo, preguntas de ejemplo pulsables.
//
// Entrar al modo Seguimiento no está bloqueado por la carga de modelos: si Gemma
// no está lista, la barra dice que se está preparando y los filtros manuales
// siguen funcionando.

import { useRef, type JSX } from 'react'
import { fmt, type TimingTable } from '../../../shared/timings.ts'
import type { ThemeId } from '../assets/themes.ts'
import { BusyOverlay } from './BusyOverlay.tsx'
import { LogoMotion } from './LogoMotion.tsx'

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
  /** Dictado: la pregunta se puede hablar igual que la nota de campo. */
  voiceEnabled: boolean
  recording: boolean
  transcribing: boolean
  seconds: number
  onRecord: () => void
  onStop: () => void
}

export function QueryBar({
  value, onValue, onAsk, busy, ready, ms, error, timings, theme,
  voiceEnabled, recording, transcribing, seconds, onRecord, onStop
}: Props): JSX.Element {
  const input = useRef<HTMLInputElement>(null)
  return (
    <div className="qbar">
      <label htmlFor="q-input" className="qbar-label">
        Pregunta en español sobre lo ya registrado
      </label>
      <div className="qbar-row">
        {recording ? (
          <span className="qbar-rec" role="status" aria-live="polite">
            <span className="qbar-rec-dot" aria-hidden="true" />
            Grabando la pregunta · {seconds.toFixed(0)} s
          </span>
        ) : transcribing ? (
          <span className="qbar-rec" role="status" aria-live="polite">
            Transcribiendo con Whisper Base · en esta computadora · sin red
          </span>
        ) : (
          <input
            id="q-input"
            ref={input}
            type="text"
            value={value}
            placeholder={ready ? 'Escribe o dicta: cuál es el estatus de las unidades en Panamá' : 'Preparando Gemma 2B…'}
            onChange={(e) => onValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && value.trim() && ready && !busy) onAsk(value.trim()) }}
            disabled={busy}
          />
        )}
        {/* Dictar la pregunta no espera a ningún modelo, igual que en el
            registro: grabar es solo el micrófono. */}
        {voiceEnabled && (
          <button
            type="button"
            className={recording ? 'recording' : 'ghost'}
            disabled={busy || transcribing}
            onClick={recording ? onStop : onRecord}
            aria-pressed={recording}
          >
            {recording ? '■ Detener y transcribir' : '🎙 Dictar'}
          </button>
        )}
        <button
          type="button"
          className="primary"
          disabled={!ready || busy || recording || transcribing || !value.trim()}
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

      {!ready && !busy && (
        <p className="qbar-wait muted" aria-live="polite">
          <LogoMotion size="inline" theme={theme} />
          <span>
            El modelo de lenguaje se está cargando, aquí mismo y sin red. Mientras tanto los
            filtros de abajo, las cifras y los gráficos funcionan igual.
          </span>
        </p>
      )}
      {/* La capa cubre SOLO la barra de la pregunta. */}
      <BusyOverlay
        active={busy || recording || transcribing}
        theme={theme}
        label={recording ? 'Escuchando la pregunta' : transcribing ? 'Pasando la voz a texto' : 'Trabajando en tu pregunta'}
        hint={
          recording
            ? 'Pulsa Detener cuando termines'
            : busy && timings.query
              ? `Suele tardar ${fmt(timings.query.avgMs)} · en esta computadora, sin red`
              : 'En esta computadora, sin red'
        }
      />

      {error && <p className="qbar-error" role="alert">{error}</p>}
      {!busy && !error && ms !== null && (
        <p className="qbar-ms muted">Interpretada en {fmt(ms)}. Las cifras las calculó la aplicación sobre los registros, no el modelo.</p>
      )}
    </div>
  )
}
