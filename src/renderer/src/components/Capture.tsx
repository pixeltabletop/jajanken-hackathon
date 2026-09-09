import type { JSX } from 'react'
import type { TranscriptFix } from '../../../shared/transcript.ts'
import { fmt, type TimingTable } from '../../../shared/timings.ts'
import { FieldGuide } from './FieldGuide.tsx'
import { Progress } from './Progress.tsx'
import { Waveform } from './Waveform.tsx'

interface Props {
  text: string
  onText: (t: string) => void
  busy: boolean
  transcribing: boolean
  recording: boolean
  seconds: number
  level: number
  fixes: TranscriptFix[]
  voiceEnabled: boolean
  modelsReady: boolean
  timings: TimingTable
  onRecord: () => void
  onStop: () => void
  onExtract: () => void
  message: string
}

export function Capture(p: Props): JSX.Element {
  const expected = p.timings.transcribe?.avgMs ?? null
  return (
    <section aria-labelledby="cap-h">
      <h2 id="cap-h">1 · Observación de campo</h2>

      <FieldGuide onUseExample={p.onText} />

      {p.recording ? (
        <Waveform level={p.level} seconds={p.seconds} />
      ) : p.transcribing ? (
        <Progress
          expectedMs={expected}
          phases={[
            { label: 'Preparando el audio', until: 0.25 },
            { label: 'Whisper escuchando', until: 0.8 },
            { label: 'Corrigiendo términos del catálogo', until: 1 }
          ]}
          note="Whisper Base · en esta computadora · sin red"
        />
      ) : (
        <>
          <label htmlFor="note" className="sr-only">Nota de campo</label>
          <textarea
            id="note"
            value={p.text}
            onChange={(e) => p.onText(e.target.value)}
            placeholder="Dicta o escribe lo que viste en la visita. Puedes corregir el texto antes de interpretarlo."
            disabled={p.busy}
          />
        </>
      )}

      {p.fixes.length > 0 && !p.recording && !p.transcribing && (
        <div className="fixes" role="note">
          <b>Corregí {p.fixes.length} término{p.fixes.length !== 1 ? 's' : ''} del dictado:</b>
          <ul>
            {p.fixes.map((f, i) => (
              <li key={i}><s>{f.from}</s> → <mark>{f.to}</mark></li>
            ))}
          </ul>
          <span className="muted">Si alguna corrección está mal, edita el texto antes de interpretar.</span>
        </div>
      )}

      <div className="actions">
        {p.voiceEnabled && (
          <button
            type="button"
            className={p.recording ? 'recording' : ''}
            disabled={p.busy && !p.recording}
            onClick={p.recording ? p.onStop : p.onRecord}
            aria-pressed={p.recording}
          >
            {p.recording ? '■ Detener y transcribir' : '🎙 Dictar'}
          </button>
        )}
        <button
          type="button"
          className="primary"
          disabled={p.busy || p.recording || !p.text.trim() || !p.modelsReady}
          onClick={p.onExtract}
        >
          Interpretar con QVAC
        </button>
        {p.timings.extract && !p.busy && (
          <span className="hint muted">suele tardar {fmt(p.timings.extract.avgMs)}</span>
        )}
      </div>

      <p className="status-line" role="status" aria-live="polite">{p.message}</p>
    </section>
  )
}
