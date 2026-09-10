// Handlers IPC. Cada uno delega a un módulo del motor o al almacén.
// Nunca lanzan al renderer: devuelven { error: { code, message } }.
// Este es el único archivo del motor que importa Electron.

import { app, dialog, ipcMain, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { BRANDS } from '../shared/catalog.ts'
import { REPORT_BY_KIND, type ReportRequest } from '../shared/reports.ts'
import { renderReportPdf } from './reports.ts'
import type { QueryPlan } from '../shared/query-engine.ts'
import type { TimingTable } from '../shared/timings.ts'
import type {
  ApiError,
  DedupResult,
  ExtractResult,
  Language,
  ModelStatus,
  Observation,
  TranscribeResult
} from '../shared/types.ts'
import { buildCanonical, rankCandidates } from './qvac/dedup.ts'
import { extractObservation } from './qvac/extract.ts'
import { parseQuestion } from './qvac/query.ts'
import * as models from './qvac/models.ts'
import { transcribeWav } from './qvac/transcribe.ts'
import type { Settings, Store } from './store.ts'

type Handler<A extends unknown[], R> = (...args: A) => Promise<R> | R

function safe<A extends unknown[], R>(code: string, fn: Handler<A, R>) {
  return async (_e: unknown, ...args: A): Promise<R | ApiError> => {
    try {
      return await fn(...args)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error(`[ipc:${code}]`, message)
      return { error: { code, message } }
    }
  }
}

export function registerIpc(store: Store): void {
  ipcMain.handle('models:status', safe<[], ModelStatus>('MODELS_STATUS', () => models.getModelStatus()))

  ipcMain.handle('models:warmup', safe<[], ModelStatus>('MODELS_WARMUP', async () => {
    const customers = await store.customers()
    const t0 = Date.now()
    const st = await models.warmup(customers.map((c) => c.name))
    if (st.gemma.state === 'ready' && st.whisper.state === 'ready' && st.embed.state === 'ready') {
      await store.recordTiming('load:all', Date.now() - t0)
      if (st.gemma.ms) await store.recordTiming('load:gemma', st.gemma.ms)
      if (st.whisper.ms) await store.recordTiming('load:whisper', st.whisper.ms)
      if (st.embed.ms) await store.recordTiming('load:embed', st.embed.ms)
    }
    return st
  }))

  ipcMain.handle('timings:get', safe<[], TimingTable>('TIMINGS', () => store.getTimings()))

  ipcMain.handle('data:cities', safe<[], Record<string, string[]>>('CITIES', () => store.citiesByCountry()))

  ipcMain.handle('audio:transcribe', safe<[{ wav: Uint8Array | ArrayBuffer }], TranscribeResult>('TRANSCRIBE', async ({ wav }) => {
    const bytes = wav instanceof Uint8Array ? wav : new Uint8Array(wav)
    const customers = (await store.customers()).map((c) => c.name)
    // El dictado se puede empezar desde que abre la app. Si el audio llega antes
    // de que Whisper termine de cargar, se espera aquí en vez de fallar: grabar
    // no necesita ningún modelo, y transcribir solo necesita este.
    const r = await models.withModel('whisper', customers, (id) =>
      transcribeWav(id, bytes, { brands: BRANDS, customers })
    )
    await store.recordTiming('transcribe', r.ms)
    return r
  }))

  ipcMain.handle('obs:extract', safe<[{ text: string; language: Language; source?: Observation['source'] }], ExtractResult>(
    'EXTRACT',
    async ({ text, language, source }) => {
      const r = await models.withModel('gemma', [], (id) =>
        extractObservation(id, { rawText: text, language, source: source ?? 'Text' })
      )
      // El modelo a veces omite la ciudad aunque esté literal en la nota. Si es
      // una ciudad ya conocida, se recupera por coincidencia exacta (auditable);
      // el país nunca se adivina, se infiere del catálogo por ciudad.
      if (!r.observation.city) {
        const city = await store.inferCityFromText(text)
        if (city) {
          r.observation.city = city
          r.observation.missingFields = r.observation.missingFields.filter((f) => f !== 'city')
          r.warnings.push(`Ciudad recuperada del texto por coincidencia exacta: ${city}`)
        }
      }
      r.observation.country = await store.inferCountry(r.observation.city)
      await store.recordTiming('extract', r.ms)
      return r
    }
  ))

  ipcMain.handle('obs:dedup', safe<[{ facility: string; city: string | null }], DedupResult>('DEDUP', async ({ facility, city }) => {
    const t0 = Date.now()
    const customers = await store.customers()
    const vectores = await store.getVectors()
    const r = await models.withModel('embed', [], async (embedId) => {
      const { canonical, cache, embedded } = await buildCanonical(embedId, customers, vectores)
      if (embedded > 0) await store.setVectors(cache)
      return rankCandidates(embedId, facility, city, canonical)
    })
    await store.recordTiming('dedup', Date.now() - t0)
    return r
  }))

  ipcMain.handle('obs:save', safe<[Observation], Observation[]>('SAVE', async (obs) => {
    const t0 = Date.now()
    const before = new Set((await store.customers()).map((c) => c.name))
    const { operator } = await store.getSettings()
    const all = await store.save(obs, operator)
    await store.recordTiming('save', Date.now() - t0)
    // Cliente nuevo: Whisper lleva el catálogo en su prompt y hay que recargarlo.
    const name = obs.facilityCanonical ?? obs.facility
    if (!before.has(name)) {
      const names = (await store.customers()).map((c) => c.name)
      void models.reloadWhisper(names).catch((e) => console.error('[whisper reload]', e))
    }
    return all
  }))

  ipcMain.handle('obs:list', safe<[], Observation[]>('LIST', () => store.list()))

  ipcMain.handle('settings:get', safe<[], Settings>('SETTINGS', () => store.getSettings()))
  ipcMain.handle('settings:set', safe<[Partial<Settings>], Settings>('SETTINGS_SET', (p) => store.setSettings(p)))

  // Reportes: se compone HTML y lo imprime Chromium. Sin librerias ni red.
  ipcMain.handle(
    'report:generate',
    safe<[{ req: ReportRequest; action: 'save' | 'open' | 'mail' }], { path: string; action: string }>(
      'REPORT',
      async ({ req, action }) => {
        const all = await store.list()
        const pdf = await renderReportPdf(req, all, app.getAppPath())
        const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')
        const base = `Eco-${req.kind}${req.facility ? '-' + req.facility.replace(/[^\p{L}\p{N}]+/gu, '-') : ''}-${stamp}.pdf`

        if (action === 'save') {
          const r = await dialog.showSaveDialog({
            title: 'Guardar reporte',
            defaultPath: join(app.getPath('documents'), base),
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
          })
          if (r.canceled || !r.filePath) return { path: '', action: 'cancelado' }
          await writeFile(r.filePath, pdf)
          void shell.showItemInFolder(r.filePath)
          return { path: r.filePath, action: 'guardado' }
        }

        const target = action === 'mail' ? join(app.getPath('documents'), base) : join(tmpdir(), base)
        await writeFile(target, pdf)
        if (action === 'mail') {
          const def = REPORT_BY_KIND[req.kind]
          const subject = encodeURIComponent(`${def.title} — Eco`)
          const body = encodeURIComponent(
            `Adjunto el reporte "${def.title}" generado con Eco.

` +
            `Solicitado por: ${req.requestedBy}
Generado: ${new Date().toLocaleString('es-PA')}

` +
            `El archivo está en: ${target}
(adjúntalo a este correo antes de enviarlo)

` +
            'Datos sintéticos. Prototipo del equipo Jajanken para el reto Philips.'
          )
          void shell.openExternal(`mailto:?subject=${subject}&body=${body}`)
          void shell.showItemInFolder(target)
          return { path: target, action: 'correo' }
        }
        void shell.openPath(target)
        return { path: target, action: 'abierto' }
      }
    )
  )

  // Pregunta en español. El modelo solo traduce a un plan; las cifras las
  // calcula src/shared/query-engine.ts sobre los registros guardados.
  ipcMain.handle(
    'query:parse',
    safe<[{ question: string }], { plan: QueryPlan; ms: number; warnings: string[] }>('QUERY', async ({ question }) => {
      const q = (question ?? '').trim()
      if (!q) throw new Error('La pregunta está vacía')
      const ctx = await store.queryContext()
      const r = await models.withModel('gemma', [], (id) => parseQuestion(id, q, ctx))
      await store.recordTiming('query', r.ms)
      return { plan: r.plan, ms: r.ms, warnings: r.warnings }
    })
  )
}
