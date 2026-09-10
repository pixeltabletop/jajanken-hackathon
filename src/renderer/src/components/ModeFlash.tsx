// El cruce entre pantallas: la marca animada aparece al centro del área de
// trabajo mientras el modo nuevo se monta detrás.
//
// Josué lo pidió así: "entre selecciones de páginas diferentes, al menos medio
// segundo o un segundo de la animación como transitorio", con una condición que
// manda sobre todo lo demás: "que no estorbe en el dinamismo de cómo se
// desenvuelve la aplicación". De ahí las tres reglas:
//
//   1. En CADA cambio de sección, incluido volver al inicio. Josué: "ya sabes
//      que cada transición va a ser lo mismo entre alguna de estas páginas".
//   1b. Solo sobre el panel derecho. La barra lateral es el menú: no cambia, así
//      que no se difumina ni se tapa. Por eso esto va dentro de .workspace y se
//      posiciona en absoluto, no fijo sobre la ventana.
//   2. No bloquea. La capa deja pasar el ratón y el modo nuevo ya está montado
//      debajo, así que quien no quiera esperar simplemente no espera.
//   3. Con `prefers-reduced-motion: reduce` no aparece.

import { useEffect, useState, type JSX } from 'react'
import type { ThemeId } from '../assets/themes.ts'
import { LogoMotion, prefersReducedMotion } from './LogoMotion.tsx'

/**
 * Cuánto dura el cruce.
 *
 * Historia de este número, porque se ajustó tres veces mirándolo: 600 ms con
 * entrada y salida rápidas se leían como un parpadeo, casi como un error. 900 ms
 * ya se veía aparecer y desaparecer, pero seguía sintiéndose brusco al entrar.
 * 1.200 ms con la quinta parte del tiempo para entrar y casi un tercio para
 * salir es donde deja de parecer una interrupción y pasa a parecer que la
 * pantalla está cambiando.
 *
 * El límite de arriba lo pone la impaciencia: por encima de segundo y medio, una
 * persona que ya sabe a dónde va siente que la aplicación la está frenando.
 */
export const FLASH_MS = 1200

export function ModeFlash({ show, theme }: { show: number; theme: ThemeId }): JSX.Element | null {
  const [visible, setVisible] = useState(false)

  // Depende SOLO del contador. Con una función en las dependencias, cada render
  // reiniciaba el temporizador y el destello se quedaba en pantalla.
  useEffect(() => {
    if (!show || prefersReducedMotion()) return
    setVisible(true)
    const id = setTimeout(() => setVisible(false), FLASH_MS)
    return () => clearTimeout(id)
  }, [show])

  if (!visible) return null
  return (
    <div className="mode-flash" aria-hidden="true">
      <LogoMotion size="mark" theme={theme} />
    </div>
  )
}
