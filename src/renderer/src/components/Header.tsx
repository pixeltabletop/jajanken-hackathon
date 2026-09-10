import type { JSX } from 'react'
import type { ModelStatus } from '../../../shared/types.ts'
import { fmt, type TimingTable } from '../../../shared/timings.ts'
import type { ThemeId } from '../assets/themes.ts'
import { HeaderMenu, ModelDots, ThemeToggle } from './HeaderBits.tsx'
import { HelpTip } from './HelpTip.tsx'
import { LogoMark } from './LogoMotion.tsx'

interface Props {
  status: ModelStatus | null
  timings: TimingTable
  theme: ThemeId
  onTheme: (t: ThemeId) => void
  /** null en el inicio: desde ahí no hay a dónde volver. */
  onHome: (() => void) | null
  modeLabel: string | null
  /** Cerrar sesión sale del usuario activo; volver al inicio no. */
  onLogout: () => void
  operator: string
}

/**
 * Encabezado en tres zonas: marca a la izquierda, estado de los modelos al
 * centro y controles a la derecha.
 *
 * Antes la derecha llevaba tres píldoras con el nombre y el tiempo de cada
 * modelo, una insignia, un desplegable de tema con su etiqueta y dos botones de
 * texto. Josué: "hay demasiada información arriba a la derecha". Ahora el estado
 * son tres puntos que se encienden, y los controles son dos iconos.
 */
export function Header({ status, timings, theme, onTheme, onHome, modeLabel, onLogout, operator }: Props): JSX.Element {
  const cargando = status
    ? (['whisper', 'embed', 'gemma'] as const).filter((k) => status[k].state !== 'ready').length
    : 3
  return (
    <header>
      <div className="brand">
        <LogoMark size="mark" theme={theme} label="Logo de la aplicación" />
        <div>
          <h1>Eco</h1>
          <p className="tagline">De la voz al dato, sin salir de esta computadora</p>
        </div>
        {modeLabel && <span className="mode-badge">{modeLabel}</span>}
      </div>

      <div className="head-centro">
        <ModelDots status={status} />
        {cargando > 0 && (
          <span className="dots-nota muted">
            {cargando === 1 ? 'falta un modelo' : `faltan ${cargando}`}
            {timings['load:all'] && <> · suele tardar {fmt(timings['load:all'].avgMs)}</>}
          </span>
        )}
      </div>

      <div className="head-acciones">
        <span className="local-badge">
          100% local
          <HelpTip termKey="local" align="right" />
        </span>
        <ThemeToggle value={theme} onChange={onTheme} />
        <HeaderMenu onHome={onHome} onLogout={onLogout} operator={operator} />
      </div>
    </header>
  )
}
