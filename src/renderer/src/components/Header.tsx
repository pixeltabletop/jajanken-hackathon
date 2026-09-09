import type { JSX } from 'react'
import type { ModelKey, ModelStatus } from '../../../shared/types.ts'
import { fmt, type TimingTable } from '../../../shared/timings.ts'
import philipsLogo from '../assets/philips-logo.svg'
import { HelpTip } from './HelpTip.tsx'

const LABEL: Record<ModelKey, string> = { gemma: 'Extracción', whisper: 'Voz', embed: 'Dedup' }
const STATE_ES = { idle: 'en espera', loading: 'cargando', ready: 'listo', error: 'error' } as const

export function Header({ status, timings }: { status: ModelStatus | null; timings: TimingTable }): JSX.Element {
  const keys: ModelKey[] = ['whisper', 'embed', 'gemma']
  const loading = keys.filter((k) => status?.[k].state === 'loading').length
  return (
    <header>
      <div className="brand">
        <img className="philips-logo" src={philipsLogo} alt="Philips" />
        <h1>Eco</h1>
        <p className="tagline">De la voz al dato, sin salir de esta computadora</p>
      </div>
      <div className="pills" aria-live="polite" aria-label="Estado de los modelos locales">
        {keys.map((k) => {
          const s = status?.[k]
          const st = s?.state ?? 'idle'
          return (
            <span key={k} className={`pill ${st}`} title={s?.error ?? (s?.ms ? `Cargó en ${fmt(s.ms)}` : '')}>
              {LABEL[k]} · {st === 'ready' && s?.ms ? fmt(s.ms) : STATE_ES[st]}
            </span>
          )
        })}
        <b className="local-badge">
          100% local · sin nube
          <HelpTip termKey="local" align="right" />
        </b>
        {loading > 0 && (
          <span className="pills-note muted">
            {loading === 1 ? 'Falta un modelo' : `Faltan ${loading} modelos`}
            {timings['load:all'] && <> · suele tardar {fmt(timings['load:all'].avgMs)}</>}
          </span>
        )}
      </div>
    </header>
  )
}
