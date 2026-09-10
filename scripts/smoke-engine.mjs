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
check(obs.length === 23, `semilla cargada: ${obs.length} observaciones (esperadas 23 = 13 Philips + 10 Panamá)`)
check(customers.length === 23, `clientes únicos: ${customers.length} (esperados 23)`)
check(obs.filter((o) => o.id.startsWith('ph-')).length === 13, 'las 13 observaciones de Philips están')
const phEquip = obs.filter((o) => o.id.startsWith('ph-')).flatMap((o) => o.equipment)
check(phEquip.length === 20, `las 20 filas de equipo de Philips están (obtuvo ${phEquip.length})`)
check(phEquip.every((e) => e.installYearEstimate !== null), 'año de instalación derivado en todas las filas de Philips')
check((await store.inferCountry('Quito')) === 'Ecuador', 'inferCountry("Quito") = Ecuador')
check((await store.inferCountry('Ciudad de Panamá')) === 'Panama', 'inferCountry("Ciudad de Panamá") = Panama (país en inglés canónico, D20)')
check((await store.inferCountry('panama city')) === 'Panama', 'inferCountry es insensible a mayúsculas y acentos')
check((await store.inferCountry('Narnia')) === null, 'inferCountry de ciudad desconocida = null')

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
  const wav = ['audio/es_01.wav'].find((p) => existsSync(p))
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

  // El caso trampa del dataset: dos clientes distintos con nombres casi iguales.
  const d3 = await rankCandidates(requireModel('embed'), 'DemoCare Metro North', 'Quito', canonical)
  console.log(`  "DemoCare Metro North" + Quito → ${d3.suggestion} (${d3.candidates[0]?.score.toFixed(3)} vs ${d3.candidates[1]?.score.toFixed(3)}) · ${d3.reason}`)
  check(d3.suggestion === 'Hospital DemoCare Metro North', 'CRÍTICO: Metro North en Quito resuelve a Metro North')
  const d4 = await rankCandidates(requireModel('embed'), 'DemoCare North', 'Monterrey', canonical)
  console.log(`  "DemoCare North" + Monterrey → ${d4.suggestion} (${d4.candidates[0]?.score.toFixed(3)} vs ${d4.candidates[1]?.score.toFixed(3)}) · ${d4.reason}`)
  check(d4.suggestion === 'Hospital DemoCare North', 'CRÍTICO: North en Monterrey resuelve a North, no a Metro North')
}

await unloadAll()
rmSync(userDataDir, { recursive: true, force: true })

console.log(`\n${failures.length === 0 ? 'HUMO OK' : 'HUMO FALLÓ: ' + failures.length + ' checks'}`)
process.exit(failures.length === 0 ? 0 : 1)
