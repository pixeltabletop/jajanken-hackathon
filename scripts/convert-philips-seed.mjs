// Convierte la hoja "Dummy Installed Base" del workbook de Philips al formato
// Observation (una visita, N equipos) y genera data/catalog.json.
//
//   node scripts/convert-philips-seed.mjs
//
// Fidelidad: las 20 filas se cargan tal cual las escribió Philips. No se
// corrige ninguna cantidad ni edad. Las inconsistencias detectadas se listan
// en `_avisos` del archivo generado y se imprimen aquí.
//
// Agrupación: Customer / Hospital + Visit Date. rawText es la unión de los
// "Voice Input Example" distintos del grupo, en orden. La evidencia de cada
// fila es su propio Voice Input Example, que por construcción es substring
// de rawText: evidencia segmentada y validable.

import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const SRC = 'data/Dummy_Installed_Base_Hackathon.xlsx'
const OUT = 'data/seed-philips.json'
const PANAMA = 'data/seed-panama.json'
const CATALOG = 'data/catalog.json'

const MODALITIES = ['MR', 'CT', 'Ultrasound', 'X-Ray', 'Patient Monitoring', 'Image Guided Therapy', 'Other']
const BRANDS = ['NovaMed', 'Aurelia Health', 'BluePeak Medical', 'Orion Imaging', 'HelixCare', 'Zenith MedTech']
const STATUSES = ['Confirmed', 'Reported', 'Estimated', 'Unknown']
const CONFIDENCE = ['High', 'Medium', 'Low']

const wb = XLSX.readFile(SRC, { cellDates: true })
const sheetName = wb.SheetNames.find((n) => /dummy installed base/i.test(n))
if (!sheetName) throw new Error(`Hoja no encontrada. Hojas: ${wb.SheetNames.join(', ')}`)
const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: null })

const hi = rows.findIndex((r) => r.some((c) => String(c ?? '').trim() === 'Observation ID'))
if (hi < 0) throw new Error('No encontré la fila de encabezados (Observation ID)')
const header = rows[hi].map((h) => String(h ?? '').trim())
const col = (name) => {
  const i = header.indexOf(name)
  if (i < 0) throw new Error(`Columna no encontrada: ${name}. Tengo: ${header.join(' | ')}`)
  return i
}
const C = {
  id: col('Observation ID'), country: col('Country'), city: col('City'),
  customer: col('Customer / Hospital'), observer: col('Observer'), date: col('Visit Date'),
  modality: col('Modality'), qty: col('Quantity'), brand: col('Dummy Brand'), model: col('Dummy Model'),
  age: col('Approx. Age (Years)'), installYear: col('Estimated Installation Year'),
  confidence: col('Confidence'), status: col('Status'), source: col('Source'),
  voice: col('Voice Input Example'), fq: col('Agent Follow-up Question'), fa: col('Follow-up Answer'), notes: col('Notes')
}

const pad = (n) => String(n).padStart(2, '0')
function isoDate(v) {
  if (v instanceof Date) return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
  if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${pad(d.m)}-${pad(d.d)}` }
  return String(v).slice(0, 10)
}
const str = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim())
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v))

const data = rows.slice(hi + 1).filter((r) => r[C.id] != null && str(r[C.customer]))
const avisos = []

// Agrupar por cliente + fecha, conservando el orden del workbook.
const groups = new Map()
for (const r of data) {
  const key = `${str(r[C.customer])}|${isoDate(r[C.date])}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(r)
}

const observations = []
let g = 0
for (const [, rs] of groups) {
  g++
  const first = rs[0]
  const createdAt = isoDate(first[C.date])
  const year = Number(createdAt.slice(0, 4))
  const voices = [...new Set(rs.map((r) => str(r[C.voice])).filter(Boolean))]
  const rawText = voices.join(' ')

  const equipment = rs.map((r) => {
    const modality = str(r[C.modality])
    if (!MODALITIES.includes(modality)) throw new Error(`Modalidad desconocida en fila ${r[C.id]}: ${modality}`)
    const brand = str(r[C.brand])
    if (brand && !BRANDS.includes(brand)) avisos.push(`Fila ${r[C.id]}: marca "${brand}" fuera del catálogo`)
    const status = str(r[C.status])
    if (!STATUSES.includes(status)) throw new Error(`Estado desconocido en fila ${r[C.id]}: ${status}`)
    const confidence = str(r[C.confidence])
    if (!CONFIDENCE.includes(confidence)) throw new Error(`Confianza desconocida en fila ${r[C.id]}: ${confidence}`)
    const age = num(r[C.age])
    const installYear = num(r[C.installYear])
    if (age !== null && installYear !== null && year - age !== installYear) {
      avisos.push(`Fila ${r[C.id]}: año de instalación ${installYear} no coincide con ${year} - ${age} = ${year - age}`)
    }
    const evidence = str(r[C.voice]) ?? rawText
    return {
      modality,
      quantity: Number(r[C.qty]),
      quantity_is_estimate: status === 'Estimated',
      brand,
      model: str(r[C.model]),
      approx_age_years: age,
      age_qualitative: null,
      confidence,
      status,
      evidence,
      notes: str(r[C.notes]),
      _philips_row: Number(r[C.id]),
      _philips_install_year: installYear,
      _philips_follow_up_question: str(r[C.fq]),
      _philips_follow_up_answer: str(r[C.fa])
    }
  })

  // Consistencia interna: la suma por modalidad frente a lo que dice el texto es
  // responsabilidad de Philips; solo se señala el caso conocido de filas agregadas.
  const byMod = {}
  for (const e of equipment) byMod[e.modality] = (byMod[e.modality] ?? 0) + e.quantity
  const aggregated = equipment.filter((e) => /aggregate/i.test(e.notes ?? ''))
  if (aggregated.length) {
    avisos.push(`Obs ${g} (${str(first[C.customer])}): fila ${aggregated.map((e) => e._philips_row).join(',')} marcada "Aggregate row" en el workbook; la suma por modalidad (${JSON.stringify(byMod)}) puede exceder lo dicho en el texto. Se carga tal cual.`)
  }

  observations.push({
    id: `ph-${pad(g)}`,
    createdAt,
    observer: str(first[C.observer]) ?? 'Philips Field User',
    source: 'Seed',
    language: 'en',
    rawText,
    facility: str(first[C.customer]),
    city: str(first[C.city]),
    country: str(first[C.country]),
    equipment,
    missing_fields: [
      ...new Set(equipment.flatMap((e) => [
        e.brand === null ? 'brand' : null,
        e.model === null ? 'model' : null,
        e.approx_age_years === null ? 'approxAgeYears' : null
      ].filter(Boolean)))
    ]
  })
}

const out = {
  _aviso: 'DATOS SINTÉTICOS DE PHILIPS. Convertidos tal cual desde la hoja "Dummy Installed Base" del workbook oficial del reto (Dummy_Installed_Base_Hackathon.xlsx). Clientes, marcas, modelos y observaciones son ficticios por declaración de Philips. No se corrigió ninguna cifra.',
  _formato: 'Observation v1 (snake_case). Una observación por cliente+fecha de visita; una fila de equipo por fila del workbook. rawText = unión de los Voice Input Example del grupo; evidence = el Voice Input Example de la fila, substring de rawText.',
  _origen: { archivo: SRC, hoja: sheetName, filas: data.length, observaciones: observations.length, generado: new Date().toISOString().slice(0, 10) },
  _avisos: avisos,
  observations
}
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')

// Verificación de evidencia: cada cita debe ser substring de su rawText.
let evTotal = 0, evBad = 0
for (const o of observations) for (const e of o.equipment) { evTotal++; if (!o.rawText.includes(e.evidence)) evBad++ }

// catalog.json: catálogo cerrado + clientes conocidos de ambas semillas.
const panama = JSON.parse(readFileSync(PANAMA, 'utf8'))
const customers = new Map()
for (const o of [...observations, ...panama.observations]) {
  if (!customers.has(o.facility)) customers.set(o.facility, { name: o.facility, city: o.city ?? null, country: o.country ?? null })
}
const catalog = {
  _aviso: 'Catálogo cerrado del dominio. Los índices de modalities/brands/statuses/confidence son los del esquema compacto medido: no reordenar. customers es la unión de data/seed-philips.json y data/seed-panama.json; en tiempo de ejecución la app lo recalcula desde el almacén.',
  modalities: MODALITIES, brands: BRANDS, statuses: STATUSES, confidence: CONFIDENCE,
  customers: [...customers.values()].sort((a, b) => a.name.localeCompare(b.name))
}
writeFileSync(CATALOG, JSON.stringify(catalog, null, 2) + '\n')

console.log(`hoja "${sheetName}": ${data.length} filas → ${observations.length} observaciones → ${OUT}`)
console.log(`clientes: ${observations.length} Philips + ${panama.observations.length} Panamá = ${catalog.customers.length} en ${CATALOG}`)
console.log(`países: ${[...new Set(observations.map((o) => o.country))].join(', ')}`)
console.log(`evidencia: ${evTotal - evBad}/${evTotal} citas son substring de su rawText`)
console.log(`avisos (${avisos.length}):`)
for (const a of avisos) console.log('  - ' + a)
if (evBad) process.exit(1)
