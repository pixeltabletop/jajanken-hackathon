// Resolución de entidades por embeddings. Ranking más desempate por ciudad.
// NUNCA umbral fijo: "Hospital DemoCare North" y "Hospital DemoCare Metro North"
// tienen similitud 0.912 y el margen correcto medido fue 0.05. Un umbral los funde.
// bench/embed_EMBEDDINGGEMMA_300M_Q8_0.json

import * as sdk from '@qvac/sdk'
import type { Customer, DedupResult } from '../../shared/types.ts'

export type VectorCache = Record<string, number[]>

export interface CanonicalCustomer extends Customer {
  vector: number[]
}

export function cosine(a: number[], b: number[]): number {
  let d = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return d / (Math.sqrt(na) * Math.sqrt(nb))
}

export async function embedText(embedId: string, text: string): Promise<number[]> {
  const r = await sdk.embed({ modelId: embedId, text })
  return r.embedding
}

/** Vectoriza solo los clientes que no están en caché. ~1.5 s por vector, por eso se cachea. */
export async function buildCanonical(
  embedId: string,
  customers: Customer[],
  cache: VectorCache
): Promise<{ canonical: CanonicalCustomer[]; cache: VectorCache; embedded: number }> {
  const out: CanonicalCustomer[] = []
  let embedded = 0
  for (const c of customers) {
    let v = cache[c.name]
    if (!v) {
      v = await embedText(embedId, c.name)
      cache[c.name] = v
      embedded++
    }
    out.push({ ...c, vector: v })
  }
  return { canonical: out, cache, embedded }
}

const norm = (s: string | null): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

export const DEDUP_RULES = {
  topN: 3,
  /** Si el 1º no comparte ciudad y el 2º sí, y están a menos de esto, se propone el 2º. */
  cityMargin: 0.08,
  /** Bajo esto, se propone "cliente nuevo". */
  newCustomerFloor: 0.75
} as const

export async function rankCandidates(
  embedId: string,
  facility: string,
  city: string | null,
  canonical: CanonicalCustomer[]
): Promise<DedupResult> {
  if (canonical.length === 0) {
    return { candidates: [], suggestion: null, reason: 'No hay clientes registrados todavía' }
  }
  const v = await embedText(embedId, facility)
  const ranked = canonical
    .map((c) => ({
      name: c.name,
      city: c.city,
      country: c.country,
      score: cosine(v, c.vector),
      sameCity: !!city && norm(c.city) === norm(city)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, DEDUP_RULES.topN)

  const [first, second] = ranked
  if (first.score < DEDUP_RULES.newCustomerFloor) {
    return { candidates: ranked, suggestion: null, reason: `Mejor coincidencia ${first.score.toFixed(2)}, por debajo del piso ${DEDUP_RULES.newCustomerFloor}` }
  }
  if (first.sameCity) {
    return { candidates: ranked, suggestion: first.name, reason: 'Mejor puntaje y misma ciudad' }
  }
  if (second && second.sameCity && first.score - second.score < DEDUP_RULES.cityMargin) {
    return { candidates: ranked, suggestion: second.name, reason: `Desempate por ciudad: ${second.name} comparte ciudad y está a ${(first.score - second.score).toFixed(3)} del primero` }
  }
  if (!city) {
    return { candidates: ranked, suggestion: first.name, reason: 'Mejor puntaje, sin ciudad para desempatar' }
  }
  return { candidates: ranked, suggestion: first.name, reason: 'Mejor puntaje, ciudad distinta a la registrada: revisar' }
}
