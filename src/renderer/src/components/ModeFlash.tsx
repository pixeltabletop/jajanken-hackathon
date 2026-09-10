// El cruce entre pantallas: la marca animada aparece al centro medio segundo
// mientras el modo nuevo se monta detrás.
//
// Josué lo pidió así: "entre selecciones de páginas diferentes, al menos medio
// segundo o un segundo de la animación como transitorio", con una condición que
// manda sobre todo lo demás: "que no estorbe en el dinamismo de cómo se
// desenvuelve la aplicación". De ahí las tres reglas:
//
//   1. Solo al ENTRAR a un modo desde el inicio. Volver al inicio no lo lleva:
//      repetir la marca en cada regreso la convierte en ruido.
//   2. No bloquea. La capa deja pasar el ratón y el modo nuevo ya está montado
//      debajo, así que quien no quiera esperar simplemente no espera.
//   3. Con `prefers-reduced-motion: reduce` no aparece.

import { useEffect, useState, type JSX } from 'react'
import type { ThemeId } from '../assets/themes.ts'
import { LogoMotion, prefersReducedMotion } from './LogoMotion.tsx'

/**
 * Cuánto dura el cruce. Josué pidió "al menos medio segundo o un segundo", y
 * después que no pareciera un glitch: 600 ms con entrada y salida rápidas se
 * leían como un parpadeo. Ahora son 900 ms con un cuarto de ese tiempo para
 * entrar y otro cuarto para salir, así que se ve aparecer y desaparecer.
 */
export const FLASH_MS = 900

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
