// Único acceso a disco. Dos archivos en userData: observations.json y embeddings.json.
// Sin Electron dentro: recibe los directorios, así el humo del motor lo usa desde Node.

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Customer, Equipment, Observation } from '../shared/types.ts'
import type { VectorCache } from './qvac/dedup.ts'

export interface StoreOptions {
  /** Dónde persistir. En Electron, app.getPath('userData'). */
  userDataDir: string
  /** Dónde viven los seed-*.json. En Electron, join(app.getAppPath(), 'data'). */
  seedDir: string
}

type Snake = Record<string, unknown>

// data/seed-panama.json viene del banco en snake_case. Se normaliza al cargar.
function equipmentFromSeed(e: Snake, year: number): Equipment {
  const age = typeof e.approx_age_years === 'number' ? e.approx_age_years : null
  return {
    modality: e.modality as Equipment['modality'],
    quantity: Number(e.quantity),
    quantityIsEstimate: Boolean(e.quantity_is_estimate),
    brand: (e.brand as Equipment['brand']) ?? null,
    model: (e.model as string | null) ?? null,
    approxAgeYears: age,
    ageQualitative: (e.age_qualitative as Equipment['ageQualitative']) ?? null,
    installYearEstimate: age !== null ? year - age : null,
    confidence: e.confidence as Equipment['confidence'],
    status: e.status as Equipment['status'],
    evidence: String(e.evidence ?? ''),
    notes: (e.notes as string | null) ?? null
  }
}

function observationFromSeed(o: Snake): Observation {
  const createdAt = String(o.createdAt ?? o.created_at ?? new Date().toISOString().slice(0, 10))
  const year = Number(createdAt.slice(0, 4))
  const facility = String(o.facility)
  return {
    id: String(o.id),
    createdAt,
    observer: String(o.observer ?? 'Semilla'),
    source: 'Seed',
    language: (o.language as Observation['language']) ?? 'es',
    rawText: String(o.rawText ?? o.raw_text ?? ''),
    facility,
    facilityCanonical: facility,
    city: (o.city as string | null) ?? null,
    country: (o.country as string | null) ?? null,
    equipment: ((o.equipment as Snake[]) ?? []).map((e) => equipmentFromSeed(e, year)),
    missingFields: (o.missingFields as string[]) ?? (o.missing_fields as string[]) ?? [],
    reviewed: true
  }
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  if (!existsSync(path)) return fallback
  return JSON.parse(await readFile(path, 'utf8')) as T
}

export function createStore(opts: StoreOptions) {
  const obsPath = join(opts.userDataDir, 'observations.json')
  const vecPath = join(opts.userDataDir, 'embeddings.json')
  let observations: Observation[] | null = null

  async function loadSeeds(): Promise<Observation[]> {
    const out: Observation[] = []
    for (const file of ['seed-philips.json', 'seed-panama.json']) {
      const raw = await readJson<{ observations?: Snake[] } | Snake[]>(join(opts.seedDir, file), [])
      const list = Array.isArray(raw) ? raw : (raw.observations ?? [])
      for (const o of list) out.push(observationFromSeed(o))
    }
    return out
  }

  async function ensureLoaded(): Promise<Observation[]> {
    if (observations) return observations
    await mkdir(opts.userDataDir, { recursive: true })
    const existing = await readJson<Observation[] | null>(obsPath, null)
    if (existing && existing.length) {
      observations = existing
    } else {
      observations = await loadSeeds()
      await writeFile(obsPath, JSON.stringify(observations, null, 2))
    }
    return observations
  }

  return {
    async list(): Promise<Observation[]> {
      return [...(await ensureLoaded())]
    },

    async save(obs: Observation): Promise<Observation[]> {
      const all = await ensureLoaded()
      const i = all.findIndex((o) => o.id === obs.id)
      if (i >= 0) all[i] = obs
      else all.push(obs)
      await writeFile(obsPath, JSON.stringify(all, null, 2))
      return [...all]
    },

    /** Clientes únicos por nombre canónico, para Whisper y para deduplicación. */
    async customers(): Promise<Customer[]> {
      const seen = new Map<string, Customer>()
      for (const o of await ensureLoaded()) {
        const name = o.facilityCanonical ?? o.facility
        if (!seen.has(name)) seen.set(name, { name, city: o.city, country: o.country })
      }
      return [...seen.values()]
    },

    /** País más frecuente para una ciudad conocida, o null. La extracción no lo adivina. */
    async inferCountry(city: string | null): Promise<string | null> {
      if (!city) return null
      const key = city.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      const counts = new Map<string, number>()
      for (const o of await ensureLoaded()) {
        const c = o.city?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        if (c === key && o.country) counts.set(o.country, (counts.get(o.country) ?? 0) + 1)
      }
      let best: string | null = null
      let n = 0
      for (const [country, k] of counts) if (k > n) { best = country; n = k }
      return best
    },

    async getVectors(): Promise<VectorCache> {
      return readJson<VectorCache>(vecPath, {})
    },

    async setVectors(cache: VectorCache): Promise<void> {
      await mkdir(opts.userDataDir, { recursive: true })
      await writeFile(vecPath, JSON.stringify(cache))
    }
  }
}

export type Store = ReturnType<typeof createStore>
