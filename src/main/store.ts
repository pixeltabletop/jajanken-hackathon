// Único acceso a disco. Dos archivos en userData: observations.json y embeddings.json.
// Sin Electron dentro: recibe los directorios, así el humo del motor lo usa desde Node.

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { diffObservation } from '../shared/reports.ts'
import { record, type TimingKey, type TimingTable } from '../shared/timings.ts'
import type { Customer, Equipment, Observation, Revision } from '../shared/types.ts'
import type { VectorCache } from './qvac/dedup.ts'

/** Preferencias del usuario. `theme` en null = todavía no eligió (primera vez). */
export interface Settings {
  operator: string
  theme: string | null
}

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
  const timePath = join(opts.userDataDir, 'timings.json')
  const setPath = join(opts.userDataDir, 'settings.json')
  let observations: Observation[] | null = null
  let timings: TimingTable | null = null
  let settings: Settings | null = null

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

    /**
     * Guarda una observación. Si ya existía, calcula qué cambió y lo apila en
     * `history` antes de reemplazarla: editar nunca borra lo anterior, porque
     * la trazabilidad de las correcciones es parte de la confianza en el dato.
     */
    async save(obs: Observation, by = 'Técnico de campo'): Promise<Observation[]> {
      const all = await ensureLoaded()
      const i = all.findIndex((o) => o.id === obs.id)
      let next = obs
      if (i >= 0) {
        const before = all[i]
        const changes = diffObservation(before, obs)
        if (changes.length) {
          const { history: _drop, ...snapshot } = before
          const rev: Revision = { at: new Date().toISOString(), by, changes, before: snapshot }
          next = { ...obs, history: [rev, ...(before.history ?? [])].slice(0, 50) }
        } else {
          next = { ...obs, history: before.history ?? [] }
        }
        all[i] = next
      } else {
        all.push(next)
      }
      await writeFile(obsPath, JSON.stringify(all, null, 2))
      return [...all]
    },

    async getSettings(): Promise<Settings> {
      const raw = settings ?? (await readJson<Partial<Settings>>(setPath, {}))
      settings = { operator: raw.operator ?? 'Técnico de campo', theme: raw.theme ?? null }
      return settings
    },

    async setSettings(patch: Partial<Settings>): Promise<Settings> {
      const current = await this.getSettings()
      settings = { ...current, ...patch }
      await mkdir(opts.userDataDir, { recursive: true })
      await writeFile(setPath, JSON.stringify(settings, null, 2))
      return settings
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

    /**
     * Ciudad conocida que aparece literal en la nota, o null. Determinista y
     * auditable: solo devuelve algo si el texto contiene el nombre exacto de una
     * ciudad ya registrada. Gana la coincidencia más larga.
     */
    async inferCityFromText(text: string): Promise<string | null> {
      const hay = ` ${text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')} `
      let best: string | null = null
      for (const o of await ensureLoaded()) {
        if (!o.city) continue
        const key = o.city.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        if (hay.includes(key) && (!best || o.city.length > best.length)) best = o.city
      }
      return best
    },

    /**
     * Listas cerradas con las que se construye el prompt de la pregunta en
     * español y se resuelven sus índices. Ordenadas siempre igual: el banco de
     * mediciones tiene que ver exactamente el mismo orden que la app.
     */
    async queryContext(): Promise<{ countries: string[]; cities: string[] }> {
      const all = await ensureLoaded()
      const countries = [...new Set(all.map((o) => o.country).filter((c): c is string => !!c))].sort()
      const cities = [...new Set(all.map((o) => o.city).filter((c): c is string => !!c))].sort()
      return { countries, cities }
    },

    /** Ciudades ya registradas, agrupadas por país. Alimenta el desplegable. */
    async citiesByCountry(): Promise<Record<string, string[]>> {
      const map: Record<string, Set<string>> = {}
      for (const o of await ensureLoaded()) {
        if (!o.country || !o.city) continue
        ;(map[o.country] ??= new Set()).add(o.city)
      }
      return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].sort()]))
    },

    async getTimings(): Promise<TimingTable> {
      timings ??= await readJson<TimingTable>(timePath, {})
      return timings
    },

    /** Acumula una medición y la persiste. Los promedios sobreviven al cierre. */
    async recordTiming(key: TimingKey, ms: number): Promise<TimingTable> {
      const current = timings ?? (await readJson<TimingTable>(timePath, {}))
      timings = record(current, key, ms)
      await mkdir(opts.userDataDir, { recursive: true })
      await writeFile(timePath, JSON.stringify(timings, null, 2))
      return timings
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
