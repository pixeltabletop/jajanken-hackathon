// Momento 1 del logo: el arranque. Cinco segundos mínimos aunque los modelos ya
// estén listos, porque es el momento de marca.
//
// El pie legal va visible DURANTE el arranque: cinco segundos de un logo de
// Philips a pantalla completa es justo donde alguien puede confundir el
// prototipo con un producto de la marca.

import { useEffect, useState, type JSX } from 'react'
import type { ThemeId } from '../assets/themes.ts'
import { fmt, type TimingTable } from '../../../shared/timings.ts'
import type { ModelStatus } from '../../../shared/types.ts'
import { LogoMotion } from './LogoMotion.tsx'

/** Mínimo de marca. No se puede saltar antes. */
export const SPLASH_MIN_MS = 5000
/** A partir de aquí se ofrece continuar con los modelos aún cargando. */
const ESCAPE_MS = 15000

interface Props {
  theme: ThemeId
  status: ModelStatus | null
  timings: TimingTable
  observations: number
  onDone: () => void
}

export function Splash({ theme, status, timings, observations, onDone }: Props): JSX.Element {
  const [elapsed, setElapsed] = useState(0)
  const ready = !!status && status.gemma.state === 'ready' && status.whisper.state === 'ready' && status.embed.state === 'ready'

  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - t0), 200)
    return () => clearInterval(id)
  }, [])

  const canSkip = elapsed >= SPLASH_MIN_MS

  // Se sale solo cuando se cumplió el mínimo y los modelos están listos.
  useEffect(() => {
    if (canSkip && ready) onDone()
  }, [canSkip, ready, onDone])

  // Esc o clic, solo después del mínimo.
  useEffect(() => {
    if (!canSkip) return
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') onDone() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [canSkip, onDone])

  // El texto dice lo que de verdad está pasando, nunca un mensaje genérico.
  const pending = status
    ? (['gemma', 'whisper', 'embed'] as const).filter((k) => status[k].state !== 'ready')
    : []
  const NAME = { gemma: 'Gemma 2B', whisper: 'Whisper Base', embed: 'EmbeddingGemma 300M' }
  const line = ready
    ? `Base lista · ${observations} observaciones en esta computadora`
    : pending.length
      ? `Cargando ${NAME[pending[0]]} · local · sin red${pending.length > 1 ? ` · faltan ${pending.length}` : ''}`
      : 'Preparando sesión…'

  return (
    <div
      className="splash"
      onClick={canSkip ? onDone : undefined}
      role={canSkip ? 'button' : undefined}
      tabIndex={canSkip ? 0 : undefined}
      onKeyDown={canSkip ? (e) => { if (e.key === 'Enter' || e.key === ' ') onDone() } : undefined}
      aria-label={canSkip ? 'Continuar al inicio' : undefined}
    >
      <div className="splash-center">
        <LogoMotion size="splash" theme={theme} />
        <h1 className="splash-name">Eco <span>· Jajanken</span></h1>
        <p className="splash-line" aria-live="polite">{line}</p>
        {timings['load:all'] && !ready && (
          <p className="splash-hint muted">El arranque completo suele tardar {fmt(timings['load:all'].avgMs)}</p>
        )}
        {canSkip && !ready && <p className="splash-hint muted">Pulsa Esc para continuar</p>}
        {elapsed >= ESCAPE_MS && !ready && (
          <button type="button" className="ghost" onClick={onDone}>Continuar de todos modos</button>
        )}
      </div>
      <footer className="splash-legal">
        <b>Prototipo del equipo Jajanken para el reto Philips</b> · Hackathon ISD Summit 2026 ·
        No es un producto oficial de Philips. Datos sintéticos.
      </footer>
    </div>
  )
}
