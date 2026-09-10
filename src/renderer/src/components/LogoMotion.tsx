// La marca de la aplicación, en tres tamaños.
//
// AQUÍ NO HAY VÍDEO, y es una decisión medida (D43). Las tres piezas de 30 s que
// llegaron por Drive se analizaron fotograma a fotograma contra el archivo y
// contra Chromium:
//
//   · `philips-logo-30s-loop.webm` (negro): negro puro en los 882 fotogramas.
//   · `…-hue-neon.webm` (azul): ningún canal pasa de 16 de 255.
//   · `…-light-brand.webm` (blanco): escudo negro sobre #f4f8fb, la única que se
//     veía. Traía la cadencia rota (`avg_frame_rate=0/0`, base de tiempo de
//     1000 fps), y eso es lo que hacía que se reprodujera a tirones. Con la
//     cadencia corregida se ve lo que de verdad contiene: la silueta encendida
//     1.73 s y apagada 1.6 s, en corte seco, repetido. Y dentro del tramo
//     encendido los 51 fotogramas son IDÉNTICOS: cero píxeles de diferencia.
//
// Es decir: el archivo no contiene una animación, contiene una imagen fija que
// parpadea. En pantalla eso no se lee como marca, se lee como un fallo, que es
// exactamente lo que reportó Josué.
//
// Así que la marca es el SVG que ya estaba en el repositorio: vectorial, con el
// escudo Philips de verdad (la silueta del vídeo ni siquiera lo tenía), 3 KB
// frente a 2.5 MB de los tres vídeos, y sin nada que pueda parpadear. El
// movimiento del arranque lo pone una animación CSS que sí controlamos.

import type { JSX } from 'react'
import philipsMark from '../assets/philips-logo.svg'

export type LogoSize = 'splash' | 'mark' | 'inline'

const PX: Record<LogoSize, number> = { splash: 200, mark: 96, inline: 40 }

interface Props {
  size: LogoSize
  /** Texto alternativo. Vacío cuando el logo acompaña a un texto que ya lo dice. */
  label?: string
  /** Entrada animada. Solo el arranque la usa. */
  animated?: boolean
}

export function LogoMark({ size, label = '', animated = false }: Props): JSX.Element {
  return (
    <img
      className={`logo logo-${size}${animated ? ' logo-enter' : ''}`}
      style={{ width: PX[size] }}
      src={philipsMark}
      alt={label}
      {...(label ? {} : { 'aria-hidden': true as const })}
    />
  )
}

/**
 * El nombre que usan el arranque y las esperas. Es la misma marca fija: si algún
 * día llega una pieza animada que se vea, se cambia aquí dentro y no hay que
 * tocar a quien la usa.
 */
export function LogoMotion({ size, label = '' }: { size: LogoSize; theme?: unknown; label?: string }): JSX.Element {
  return <LogoMark size={size} label={label} animated={size === 'splash'} />
}
