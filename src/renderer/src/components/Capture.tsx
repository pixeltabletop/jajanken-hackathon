import type { JSX } from 'react'

interface Props {
  text: string
  onText: (t: string) => void
  busy: boolean
  recording: boolean
  seconds: number
  voiceEnabled: boolean
  modelsReady: boolean
  onRecord: () => void
  onStop: () => void
  onExtract: () => void
  message: string
}

export function Capture(p: Props): JSX.Element {
  return (
    <section aria-labelledby="cap-h">
      <h2 id="cap-h">1 · Observación de campo</h2>
      <label htmlFor="note" className="sr-only">Nota de campo</label>
      <textarea
        id="note"
        value={p.text}
        onChange={(e) => p.onText(e.target.value)}
        placeholder="Dicta o escribe lo que viste en la visita. Ejemplo: Estoy en el Hospital DemoCare Bella Vista, tienen dos resonadores NovaMed de unos seis años…"
        disabled={p.busy || p.recording}
      />
      <div>
        {p.voiceEnabled && (
          <button
            type="button"
            disabled={p.busy || !p.modelsReady}
            onClick={p.recording ? p.onStop : p.onRecord}
            aria-pressed={p.recording}
          >
            {p.recording ? `■ Detener (${p.seconds.toFixed(0)} s)` : '🎙 Dictar'}
          </button>
        )}
        <button
          type="button"
          disabled={p.busy || p.recording || !p.text.trim() || !p.modelsReady}
          onClick={p.onExtract}
        >
          {p.busy ? 'Procesando…' : 'Interpretar con QVAC'}
        </button>
      </div>
      <p role="status" aria-live="polite">{p.message}</p>
    </section>
  )
}
