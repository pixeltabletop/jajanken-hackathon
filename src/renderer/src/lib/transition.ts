// Cambio de modo sin corte seco. 180–220 ms, opacidad más un desplazamiento
// corto. Ligero, casi imperceptible: no es una presentación de diapositivas.
//
// Implementación preferida: document.startViewTransition, que ya trae el
// Chromium de Electron. Reserva en CSS por si la versión empaquetada no lo
// expone: la capa que entra lleva su propia animación, con la clase mode-enter.
// Sin dependencia nueva de animación.
//
// prefers-reduced-motion: reduce se respeta. Sin desplazamiento, solo un fundido
// de 80 ms. Es accesibilidad, no una preferencia estética.

import { flushSync } from 'react-dom'

type DocWithVT = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void>; ready: Promise<void> }
}

export function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Aplica el cambio de modo con transición, aterriza el foco en el primer control
 * del modo nuevo y anuncia el cambio. El teclado sigue al cambio.
 */
export function transitionTo(apply: () => void, focusId?: string): void {
  const doc = document as DocWithVT
  const after = (): void => {
    if (!focusId) return
    // Un fotograma después: el modo nuevo ya está en el árbol.
    requestAnimationFrame(() => {
      const el = document.getElementById(focusId)
      if (el instanceof HTMLElement) el.focus({ preventScroll: true })
    })
  }

  if (reducedMotion() || typeof doc.startViewTransition !== 'function') {
    apply()
    after()
    return
  }
  const vt = doc.startViewTransition(() => flushSync(apply))
  void vt.finished.then(after).catch(after)
}

/** Escribe en la región viva del documento. "Modo Seguimiento". */
export function announce(text: string): void {
  const el = document.getElementById('mode-live')
  if (el) el.textContent = text
}
