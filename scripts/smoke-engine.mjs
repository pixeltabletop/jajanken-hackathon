// Humo del motor SIN Electron. Carga los tres modelos y corre una extracción,
// una transcripción y una deduplicación. Sale con código 1 si algo falla.
//
//   node scripts/smoke-engine.mjs
//
// Requiere Node >= 22.6 con type stripping (los módulos del motor son .ts).

import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

process.env.QVAC_CONFIG_PATH ??= resolve('qvac.config.json')

const { warmup, requireModel, getModelStatus, unloadAll } = await import('../src/main/qvac/models.ts')
const { extractObservation, evidenceIsValid } = await import('../src/main/qvac/extract.ts')
const { transcribeFile } = await import('../src/main/qvac/transcribe.ts')
const { buildCanonical, rankCandidates } = await import('../src/main/qvac/dedup.ts')
const { createStore } = await import('../src/main/store.ts')

const failures = []
const check = (ok, label) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${label}`)
  if (!ok) failures.push(label)
}

const userDataDir = resolve('.smoke-userdata')
rmSync(userDataDir, { recursive: true, force: true })
const store = createStore({ userDataDir, seedDir: resolve('data') })

console.log('--- almacén ---')
const obs = await store.list()
const customers = await store.customers()
check(obs.length >= 10, `semilla cargada: ${obs.length} observaciones, ${customers.length} clientes`)

console.log('\n--- modelos ---')
let t = Date.now()
const status = await warmup(customers.map((c) => c.name))
for (const k of ['gemma', 'whisper', 'embed']) {
  check(status[k].state === 'ready', `${k}: ${status[k].state} ${status[k].ms ? status[k].ms + 'ms' : ''} ${status[k].error ?? ''}`)
}
console.log(`carga total (paralela): ${Date.now() - t} ms`)

if (failures.length === 0) {
  console.log('\n--- extracción · nota 1 de Panamá ---')
  const note = obs.find((o) => o.id === 'pa-01')
  const r = await extractObservation(requireModel('gemma'), { rawText: note.rawText, language: 'es' })
  console.log(`${r.ms} ms · ${r.stats.generatedTokens ?? '?'} tok · ${r.stats.tokensPerSecond?.toFixed(1) ?? '?'} tok/s · ${r.stats.backendDevice ?? '?'}`)
  for (const e of r.observation.equipment) {
    console.log(`  ${e.modality} x${e.quantity}${e.quantityIsEstimate ? '~' : ''} · ${e.brand ?? 'marca?'} · ${e.approxAgeYears ?? '-'}a · ${e.confidence}/${e.status} · "${e.evidence}"${e.evidenceInvalid ? ' ✗' : ''}`)
  }
  if (r.warnings.length) console.log('  avisos:', r.warnings.join(' | '))
  check(r.observation.equipment.length === 2, `2 equipos identificados (obtuvo ${r.observation.equipment.length})`)
  check(r.observation.equipment.every((e) => evidenceIsValid(note.rawText, e.evidence)), 'todas las citas son textuales')
  check(r.observation.facility.toLowerCase().includes('bella vista'), `sitio: ${r.observation.facility}`)
  check(r.ms < 25000, `tiempo < 25 s (${r.ms} ms)`)

  console.log('\n--- transcripción ---')
  const wav = ['audio/es_01.wav', 'bench/audio/es_01.wav'].find((p) => existsSync(p))
  if (wav) {
    const tr = await transcribeFile(requireModel('whisper'), wav)
    console.log(`${tr.ms} ms · "${tr.text}"`)
    check(/democare/i.test(tr.text), 'hospital reconocido en el audio sintético')
    check(tr.ms < 5000, `tiempo < 5 s (${tr.ms} ms)`)
  } else {
    console.log('sin audio de prueba, se omite (audio/es_01.wav)')
  }

  console.log('\n--- deduplicación ---')
  t = Date.now()
  const { canonical, cache, embedded } = await buildCanonical(requireModel('embed'), customers, await store.getVectors())
  await store.setVectors(cache)
  console.log(`${canonical.length} canónicos, ${embedded} vectorizados ahora, ${Date.now() - t} ms`)
  const d1 = await rankCandidates(requireModel('embed'), 'DemoCare Bella Vista', 'Ciudad de Panamá', canonical)
  console.log(`  "DemoCare Bella Vista" → ${d1.suggestion} (${d1.candidates[0]?.score.toFixed(3)}) · ${d1.reason}`)
  check(d1.suggestion === 'Hospital DemoCare Bella Vista', 'forma corta resuelve al canónico')
  const d2 = await rankCandidates(requireModel('embed'), 'Hospital Nuevo Sol', 'Colón', canonical)
  console.log(`  "Hospital Nuevo Sol" → ${d2.suggestion ?? 'NUEVO'} (${d2.candidates[0]?.score.toFixed(3)}) · ${d2.reason}`)
  check(d2.suggestion === null || d2.candidates[0].score < 0.85, 'nombre desconocido no se fuerza a un cliente existente')
}

await unloadAll()
rmSync(userDataDir, { recursive: true, force: true })

console.log(`\n${failures.length === 0 ? 'HUMO OK' : 'HUMO FALLÓ: ' + failures.length + ' checks'}`)
process.exit(failures.length === 0 ? 0 : 1)
