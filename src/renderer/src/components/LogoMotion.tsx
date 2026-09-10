// La marca de la aplicación: una pieza animada por tema, en tres tamaños.
//
// SEGUNDA ENTREGA DE LAS PIEZAS (2026-09-10). Las primeras no servían y está
// medido: cadencia rota (`avg_frame_rate=0/0`),
// dos variantes en negro puro, y la única visible resultó ser una imagen fija
// que se encendía 1.73 s y se apagaba 1.6 s. Las nuevas se midieron igual antes
// de montarlas y pasan las tres comprobaciones:
//
//   · 30 fps constante, 900 fotogramas, 30 s exactos.
//   · Movimiento real en TODOS los fotogramas: entre 18 y 76 píxeles cambian de
//     uno al siguiente, sobre una malla de 1.512. Ninguno vacío.
//   · Rango de luminancia completo, y el fondo de cada pieza es exactamente el
//     fondo de su tema: #f4f8fb la clara, #000000 la monocroma.
//
// Reparto, decidido por Josué viéndolas: `light-brand` para el tema claro y
// `monochrome` para el oscuro. Reencodadas a WebM VP9 a 480 px de ancho: 583 KB
// las dos juntas, frente a 2,2 MB de los MP4 originales. Viajan dentro del
// paquete y nunca se cargan desde la red.
//
// Dónde se mueve y dónde no: el vídeo va en el arranque, en el cruce entre modos
// y en las esperas. El encabezado lleva el fotograma fijo, porque un logo que se
// mueve todo el rato en una esquina es ruido, no marca.

import { useEffect, useRef, type JSX } from 'react'
import blancoPng from '../assets/logo/blanco.png'
import blancoWebm from '../assets/logo/blanco.webm'
import negroPng from '../assets/logo/negro.png'
import negroWebm from '../assets/logo/negro.webm'
import type { ThemeId } from '../assets/themes.ts'
import { getTheme } from '../lib/theme.ts'

const VARIANT: Record<ThemeId, { webm: string; still: string }> = {
  blanco: { webm: blancoWebm, still: blancoPng },
  negro: { webm: negroWebm, still: negroPng }
}

export type LogoSize = 'splash' | 'mark' | 'inline'

const PX: Record<LogoSize, number> = { splash: 200, mark: 84, inline: 34 }

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface MarkProps {
  size: LogoSize
  label?: string
  theme?: ThemeId
}

/** Fotograma fijo. El encabezado y cualquier sitio que no sea una espera. */
export function LogoMark({ size, label = '', theme }: MarkProps): JSX.Element {
  const v = VARIANT[theme ?? getTheme()] ?? VARIANT.blanco
  return (
    <img
      className={`logo logo-${size}`}
      style={{ width: PX[size] }}
      src={v.still}
      alt={label}
      {...(label ? {} : { 'aria-hidden': true as const })}
    />
  )
}

interface Props {
  size: LogoSize
  theme: ThemeId
  label?: string
}

/** La pieza animada. Arranque, cruce entre modos y esperas. */
export function LogoMotion({ size, theme, label = '' }: Props): JSX.Element {
  const ref = useRef<HTMLVideoElement>(null)
  const still = prefersReducedMotion()
  const v = VARIANT[theme] ?? VARIANT.blanco

  // Con movimiento reducido no se anima: se muestra el fotograma fijo.
  useEffect(() => {
    const el = ref.current
    if (!el || !still) return
    el.pause()
  }, [still, theme])

  if (still) return <LogoMark size={size} label={label} theme={theme} />

  return (
    <video
      ref={ref}
      className={`logo logo-${size}`}
      style={{ width: PX[size] }}
      src={v.webm}
      poster={v.still}
      width={PX[size]}
      height={Math.round(PX[size] * (840 / 720))}
      autoPlay
      loop
      muted
      playsInline
      preload="auto"
      {...(label ? { 'aria-label': label, role: 'img' as const } : { 'aria-hidden': true as const })}
    />
  )
}
