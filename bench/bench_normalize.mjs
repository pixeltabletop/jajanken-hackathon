// Mide la corrección de dictado contra las transcripciones REALES que ya
// produjo Whisper en bench/asr_*.json. Sin modelos: es puro texto.
//
//   node bench/bench_normalize.mjs

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { normalizeTranscript } from '../src/shared/transcript.ts'

const catalog = JSON.parse(readFileSync('data/catalog.json', 'utf8'))
const customers = catalog.customers.map((c) => c.name)
const brands = catalog.brands

const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

function wer(ref, hyp) {
  const r = fold(ref).split(' ')
  const h = fold(hyp).split(' ')
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)])
  for (let j = 0; j <= h.length; j++) d[0][j] = j
  for (let i = 1; i <= r.length; i++)
    for (let j = 1; j <= h.length; j++)
      d[i][j] = r[i - 1] === h[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1])
  return d[r.length][h.length] / r.length
}

// Casos sintéticos del problema que reportó Josué, además del corpus real.
const MANUAL = [
  { hyp: 'En la clínica vi dos rayosex y un tomográfico', expect: ['rayos X', 'tomógrafo'] },
  { hyp: 'Tienen tres rayos ex marca zenit medtec', expect: ['rayos X', 'Zenith MedTech'] },
  { hyp: 'El hospital Mocare Pacific tiene dos resonadores', expect: ['DemoCare'] },
  { hyp: 'Vi cuatro ecográficos de aurelia elt', expect: ['ecógrafo', 'Aurelia Health'] },
  { hyp: 'dos equipos de rayosx y un ultrasonido', expect: ['rayos X', 'ultrasonido'] } // sinónimo legítimo: NO debe tocarse
]

console.log('=== casos del reporte de Josué ===')
let manualOk = 0
for (const c of MANUAL) {
  const r = normalizeTranscript(c.hyp, { brands, customers })
  const hits = c.expect.filter((e) => r.text.includes(e))
  const ok = hits.length === c.expect.length
  if (ok) manualOk++
  console.log(`${ok ? 'OK   ' : 'FALLA'} "${c.hyp}"`)
  console.log(`      -> "${r.text}"`)
  if (!ok) console.log(`      faltó: ${c.expect.filter((e) => !r.text.includes(e)).join(', ')}`)
  if (r.fixes.length) console.log(`      correcciones: ${r.fixes.map((f) => `${f.from}→${f.to}`).join(' · ')}`)
}
console.log(`\ncasos manuales: ${manualOk}/${MANUAL.length}\n`)

console.log('=== corpus real de bench/asr_*.json ===')
const rows = []
for (const file of readdirSync('bench').filter((f) => /^asr_.*\.json$/.test(f))) {
  const data = JSON.parse(readFileSync(`bench/${file}`, 'utf8'))
  let before = 0
  let after = 0
  let facBefore = 0
  let facAfter = 0
  let fixCount = 0
  for (const row of data.rows) {
    const n = normalizeTranscript(row.hyp, { brands, customers })
    before += wer(row.ref, row.hyp)
    after += wer(row.ref, n.text)
    const facility = (row.ref.match(/DemoCare[\w\s]*/i) ?? [''])[0].trim().split(/\s+/).slice(0, 2).join(' ')
    if (fold(row.hyp).includes(fold(facility))) facBefore++
    if (fold(n.text).includes(fold(facility))) facAfter++
    fixCount += n.fixes.length
  }
  const n = data.rows.length
  const r = {
    file,
    model: data.model,
    wer_before: +((before / n) * 100).toFixed(1),
    wer_after: +((after / n) * 100).toFixed(1),
    facility_before: `${facBefore}/${n}`,
    facility_after: `${facAfter}/${n}`,
    fixes: fixCount
  }
  rows.push(r)
  console.log(`${r.model.padEnd(28)} WER ${String(r.wer_before).padStart(5)}% → ${String(r.wer_after).padStart(5)}%   hospital ${r.facility_before} → ${r.facility_after}   (${r.fixes} correcciones)`)
}

writeFileSync('bench/normalize.json', JSON.stringify({ manual: `${manualOk}/${MANUAL.length}`, corpus: rows }, null, 2))
console.log('\nevidencia en bench/normalize.json')
process.exit(manualOk === MANUAL.length ? 0 : 1)
