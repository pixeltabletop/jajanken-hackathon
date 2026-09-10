// Interruptores de alcance.

// Decisión del miércoles 18:00 con el audio real de Diego. Si la voz muere,
// se pone en false: el botón Dictar desaparece y el README lo declara.
export const VOICE_ENABLED = true

// Se activa solo cuando la consulta mide >= 7/10 sobre el banco de preguntas.
export const QUERY_BAR_ENABLED = false

// Panel interno de tiempos. Está apagado para el usuario: ver cuánto tarda cada
// proceso invita a evaluar el rendimiento de la aplicación, y quien tiene que
// hacer eso somos nosotros, no el técnico de campo ni el jurado.
// Se enciende con Ctrl+Alt+T y queda guardado en este equipo.
export const INTERNAL_KEY = 'mam:panel-interno'

export function internalPanelOn(): boolean {
  try {
    return localStorage.getItem(INTERNAL_KEY) === '1'
  } catch {
    return false
  }
}

export function toggleInternalPanel(): boolean {
  const next = !internalPanelOn()
  try {
    localStorage.setItem(INTERNAL_KEY, next ? '1' : '0')
  } catch { /* sin almacenamiento, se queda apagado */ }
  return next
}
