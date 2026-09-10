// Capa de trabajo sobre EL RECUADRO que está trabajando, no sobre la pantalla.
//
// Josué, dos veces: "que sobre el recuadro que está trabajando pudiera hacerse
// una capa por encima donde aparezca el vídeo de carga solo sobre ese cuadro" y
// después "no todo hasta abajo, sino específicamente las áreas que están
// cambiando o por cambiar". Por eso la capa se monta dentro del panel más
// pequeño que de verdad trabaja, no dentro de la sección entera.
//
// Reglas que la hacen útil en vez de molesta:
//   · Va dentro del recuadro (`position: absolute`), así que el resto de la
//     aplicación sigue vivo y clicable.
//   · Deja ver lo que hay debajo: tapa lo justo para que se entienda.
//   · Bloquea la entrada SOLO en su recuadro, que es lo que se pidió para el
//     cuadro del dictado: mientras se dicta no se escribe encima.
//   · El texto va DEBAJO del logo y sin nombres de modelo: quien usa la
//     aplicación no tiene por qué saber que existe Gemma.
//   · Aparece y se va en fundido, y una vez visible se queda un mínimo. Sin eso,
//     una tarea corta la enciende y la apaga en dos fotogramas y se lee como un
//     fallo, no como una carga.

import { useEffect, useRef, useState, type JSX } from 'react'
import type { ThemeId } from '../assets/themes.ts'
import { LogoMotion } from './LogoMotion.tsx'

// Dos ritmos. La capa de una tarea de verdad (dictar, interpretar, generar un
// reporte) tarda en aparecer y se queda un mínimo, para que no parpadee. La
// capa suave de un cambio de vista es casi instantánea: sombrear un segundo
// entero un cambio de pestaña que tarda dos fotogramas estorba más que ayuda.
const RITMO = {
  tarea: { umbral: 130, minimo: 560, salida: 300 },
  suave: { umbral: 0, minimo: 240, salida: 220 }
}

interface Props {
  /** Si no, no se pinta nada y el recuadro queda intacto. */
  active: boolean
  theme: ThemeId
  /** Qué está pasando, en palabras y sin jerga. Obligatorio. */
  label: string
  /** Segunda línea opcional. */
  hint?: string
  /** Capa suave: solo sombrea, para áreas que se están recalculando. */
  soft?: boolean
}

export function BusyOverlay({ active, theme, label, hint, soft }: Props): JSX.Element | null {
  const { umbral, minimo, salida } = soft ? RITMO.suave : RITMO.tarea
  const [visible, setVisible] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  // El estado vive en refs: si entrara en las dependencias del efecto, cada
  // cambio lo reiniciaría y la capa no se iría nunca. Pasó, y se veía.
  const desde = useRef(0)
  const timers = useRef<number[]>([])

  useEffect(() => {
    const limpiar = (): void => { timers.current.forEach(clearTimeout); timers.current = [] }
    limpiar()

    if (active) {
      timers.current.push(
        window.setTimeout(() => { desde.current = Date.now(); setSaliendo(false); setVisible(true) }, umbral)
      )
      return limpiar
    }

    if (desde.current === 0) return limpiar
    const espera = Math.max(0, minimo - (Date.now() - desde.current))
    timers.current.push(
      window.setTimeout(() => {
        setSaliendo(true)
        timers.current.push(
          window.setTimeout(() => { setVisible(false); setSaliendo(false); desde.current = 0 }, salida)
        )
      }, espera)
    )
    return limpiar
  }, [active, umbral, minimo, salida])

  if (!visible) return null
  return (
    <div className={`busy${saliendo ? ' saliendo' : ''}${soft ? ' suave' : ''}`} role="status" aria-live="polite">
      <div className="busy-box">
        <LogoMotion size="inline" theme={theme} />
        <b>{label}</b>
        {hint && <span className="muted">{hint}</span>}
      </div>
    </div>
  )
}
