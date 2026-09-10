// Banco de la pregunta en español. Mide el código real: importa
// src/main/qvac/query.ts y resuelve contra el mismo catálogo que la app.
//
//   node bench/bench_query.js
//
// Dos tandas:
//   A. las 10 consultas del Anexo F del blueprint (filtro).  Puerta: >= 7/10.
//   B. 5 consultas de intención y agrupación del Bloque 4B.  Puerta: >= 4/5.
//   C. 5 consultas de varias condiciones a la vez.            Puerta: >= 4/5.
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
  { q: 'resonadores viejos en México', want: { modality: 'MR', country: 'Mexico', minAgeYears: { rango: [7, 10] } } },
  { q: 'qué tiene el DemoCare Chiriquí', want: { textSearch: /chiriqui/ } },
  { q: 'monitores de paciente', want: { modality: 'Patient Monitoring' } }
]

const BLOQUE_4B = [
  { q: 'cuál es el estatus de las unidades en Panamá', want: { country: 'Panama' }, intent: 'breakdown', groupBy: 'status' },
  { q: 'cuántas son de baja confianza', want: { confidence: 'Low' }, intent: 'count', groupBy: null },
  { q: 'cuáles son las de baja confianza', want: { confidence: 'Low' }, intent: 'list', groupBy: null },
  { q: 'dame los ecógrafos de más de siete años', want: { modality: 'Ultrasound', minAgeYears: 7 }, intent: 'list', groupBy: null },
  { q: 'qué marcas hay en Ciudad de Panamá', want: { city: { unoDe: ['Ciudad de Panamá', 'Panama City'] } }, intent: 'breakdown', groupBy: 'brand' }
]


// Tanda C: varias condiciones en la misma frase. Es lo que pidio Josue el
// 2026-09-09: "quiero saber los equipos de Panama, en San Francisco, que tengan
// un estado de confianza bajo o medio". Mide dos cosas que la version anterior
// no sabia hacer: nombrar dos lugares y admitir "o" en un campo.
const COMPLEJAS = [
  { q: 'equipos de Panamá, en San Francisco, con confianza baja o media',
    want: { country: 'Panama', confidence: ['Low', 'Medium'], textSearch: /san francisco/ } },
  { q: 'ecógrafos reportados o estimados en Panamá de más de cuatro años',
    want: { country: 'Panama', modality: 'Ultrasound', status: ['Reported', 'Estimated'], minAgeYears: 4 } },
  { q: 'cuántos equipos hay en Brasil y en México',
    want: { country: ['Brazil', 'Mexico'] }, intent: 'count', groupBy: null },
  { q: 'tomógrafos NovaMed de confianza alta o media',
    want: { modality: 'CT', brand: 'NovaMed', confidence: ['High', 'Medium'] } },
  { q: 'equipos confirmados o reportados de menos de tres años',
    want: { status: ['Confirmed', 'Reported'], maxAgeYears: 3 } }
]

const FIELDS = ['country', 'city', 'modality', 'brand', 'minAgeYears', 'maxAgeYears', 'status', 'confidence', 'textSearch']
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
// Un campo puede traer uno o varios valores. Se comparan como conjuntos.
const conjunto = (v) => (v === null || v === undefined ? [] : Array.isArray(v) ? v.map(norm).sort() : [norm(v)])
const mismoConjunto = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

function scoreFilter(want, got) {
  const problems = []
  for (const f of FIELDS) {
    const expected = want[f]
    const actual = got[f]
    if (expected === undefined) {
      // No se pidio: cualquier valor aqui es un campo inventado.
      if (actual !== null && conjunto(actual).length) problems.push(`invento ${f}=${JSON.stringify(actual)}`)
      continue
    }
    if (expected instanceof RegExp) {
      if (!expected.test(norm(actual))) problems.push(`${f}=${JSON.stringify(actual)} no casa con ${expected}`)
    } else if (expected && expected.rango) {
      const [lo, hi] = expected.rango
      if (typeof actual !== 'number' || actual < lo || actual > hi) problems.push(`${f}=${JSON.stringify(actual)} fuera de ${lo}-${hi}`)
    } else if (expected && expected.unoDe) {
      if (!expected.unoDe.some((v) => norm(v) === norm(actual))) problems.push(`${f}=${JSON.stringify(actual)}, se esperaba uno de ${expected.unoDe.join(' | ')}`)
    } else if (typeof expected === 'number') {
      if (actual !== expected) problems.push(`${f}=${JSON.stringify(actual)}, se esperaba ${expected}`)
    } else if (!mismoConjunto(conjunto(expected), conjunto(actual))) {
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
const c = await runSet('complejas', COMPLEJAS, 4)

const pasa = a.passes && b.passes && c.passes
writeFileSync('bench/query-resumen.json', JSON.stringify({ at: new Date().toISOString(), sets: [a, b, c], passes: pasa }, null, 2))
console.log(`\n${pasa ? 'BANCO OK: se conecta la barra de pregunta' : 'BANCO POR DEBAJO: una iteración de prompt de 30 min y volver a medir'}`)

await unloadAll()
process.exit(pasa ? 0 : 1)
