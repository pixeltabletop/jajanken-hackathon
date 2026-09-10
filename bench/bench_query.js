// Banco de la pregunta en español. Mide el código real: importa
// src/main/qvac/query.ts y resuelve contra el mismo catálogo que la app.
//
//   node bench/bench_query.js
//
// Dos tandas:
//   A. las 10 consultas del Anexo F del blueprint (filtro).  Puerta: >= 7/10.
//   B. 5 consultas de intención y agrupación del Bloque 4B.  Puerta: >= 4/5.
//
// Se puntúa como la extracción: correcto si todos los campos no nulos esperados
// coinciden y ningún campo fue inventado. Evidencia cruda en bench/query-*.json.
//
// Ninguna de las consultas de abajo aparece en los ejemplos del prompt.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

process.env.QVAC_CONFIG_PATH ??= resolve('qvac.config.json')

const { loadGemma, requireModel, unloadAll } = await import('../src/main/qvac/models.ts')
const { parseQuestion } = await import('../src/main/qvac/query.ts')
const { runPlan, redact } = await import('../src/shared/query-engine.ts')

// Mismo contexto que arma el almacén: países y ciudades de la semilla, ordenados.
function seedContext() {
  const all = []
  for (const f of ['seed-philips.json', 'seed-panama.json']) {
    const raw = JSON.parse(readFileSync(`data/${f}`, 'utf8'))
    for (const o of Array.isArray(raw) ? raw : (raw.observations ?? [])) all.push(o)
  }
  const countries = [...new Set(all.map((o) => o.country).filter(Boolean))].sort()
  const cities = [...new Set(all.map((o) => o.city).filter(Boolean))].sort()
  return { ctx: { countries, cities }, observations: all }
}

// Las observaciones de la semilla vienen en snake_case; el motor de consulta
// solo necesita equipment/city/country/facility, así que se normaliza aquí.
function normalize(o) {
  const createdAt = String(o.createdAt ?? o.created_at ?? '2026-09-01')
  return {
    id: String(o.id),
    createdAt,
    observer: String(o.observer ?? 'Semilla'),
    source: 'Seed',
    language: o.language ?? 'es',
    rawText: String(o.rawText ?? o.raw_text ?? ''),
    facility: String(o.facility),
    facilityCanonical: String(o.facility),
    city: o.city ?? null,
    country: o.country ?? null,
    equipment: (o.equipment ?? []).map((e) => ({
      modality: e.modality,
      quantity: Number(e.quantity),
      quantityIsEstimate: Boolean(e.quantity_is_estimate ?? e.quantityIsEstimate),
      brand: e.brand ?? null,
      model: e.model ?? null,
      approxAgeYears: typeof (e.approx_age_years ?? e.approxAgeYears) === 'number' ? (e.approx_age_years ?? e.approxAgeYears) : null,
      ageQualitative: e.age_qualitative ?? null,
      installYearEstimate: null,
      confidence: e.confidence,
      status: e.status,
      evidence: String(e.evidence ?? ''),
      notes: e.notes ?? null
    })),
    missingFields: [],
    reviewed: true
  }
}

// Un caso: pregunta y lo que se espera. `any` marca los campos que pueden venir
// con cualquier valor sin penalizar; el resto tiene que quedar en null.
const ANEXO_F = [
  { q: 'hospitales en Panamá con resonadores', want: { country: 'Panama', modality: 'MR' } },
  { q: 'tomógrafos de más de diez años', want: { modality: 'CT', minAgeYears: 10 } },
  { q: 'equipos Aurelia Health en Brasil', want: { brand: 'Aurelia Health', country: 'Brazil' } },
  { q: 'todo lo que hay en Colón', want: { city: 'Colón' } },
  { q: 'ecógrafos nuevos, de menos de tres años', want: { modality: 'Ultrasound', maxAgeYears: 3 } },
  { q: 'registros con confianza baja', want: { confidence: 'Low' } },
  { q: 'equipos estimados, no confirmados', want: { status: 'Estimated' } },
  // "viejos" sin número: el criterio de aceptación admite 7 a 10 (nota del Anexo F).
  { q: 'resonadores viejos en México', want: { modality: 'MR', country: 'Mexico', minAgeYears: [7, 10] } },
  { q: 'qué tiene el DemoCare Chiriquí', want: { textSearch: /chiriqui/ } },
  { q: 'monitores de paciente', want: { modality: 'Patient Monitoring' } }
]

const BLOQUE_4B = [
  { q: 'cuál es el estatus de las unidades en Panamá', want: { country: 'Panama' }, intent: 'breakdown', groupBy: 'status' },
  { q: 'cuántas son de baja confianza', want: { confidence: 'Low' }, intent: 'count', groupBy: null },
  { q: 'cuáles son las de baja confianza', want: { confidence: 'Low' }, intent: 'list', groupBy: null },
  { q: 'dame los ecógrafos de más de siete años', want: { modality: 'Ultrasound', minAgeYears: 7 }, intent: 'list', groupBy: null },
  { q: 'qué marcas hay en Ciudad de Panamá', want: { city: ['Ciudad de Panamá', 'Panama City'] }, intent: 'breakdown', groupBy: 'brand' }
]

const FIELDS = ['country', 'city', 'modality', 'brand', 'minAgeYears', 'maxAgeYears', 'status', 'confidence', 'textSearch']
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

function scoreFilter(want, got) {
  const problems = []
  for (const f of FIELDS) {
    const expected = want[f]
    const actual = got[f]
    if (expected === undefined) {
      // No se pidió: cualquier valor aquí es un campo inventado.
      if (actual !== null) problems.push(`inventó ${f}=${JSON.stringify(actual)}`)
      continue
    }
    if (expected instanceof RegExp) {
      if (!expected.test(norm(actual))) problems.push(`${f}=${JSON.stringify(actual)} no casa con ${expected}`)
    } else if (Array.isArray(expected) && typeof expected[0] === 'number') {
      const [lo, hi] = expected
      if (typeof actual !== 'number' || actual < lo || actual > hi) problems.push(`${f}=${JSON.stringify(actual)} fuera de ${lo}–${hi}`)
    } else if (Array.isArray(expected)) {
      if (!expected.some((v) => norm(v) === norm(actual))) problems.push(`${f}=${JSON.stringify(actual)}, se esperaba uno de ${expected.join(' | ')}`)
    } else if (norm(expected) !== norm(actual)) {
      problems.push(`${f}=${JSON.stringify(actual)}, se esperaba ${JSON.stringify(expected)}`)
    }
  }
  return problems
}

const { ctx, observations: rawObs } = seedContext()
const observations = rawObs.map(normalize)
console.log(`Contexto: ${ctx.countries.length} países, ${ctx.cities.length} ciudades, ${observations.length} observaciones`)

console.log('Cargando Gemma 2B…')
const t0 = Date.now()
await loadGemma()
console.log(`Listo en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
const gemma = requireModel('gemma')

async function runSet(name, cases, gate) {
  const rows = []
  console.log(`\n--- ${name} ---`)
  for (const c of cases) {
    let rec
    try {
      const r = await parseQuestion(gemma, c.q, ctx)
      const problems = scoreFilter(c.want, r.plan.filter)
      if (c.intent && r.plan.intent !== c.intent) problems.push(`intención=${r.plan.intent}, se esperaba ${c.intent}`)
      if (c.intent && c.groupBy !== undefined && r.plan.groupBy !== c.groupBy) {
        problems.push(`agrupación=${r.plan.groupBy}, se esperaba ${c.groupBy}`)
      }
      const result = runPlan(observations, r.plan)
      rec = {
        question: c.q,
        ok: problems.length === 0,
        problems,
        ms: r.ms,
        raw: r.raw,
        plan: r.plan,
        warnings: r.warnings,
        // Lo que vería el usuario. Ninguna cifra sale del modelo.
        answer: redact(r.plan, result),
        counts: { equipment: result.equipment, rows: result.rows, sites: result.sites, observations: result.observations }
      }
    } catch (e) {
      rec = { question: c.q, ok: false, problems: [`excepción: ${e.message}`], ms: 0 }
    }
    rows.push(rec)
    console.log(`${rec.ok ? 'OK   ' : 'FALLA'} ${c.q}  ·  ${rec.ms} ms`)
    if (!rec.ok) console.log(`      ${rec.problems.join(' · ')}`)
    else console.log(`      ${rec.answer}`)
  }
  const hits = rows.filter((r) => r.ok).length
  const times = rows.map((r) => r.ms).filter(Boolean).sort((a, b) => a - b)
  const stat = {
    set: name,
    hits,
    total: rows.length,
    gate,
    passes: hits >= gate,
    msMin: times[0] ?? 0,
    msMax: times[times.length - 1] ?? 0,
    msMedian: times[Math.floor(times.length / 2)] ?? 0
  }
  console.log(`${stat.passes ? 'PUERTA OK' : 'PUERTA NO'} · ${hits}/${rows.length} (necesita ${gate}) · mediana ${stat.msMedian} ms`)
  mkdirSync('bench', { recursive: true })
  writeFileSync(`bench/query-${name}.json`, JSON.stringify({ ...stat, context: ctx, rows }, null, 2))
  return stat
}

const a = await runSet('anexoF', ANEXO_F, 7)
const b = await runSet('bloque4b', BLOQUE_4B, 4)

writeFileSync('bench/query-resumen.json', JSON.stringify({ at: new Date().toISOString(), sets: [a, b], passes: a.passes && b.passes }, null, 2))
console.log(`\n${a.passes && b.passes ? 'BANCO OK: se conecta la barra de pregunta' : 'BANCO POR DEBAJO: una iteración de prompt de 30 min y volver a medir'}`)

await unloadAll()
process.exit(a.passes && b.passes ? 0 : 1)
