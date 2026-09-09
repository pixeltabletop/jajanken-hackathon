// Compara dos formas de resolver la caida de calidad en espanol:
//   A) extraer directo en espanol con un modelo mas grande
//   B) traducir la nota al ingles localmente y extraer en ingles
//
// Uso: node bench6.js directo <MODELO>      -> A
//      node bench6.js traducido <MODELO>    -> B

import * as sdk from '@qvac/sdk';
import { writeFileSync, mkdirSync } from 'node:fs';
import { OBSERVATION_SCHEMA, SYSTEM_EN, SYSTEM_ES } from '../schema.js';

const MODE = process.argv[2] || 'traducido';
const MODEL_NAME = process.argv[3] || 'QWEN3_1_7B_INST_Q4';

const CASES = [
  { es: 'Estoy en el Hospital DemoCare Pacific en Panama. Tienen dos resonadores y un tomografo.',
    truth: { facility: 'DemoCare Pacific', equip: { MR: 2, CT: 1 } } },
  { es: 'En el Hospital DemoCare Horizon vi tres resonadores. Dos se ven viejos y uno se ve mucho mas nuevo.',
    truth: { facility: 'DemoCare Horizon', equip: { MR: 3 }, minRows: 2 } },
  { es: 'La Clinica DemoCare Light tiene dos tomografos, ambos Orion Imaging, de unos once anios.',
    truth: { facility: 'DemoCare Light', equip: { CT: 2 }, brand: 'Orion Imaging', age: 11 } },
  { es: 'El Centro Medico DemoCare Valley tiene un resonador y dos tomografos. No se las marcas.',
    truth: { facility: 'DemoCare Valley', equip: { MR: 1, CT: 2 }, brandNull: true } },
  { es: 'El Hospital DemoCare North tiene unos seis ecografos, casi todos nuevos.',
    truth: { facility: 'DemoCare North', equip: { Ultrasound: 6 }, estimate: true } },
  { es: 'La Clinica DemoCare Andes tiene un tomografo muy viejo y dos resonadores del mismo fabricante.',
    truth: { facility: 'DemoCare Andes', equip: { CT: 1, MR: 2 } } },
  { es: 'El Hospital DemoCare Park tiene un resonador, quizas de diez anios, mas tres tomografos.',
    truth: { facility: 'DemoCare Park', equip: { MR: 1, CT: 3 }, age: 10 } },
  { es: 'La Clinica DemoCare Central tiene muchos ecografos, quizas ocho, todos Aurelia Health.',
    truth: { facility: 'DemoCare Central', equip: { Ultrasound: 8 }, brand: 'Aurelia Health', estimate: true } },
  { es: 'El Instituto DemoCare Lima tiene dos tomografos viejos y un resonador instalado hace poco.',
    truth: { facility: 'DemoCare Lima', equip: { CT: 2, MR: 1 } } },
  { es: 'El Hospital DemoCare Metro North tiene dos resonadores. Se que la marca es Aurelia Health pero no el modelo.',
    truth: { facility: 'DemoCare Metro North', equip: { MR: 2 }, brand: 'Aurelia Health', modelNull: true } }
];

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');

function score(p, t) {
  if (!p) return ['sin JSON'];
  const errs = [];
  if (!norm(p.facility).includes(norm(t.facility))) errs.push(`facility="${p.facility}"`);
  const got = {};
  for (const e of p.equipment || []) got[e.modality] = (got[e.modality] || 0) + e.quantity;
  for (const [m, q] of Object.entries(t.equip)) if (got[m] !== q) errs.push(`${m}=${got[m] ?? 'ausente'} esp ${q}`);
  for (const m of Object.keys(got)) if (!(m in t.equip)) errs.push(`${m} INVENTADO`);
  if (t.minRows && (p.equipment || []).length < t.minRows) errs.push(`${p.equipment.length} filas, esp >=${t.minRows}`);
  if (t.brand && !(p.equipment || []).some(e => norm(e.brand).includes(norm(t.brand)))) errs.push(`marca ${t.brand} perdida`);
  if (t.brandNull && (p.equipment || []).some(e => e.brand)) errs.push('invento marca');
  if (t.modelNull && (p.equipment || []).some(e => e.model)) errs.push('invento modelo');
  if (t.age && !(p.equipment || []).some(e => e.approx_age_years !== null && Math.abs(e.approx_age_years - t.age) <= 1)) errs.push(`edad ~${t.age} perdida`);
  if (t.estimate && !(p.equipment || []).some(e => e.quantity_is_estimate)) errs.push('no marco estimado');
  return errs;
}

const llmId = await sdk.loadModel({ modelSrc: sdk[MODEL_NAME] });
let nmtId = null;
if (MODE === 'traducido') nmtId = await sdk.loadModel({ modelSrc: sdk.BERGAMOT_ES_EN, modelConfig: { engine: 'Bergamot', from: 'es', to: 'en' } });

console.log(`modo: ${MODE} | extractor: ${MODEL_NAME}${nmtId ? ' | traductor: BERGAMOT_ES_EN' : ''}\n`);

const rows = [];
let ok = 0, totMs = 0, trMs = 0;

for (let i = 0; i < CASES.length; i++) {
  const t0 = Date.now();
  let note = CASES[i].es, system = SYSTEM_ES, translated = null;

  if (MODE === 'traducido') {
    const tt = Date.now();
    const r = await sdk.translate({ modelId: nmtId, text: CASES[i].es, from: 'es', to: 'en', stream: false, modelType: 'nmt' });
    translated = String(await r.text ?? '').trim();
    trMs += Date.now() - tt;
    note = translated; system = SYSTEM_EN;
  }

  const run = sdk.completion({
    modelId: llmId,
    history: [{ role: 'system', content: system }, { role: 'user', content: note }],
    stream: true,
    responseFormat: { type: 'json_schema', json_schema: { name: 'obs', schema: OBSERVATION_SCHEMA } },
    generationParams: { temp: 0, seed: 42, top_k: 1, predict: 900 }
  });
  let text = '';
  for await (const ev of run.events) if (ev.type === 'contentDelta') text += ev.text;
  const ms = Date.now() - t0; totMs += ms;

  let p = null; try { p = JSON.parse(text); } catch {}
  const errs = score(p, CASES[i].truth);
  if (!errs.length) ok++;

  console.log(`${String(i + 1).padStart(2)}. ${errs.length ? 'FALLA' : 'OK  '} ${ms}ms`);
  if (translated) console.log(`      EN: "${translated.slice(0, 95)}"`);
  if (errs.length) console.log(`      ${errs.join(' ; ')}`);
  rows.push({ n: i + 1, es: CASES[i].es, translated, ms, ok: !errs.length, errs, output: p });
}

await sdk.unloadModel({ modelId: llmId });
if (nmtId) await sdk.unloadModel({ modelId: nmtId });

mkdirSync('bench', { recursive: true });
writeFileSync(`bench/es_${MODE}_${MODEL_NAME}.json`, JSON.stringify({ mode: MODE, model: MODEL_NAME, passed: ok, total: CASES.length, avg_ms: Math.round(totMs / CASES.length), avg_translate_ms: nmtId ? Math.round(trMs / CASES.length) : null, rows }, null, 2));

console.log(`\nRESUMEN [${MODE}] ${MODEL_NAME}`);
console.log(`  correctos       : ${ok}/${CASES.length}`);
console.log(`  tiempo promedio : ${Math.round(totMs / CASES.length)} ms`);
if (nmtId) console.log(`  de eso traducir : ${Math.round(trMs / CASES.length)} ms`);
