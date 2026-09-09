import type { JSX } from 'react'
import type { ModelKey, ModelStatus } from '../../../shared/types.ts'
import philipsLogo from '../assets/philips-logo.svg'

const LABEL: Record<ModelKey, string> = { gemma: 'Extracción', whisper: 'Voz', embed: 'Dedup' }
const STATE_ES = { idle: 'en espera', loading: 'cargando', ready: 'listo', error: 'error' } as const

export function Header({ status }: { status: ModelStatus | null }): JSX.Element {
  return (
    <header>
      <div>
        <img className="philips-logo" src={philipsLogo} alt="Philips" />
        <small>INSTALLED BASE INTELLIGENCE</small>
        <h1>FieldLens</h1>
      </div>
      <div className="pills" aria-live="polite" aria-label="Estado de los modelos locales">
        {(['gemma', 'whisper', 'embed'] as ModelKey[]).map((k) => {
          const s = status?.[k]
          const st = s?.state ?? 'idle'
          return (
            <span key={k} className={`pill ${st}`} title={s?.error ?? (s?.ms ? `${(s.ms / 1000).toFixed(0)} s` : '')}>
              {LABEL[k]} · {STATE_ES[st]}
            </span>
          )
        })}
        <b>● 100% local · sin nube</b>
      </div>
    </header>
  )
}
