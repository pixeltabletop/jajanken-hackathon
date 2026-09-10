// Piezas del encabezado: semáforo de modelos, interruptor de tema y menú.
//
// Josué: "hay demasiada información arriba a la derecha". Antes había tres
// píldoras con nombre y tiempo de cada modelo, una insignia, un desplegable de
// tema con su etiqueta y dos botones de texto. Ahora:
//
//   · Al centro, tres puntos que se encienden según se alistan los modelos. Al
//     pasar el cursor, cada uno dice cuál es y cuánto tardó.
//   · A la derecha, un sol o una luna que cambia el tema de un clic, y un menú
//     de tres puntos con volver al inicio y cerrar sesión.
//
// Los iconos son SVG en línea: ninguna dependencia nueva, y heredan el color del
// tema con `currentColor`.

import { useEffect, useRef, useState, type JSX } from 'react'
import { fmt } from '../../../shared/timings.ts'
import type { ModelKey, ModelStatus } from '../../../shared/types.ts'
import type { ThemeId } from '../assets/themes.ts'

// ---------------------------------------------------------------- iconos

const Sol = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.4v2.2M12 19.4v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.4 12h2.2M19.4 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </svg>
)

const Luna = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a6.8 6.8 0 0 0 11.1 11.1Z" />
  </svg>
)

const TresPuntos = (): JSX.Element => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="12" cy="19" r="1.9" />
  </svg>
)

// ---------------------------------------------------------------- semáforo

const NOMBRE: Record<ModelKey, string> = { whisper: 'Voz', embed: 'Deduplicación', gemma: 'Extracción' }
const ESTADO = { idle: 'en espera', loading: 'cargando', ready: 'listo', error: 'error' } as const

/** Tres puntos que se encienden según se alistan los modelos. */
export function ModelDots({ status }: { status: ModelStatus | null }): JSX.Element {
  const keys: ModelKey[] = ['whisper', 'embed', 'gemma']
  const listos = keys.filter((k) => status?.[k].state === 'ready').length
  const resumen = keys
    .map((k) => {
      const s = status?.[k]
      const est = s?.state ?? 'idle'
      return `${NOMBRE[k]}: ${est === 'ready' && s?.ms ? fmt(s.ms) : ESTADO[est]}`
    })
    .join(' · ')

  return (
    <div
      className="dots"
      title={`${listos} de 3 listos · ${resumen}`}
      role="img"
      aria-label={`Modelos locales, ${listos} de 3 listos. ${resumen}`}
    >
      {keys.map((k) => {
        const s = status?.[k]
        const est = s?.state ?? 'idle'
        return (
          <span
            key={k}
            className={`dot ${est}`}
            title={`${NOMBRE[k]}: ${est === 'ready' && s?.ms ? `lista en ${fmt(s.ms)}` : ESTADO[est]}`}
          />
        )
      })}
      {/* La cuenta solo mientras faltan. Con los tres verdes, los puntos ya lo dicen. */}
      {listos < 3 && <span className="dots-label">{listos}/3</span>}
    </div>
  )
}

// ---------------------------------------------------------------- tema

/**
 * Un clic cambia de tema. El icono muestra el tema ACTUAL: sol con el claro,
 * luna con el oscuro. Nada de etiquetas.
 */
export function ThemeToggle({ value, onChange }: { value: ThemeId; onChange: (t: ThemeId) => void }): JSX.Element {
  const claro = value === 'blanco'
  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={() => onChange(claro ? 'negro' : 'blanco')}
      aria-label={claro ? 'Tema claro. Cambiar a oscuro' : 'Tema oscuro. Cambiar a claro'}
      title={claro ? 'Tema claro · cambiar a oscuro' : 'Tema oscuro · cambiar a claro'}
      aria-pressed={!claro}
    >
      {claro ? <Sol /> : <Luna />}
    </button>
  )
}

// ---------------------------------------------------------------- menú

interface MenuProps {
  /** null cuando ya estás en el inicio: la opción sale deshabilitada. */
  onHome: (() => void) | null
  onLogout: () => void
  operator: string
}

export function HeaderMenu({ onHome, onLogout, operator }: MenuProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const caja = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const fuera = (e: MouseEvent): void => {
      if (caja.current && !caja.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setOpen(false) }
    // Se escuchan los dos: `mousedown` para que cierre antes de que el clic
    // llegue a otro control, y `click` porque un clic sintético (una prueba, un
    // lector de pantalla) no siempre trae `mousedown` delante.
    document.addEventListener('mousedown', fuera)
    document.addEventListener('click', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('click', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div className="menu" ref={caja}>
      <button
        type="button"
        className="icon-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Opciones"
        title="Opciones"
        onClick={() => setOpen((o) => !o)}
      >
        <TresPuntos />
      </button>
      {open && (
        <div className="menu-list" role="menu">
          <span className="menu-quien">{operator}</span>
          <button
            type="button"
            role="menuitem"
            disabled={onHome === null}
            onClick={() => { setOpen(false); onHome?.() }}
          >
            ← Volver al inicio
            {onHome === null && <span className="muted"> · ya estás aquí</span>}
          </button>
          <button type="button" role="menuitem" className="menu-salir" onClick={() => { setOpen(false); onLogout() }}>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}
