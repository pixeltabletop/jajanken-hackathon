// Momento 1 del logo: el arranque. Cinco segundos mínimos aunque los modelos ya
// estén listos, porque es el momento de marca.
//
// El pie legal va visible DURANTE el arranque: cinco segundos de un logo de
// Philips a pantalla completa es justo donde alguien puede confundir el
// prototipo con un producto de la marca.

import { useCallback, useEffect, useState, type JSX } from 'react'
import type { ThemeId } from '../assets/themes.ts'
import { fmt, type TimingTable } from '../../../shared/timings.ts'
import type { ModelStatus } from '../../../shared/types.ts'
import { LogoMotion } from './LogoMotion.tsx'

/**
 * El arranque dura exactamente esto. Es el momento de marca, y se acabó.
 *
 * Antes esperaba además a que los tres modelos estuvieran listos, así que el
 * usuario miraba una pantalla fija hasta 57 s. Ya no: los modelos siguen
 * cargando detrás, el encabezado dice en qué van y cada modo avisa de lo que
 * todavía no puede hacer. Dictar funciona desde el primer segundo.
 */
export const SPLASH_MIN_MS = 5000
/** Salida en fundido, para que no sea un corte seco. */
const FADE_MS = 420

interface Props {
  theme: ThemeId
  status: ModelStatus | null
  timings: TimingTable
  observations: number
  onDone: () => void
}

export function Splash({ theme, status, timings, observations, onDone }: Props): JSX.Element {
  const [elapsed, setElapsed] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const ready = !!status && status.gemma.state === 'ready' && status.whisper.state === 'ready' && status.embed.state === 'ready'

  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Date.now() - t0), 200)
    return () => clearInterval(id)
  }, [])

  const canSkip = elapsed >= SPLASH_MIN_MS

  // Salida en fundido: se marca la capa y se cede el paso al terminar.
  const leave = useCallback(() => {
    setLeaving((l) => {
      if (!l) setTimeout(onDone, FADE_MS)
      return true
    })
  }, [onDone])

  // A los 5 s se sale, estén o no listos los modelos.
  useEffect(() => {
    if (canSkip) leave()
  }, [canSkip, leave])

  // Esc o clic, solo después del mínimo.
  useEffect(() => {
    if (!canSkip) return
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') leave() }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [canSkip, leave])

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
      className={`splash${leaving ? ' leaving' : ''}`}
      onClick={canSkip ? leave : undefined}
      role={canSkip ? 'button' : undefined}
      tabIndex={canSkip ? 0 : undefined}
      onKeyDown={canSkip ? (e) => { if (e.key === 'Enter' || e.key === ' ') leave() } : undefined}
      aria-label={canSkip ? 'Continuar al inicio' : undefined}
    >
      <div className="splash-center">
        <LogoMotion size="splash" theme={theme} />
        <h1 className="splash-name">Eco <span>· Jajanken</span></h1>
        <p className="splash-line" aria-live="polite">{line}</p>
        {timings['load:all'] && !ready && (
          <p className="splash-hint muted">El arranque completo suele tardar {fmt(timings['load:all'].avgMs)}</p>
        )}
        {!ready && (
          <p className="splash-hint muted">
            Puedes empezar a dictar en cuanto entres: los modelos terminan de cargar detrás.
          </p>
        )}
      </div>
      <footer className="splash-legal">
        <b>Prototipo del equipo Jajanken para el reto Philips</b> · Hackathon ISD Summit 2026 ·
        No es un producto oficial de Philips. Datos sintéticos.
      </footer>
    </div>
  )
}
