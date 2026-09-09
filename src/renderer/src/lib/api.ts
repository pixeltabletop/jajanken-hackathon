// Envoltorio mínimo sobre window.api. Convierte { error } en excepción para que
// los componentes usen try/catch y muestren el mensaje en el área de estado.

import type { ApiError } from '../../../shared/types.ts'

export function isApiError(x: unknown): x is ApiError {
  return !!x && typeof x === 'object' && 'error' in (x as Record<string, unknown>)
}

export async function call<T>(p: Promise<T | ApiError>): Promise<T> {
  const r = await p
  if (isApiError(r)) throw new Error(r.error.message)
  return r
}
