import type { JSX } from 'react'
import type { ModelKey, ModelStatus } from '../../../shared/types.ts'
import { fmt, type TimingTable } from '../../../shared/timings.ts'
import type { ThemeId } from '../assets/themes.ts'
import { HelpTip } from './HelpTip.tsx'
import { LogoMark } from './LogoMotion.tsx'
import { ThemeSwitch } from './ThemePicker.tsx'

const LABEL: Record<ModelKey, string> = { gemma: 'Extracción', whisper: 'Voz', embed: 'Dedup' }
const STATE_ES = { idle: 'en espera', loading: 'cargando', ready: 'listo', error: 'error' } as const

interface Props {
  status: ModelStatus | null
  timings: TimingTable
  theme: ThemeId
  onTheme: (t: ThemeId) => void
  /** null en el inicio: desde ahí no hay a dónde volver. */
  onHome: (() => void) | null
  modeLabel: string | null
}

export function Header({ status, timings, theme, onTheme, onHome, modeLabel }: Props): JSX.Element {
  const keys: ModelKey[] = ['whisper', 'embed', 'gemma']
  const loading = keys.filter((k) => status?.[k].state === 'loading').length
  return (
    <header>
      <div className="brand">
        <LogoMark size="mark" label="Logo de la aplicación" />
        <div>
          <h1>Eco</h1>
          <p className="tagline">De la voz al dato, sin salir de esta computadora</p>
        </div>
        {modeLabel && <span className="mode-badge">{modeLabel}</span>}
      </div>
      <div className="pills" aria-live="polite" aria-label="Estado de los modelos locales">
        {onHome && (
          <button type="button" className="ghost small home-btn" onClick={onHome}>
            ← Volver al inicio
          </button>
        )}
        <ThemeSwitch value={theme} onChange={onTheme} />
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
