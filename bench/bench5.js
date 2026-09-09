// Corre los 10 prompts oficiales de la hoja "Voice Test Prompts" del workbook
// de Philips contra un modelo, en ingles y en espanol, con el esquema v2.
//
// Uso: node bench5.js <MODEL_CONST> [en|es]

import * as sdk from '@qvac/sdk';
import { writeFileSync, mkdirSync } from 'node:fs';
import { OBSERVATION_SCHEMA, SYSTEM_EN, SYSTEM_ES } from '../schema.js';

const MODEL_NAME = process.argv[2] || 'QWEN3_1_7B_INST_Q4';
const LANG = process.argv[3] || 'en';

// Los 10 casos oficiales. `truth` sale de la columna "Expected Structured Output".
const CASES = [
  { en: 'I am at Hospital DemoCare Pacific in Panama. They have two MR systems and one CT.',
    es: 'Estoy en el Hospital DemoCare Pacific en Panama. Tienen dos resonadores y un tomografo.',
    truth: { facility: 'DemoCare Pacific', equip: { MR: 2, CT: 1 } } },
  { en: 'At Hospital DemoCare Horizon I saw three MR systems. Two seem old and one looks much newer.',
    es: 'En el Hospital DemoCare Horizon vi tres resonadores. Dos se ven viejos y uno se ve mucho mas nuevo.',
    truth: { facility: 'DemoCare Horizon', equip: { MR: 3 }, minRows: 2 } },
  { en: 'Clinica DemoCare Light has two CT scanners, both Orion Imaging, around eleven years old.',
    es: 'La Clinica DemoCare Light tiene dos tomografos, ambos Orion Imaging, de unos once anos.',
    truth: { facility: 'DemoCare Light', equip: { CT: 2 }, brand: 'Orion Imaging', age: 11 } },
  { en: 'Centro Medico DemoCare Valley has one MR and two CTs. I do not know the brands.',
    es: 'El Centro Medico DemoCare Valley tiene un resonador y dos tomografos. No se las marcas.',
    truth: { facility: 'DemoCare Valley', equip: { MR: 1, CT: 2 }, brandNull: true } },
  { en: 'Hospital DemoCare North has about six ultrasound units, mostly new.',
    es: 'El Hospital DemoCare North tiene unos seis ecografos, casi todos nuevos.',
    truth: { facility: 'DemoCare North', equip: { Ultrasound: 6 }, estimate: true } },
  { en: 'Clinica DemoCare Andes has one very old CT and two MR systems from the same manufacturer.',
    es: 'La Clinica DemoCare Andes tiene un tomografo muy viejo y dos resonadores del mismo fabricante.',
    truth: { facility: 'DemoCare Andes', equip: { CT: 1, MR: 2 } } },
  { en: 'Hospital DemoCare Park has one MR, maybe ten years old, plus three CT scanners.',
    es: 'El Hospital DemoCare Park tiene un resonador, quizas de diez anos, mas tres tomografos.',
    truth: { facility: 'DemoCare Park', equip: { MR: 1, CT: 3 }, age: 10 } },
  { en: 'Clinica DemoCare Central has many ultrasound systems, maybe eight, all Aurelia Health.',
    es: 'La Clinica DemoCare Central tiene muchos ecografos, quizas ocho, todos Aurelia Health.',
    truth: { facility: 'DemoCare Central', equip: { Ultrasound: 8 }, brand: 'Aurelia Health', estimate: true } },
  { en: 'Instituto DemoCare Lima has two old CTs and one recently installed MR.',
    es: 'El Instituto DemoCare Lima tiene dos tomografos viejos y un resonador instalado hace poco.',
    truth: { facility: 'DemoCare Lima', equip: { CT: 2, MR: 1 } } },
  { en: 'Hospital DemoCare Metro North has two MR systems. I know the brand is Aurelia Health but not the model.',
    es: 'El Hospital DemoCare Metro North tiene dos resonadores. Se que la marca es Aurelia Health pero no el modelo.',
    truth: { facility: 'DemoCare Metro North', equip: { MR: 2 }, brand: 'Aurelia Health', modelNull: true } }
];

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');

function score(p, t, note) {
  if (!p) return { errs: ['sin JSON'], evidenceOk: null };
  const errs = [];
  if (!norm(p.facility).includes(norm(t.facility))) errs.push(`facility="${p.facility}"`);

  const got = {};
  for (const e of p.equipment || []) got[e.modality] = (got[e.modality] || 0) + e.quantity;
  for (const [m, q] of Object.entries(t.equip)) if (got[m] !== q) errs.push(`${m}=${got[m] ?? 'ausente'} esperado ${q}`);
  for (const m of Object.keys(got)) if (!(m in t.equip)) errs.push(`${m} INVENTADO`);

  if (t.minRows && (p.equipment || []).length < t.minRows) errs.push(`solo ${p.equipment.length} filas, esperaba >=${t.minRows}`);
  if (t.brand && !(p.equipment || []).some(e => norm(e.brand).includes(norm(t.brand)))) errs.push(`marca ${t.brand} no capturada`);
  if (t.brandNull && (p.equipment || []).some(e => e.brand)) errs.push('invento una marca');
  if (t.modelNull && (p.equipment || []).some(e => e.model)) errs.push('invento un modelo');
  if (t.age && !(p.equipment || []).some(e => e.approx_age_years !== null && Math.abs(e.approx_age_years - t.age) <= 1)) errs.push(`edad ~${t.age} no capturada`);
  if (t.estimate && !(p.equipment || []).some(e => e.quantity_is_estimate)) errs.push('no marco la cantidad como estimada');

  // Verificacion de evidencia: la cita debe existir literal en la nota.
  const n = norm(note);
  const quotes = (p.equipment || []).map(e => e.evidence);
  const bad = quotes.filter(q => q && !n.includes(norm(q)));
  const evidenceOk = quotes.length ? quotes.length - bad.length : 0;

  return { errs, evidenceOk, evidenceTotal: quotes.length, badQuotes: bad };
}

const modelId = await sdk.loadModel({ modelSrc: sdk[MODEL_NAME], modelConfig: { ctx_size: 4096 } });
const SYSTEM = LANG === 'es' ? SYSTEM_ES : SYSTEM_EN;
console.log(`modelo: ${MODEL_NAME} | idioma: ${LANG} | 10 prompts oficiales de Philips\n`);

const results = [];
let okCount = 0, evOk = 0, evTotal = 0, totMs = 0;

for (let i = 0; i < CASES.length; i++) {
  const note = CASES[i][LANG];
  const t0 = Date.now();
  const run = sdk.completion({
    modelId,
    history: [{ role: 'system', content: SYSTEM }, { role: 'user', content: note }],
    stream: true,
    responseFormat: { type: 'json_schema', json_schema: { name: 'obs', schema: OBSERVATION_SCHEMA } },
    generationParams: { temp: 0, seed: 42, top_k: 1, predict: 900 }
  });
  let text = '';
  for await (const ev of run.events) if (ev.type === 'contentDelta') text += ev.text;
  const ms = Date.now() - t0; totMs += ms;

  let p = null; try { p = JSON.parse(text); } catch {}
  const s = score(p, CASES[i].truth, note);
  const ok = s.errs.length === 0;
  if (ok) okCount++;
  evOk += s.evidenceOk || 0; evTotal += s.evidenceTotal || 0;

  console.log(`${String(i + 1).padStart(2)}. ${ok ? 'OK  ' : 'FALLA'} ${ms}ms  evidencia ${s.evidenceOk}/${s.evidenceTotal}`);
  if (!ok) console.log(`      ${s.errs.join(' ; ')}`);
  if (s.badQuotes?.length) console.log(`      cita inventada: ${JSON.stringify(s.badQuotes[0]).slice(0, 90)}`);

  results.push({ n: i + 1, note, ms, ok, errs: s.errs, evidence: `${s.evidenceOk}/${s.evidenceTotal}`, badQuotes: s.badQuotes, output: p });
}

await sdk.unloadModel({ modelId });
mkdirSync('bench', { recursive: true });
writeFileSync(`bench/philips10_${MODEL_NAME}_${LANG}.json`,
  JSON.stringify({ model: MODEL_NAME, lang: LANG, schema: 'v2', passed: okCount, total: CASES.length, evidence: `${evOk}/${evTotal}`, avg_ms: Math.round(totMs / CASES.length), results }, null, 2));

console.log(`\nRESUMEN ${MODEL_NAME} [${LANG}]`);
console.log(`  casos correctos : ${okCount}/${CASES.length}`);
console.log(`  citas validas   : ${evOk}/${evTotal}`);
console.log(`  tiempo promedio : ${Math.round(totMs / CASES.length)} ms`);
