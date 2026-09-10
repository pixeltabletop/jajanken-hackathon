// El logo animado, una sola pieza en tres tamaños. El archivo viaja dentro del
// paquete: la aplicación corre sin internet y ese es el argumento del producto.
// Nunca se carga desde la red.
//
// Chromium reproduce WebM sin dependencia adicional. Sin `muted` la política de
// autoarranque lo bloquea, así que los cuatro atributos van siempre: muted,
// loop, playsInline, autoPlay.
//
// MEDIDO EL 2026-09-09 CONTRA LA APP VIVA (ver DECISIONES, D25):
// las tres piezas se reproducen opacas en este Chromium (alfa 255 en todos los
// píxeles, comprobado leyendo el fotograma en un canvas). La pieza `blanco`
// lleva su escudo negro sobre #f4f8fb y se ve. Las piezas `azul` y `negro` no
// pasan de 16/255 y de 0/255 en ningún canal de ningún fotograma: en pantalla
// son un rectángulo oscuro, sin logo. No se reasigna la tabla de temas ni se
// reanima el archivo (las dos cosas están fuera de alcance): esos dos temas usan
// la marca vectorial que ya estaba en el repositorio hasta que lleguen piezas
// que se vean sobre su fondo.

import { useEffect, useRef, type JSX } from 'react'
import philipsMark from '../assets/philips-logo.svg'
import azulPng from '../assets/logo/azul.png'
import azulWebm from '../assets/logo/azul.webm'
import blancoPng from '../assets/logo/blanco.png'
import blancoWebm from '../assets/logo/blanco.webm'
import negroPng from '../assets/logo/negro.png'
import negroWebm from '../assets/logo/negro.webm'
import type { ThemeId } from '../assets/themes.ts'

// La asignación la confirmó Josué viendo las tres piezas. El nombre del archivo
// de origen no dice a qué tema pertenece: no se deduce, se usa esta tabla.
// `visible` es una medición, no una opinión: bench/logo-variantes.json.
const VARIANT: Record<ThemeId, { webm: string; still: string; visible: boolean }> = {
  blanco: { webm: blancoWebm, still: blancoPng, visible: true },
  azul: { webm: azulWebm, still: azulPng, visible: false },
  negro: { webm: negroWebm, still: negroPng, visible: false }
}

export type LogoSize = 'splash' | 'mark' | 'inline'

const PX: Record<LogoSize, number> = { splash: 240, mark: 96, inline: 40 }

/**
 * Marca fija. Es la que va en el encabezado y en cualquier sitio que no sea una
 * espera: el bucle de 30 s tiene fotogramas donde el escudo no está, y a 96 px
 * eso se lee como un parpadeo. Decisión de Josué el 2026-09-09 viéndolo en
 * pantalla: el vídeo solo para el arranque y los momentos de carga.
 */
export function LogoMark({ size, label = '' }: { size: LogoSize; label?: string }): JSX.Element {
  return (
    <img
      className={`logo logo-${size} logo-fallback`}
      style={{ width: PX[size] }}
      src={philipsMark}
      alt={label}
      {...(label ? {} : { 'aria-hidden': true as const })}
    />
  )
}

/** Segundo del bucle donde la marca está formada. Es el fotograma en reposo. */
const STILL_AT = 22

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface Props {
  size: LogoSize
  theme: ThemeId
  /** Texto alternativo. Vacío cuando el logo acompaña a un texto que ya lo dice. */
  label?: string
}

export function LogoMotion({ size, theme, label = '' }: Props): JSX.Element {
  const ref = useRef<HTMLVideoElement>(null)
  const still = prefersReducedMotion()
  const v = VARIANT[theme] ?? VARIANT.blanco

  // Con movimiento reducido no se anima: el mismo vídeo se congela en el
  // fotograma en reposo, así la marca se ve idéntica y no se mueve nada.
  useEffect(() => {
    const el = ref.current
    if (!el || !still) return
    const seek = (): void => { try { el.currentTime = STILL_AT } catch { /* aún sin metadatos */ } }
    el.addEventListener('loadedmetadata', seek)
    seek()
    return () => el.removeEventListener('loadedmetadata', seek)
  }, [still, theme])

  const a11y = label
    ? { 'aria-label': label, role: 'img' as const }
    : { 'aria-hidden': true as const }

  // Variante que no se ve sobre su fondo (D25): se usa la marca fija.
  if (!v.visible) return <LogoMark size={size} label={label} />

  return (
    <video
      ref={ref}
      className={`logo logo-${size}`}
      style={{ width: PX[size] }}
      src={v.webm}
      poster={v.still}
      width={PX[size]}
      height={Math.round(PX[size] * (840 / 720))}
      autoPlay={!still}
      loop={!still}
      muted
      playsInline
      preload="auto"
      {...a11y}
    />
  )
}
