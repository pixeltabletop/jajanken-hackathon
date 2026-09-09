import * as sdk from '@qvac/sdk';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODEL_NAME = process.argv[2] || 'QWEN3_1_7B_INST_Q4';
const TEMP = process.argv[3] !== undefined ? Number(process.argv[3]) : 0;
const REPEATS = 3;

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['facility', 'city', 'country', 'equipment'],
  properties: {
    facility: { type: 'string' },
    city: { type: ['string', 'null'] },
    country: { type: ['string', 'null'] },
    equipment: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['modality', 'quantity', 'approx_age_years', 'confidence'],
      properties: {
        modality: { type: 'string', enum: ['MR', 'CT', 'Ultrasound', 'X-Ray', 'Monitoring', 'Other'] },
        quantity: { type: 'integer', minimum: 1 },
        approx_age_years: { type: ['string', 'null'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
      } } }
  }
};

const SYSTEM = `Extract medical-equipment observations from the field note into the required JSON.
Rules:
1. Only include equipment the observer actually SAW. 
2. If the note says equipment was NOT seen, NOT present, or absent, do NOT create an entry for it.
3. Use null when a value is not stated. Never invent a value.
4. quantity must be the number actually observed.

Example note: "At Clinica Sur I saw two X-ray units. No ultrasound and no CT there."
Example output: {"facility":"Clinica Sur","city":null,"country":null,"equipment":[{"modality":"X-Ray","quantity":2,"approx_age_years":null,"confidence":"high"}]}`;

const CASES = [
  { note: 'I visited Hospital Alpha in Sao Paulo today. They have three MR systems, two CT systems and four ultrasound systems. Two of the MR systems appear to be around 8 to 10 years old. One of the CTs looks fairly new but I could not check the model.',
    truth: { facility: 'Hospital Alpha', city: 'Sao Paulo', equip: { MR: 3, CT: 2, Ultrasound: 4 } } },
  { note: 'Quick note from Clinica Bellavista here in Panama City. Saw one CT, pretty old, maybe twelve years. Also two ultrasounds, no idea how old.',
    truth: { facility: 'Clinica Bellavista', city: 'Panama City', equip: { CT: 1, Ultrasound: 2 } } },
  { note: 'Was at Hospital Norte. They showed me the monitoring floor, about fifteen patient monitors. Did not see any imaging equipment.',
    truth: { facility: 'Hospital Norte', city: null, equip: { Monitoring: 15 } } }
];

function score(parsed, truth) {
  if (!parsed) return { ok: false, errs: ['sin JSON'] };
  const errs = [];
  if (!String(parsed.facility || '').toLowerCase().includes(truth.facility.toLowerCase())) errs.push(`facility="${parsed.facility}"`);
  const gotCity = parsed.city === null ? null : String(parsed.city);
  if (truth.city === null) { if (gotCity !== null) errs.push(`city="${gotCity}" deberia ser null`); }
  else if (!String(gotCity || '').toLowerCase().includes(truth.city.toLowerCase())) errs.push(`city="${gotCity}"`);
  const got = {};
  for (const e of parsed.equipment || []) got[e.modality] = (got[e.modality] || 0) + e.quantity;
  for (const [m, q] of Object.entries(truth.equip)) if (got[m] !== q) errs.push(`${m}=${got[m] ?? 'ausente'} esperado ${q}`);
  for (const m of Object.keys(got)) if (!(m in truth.equip)) errs.push(`${m} INVENTADO`);
  return { ok: errs.length === 0, errs };
}

const modelId = await sdk.loadModel({ modelSrc: sdk[MODEL_NAME] });
console.log(`modelo: ${MODEL_NAME} | temp=${TEMP} | seed=42 | ${REPEATS} corridas por caso\n`);

const all = [];
for (let i = 0; i < CASES.length; i++) {
  const outs = [];
  for (let r = 0; r < REPEATS; r++) {
    const run = sdk.completion({
      modelId,
      history: [{ role: 'system', content: SYSTEM }, { role: 'user', content: CASES[i].note }],
      stream: true,
      responseFormat: { type: 'json_schema', json_schema: { name: 'obs', schema: SCHEMA } },
      generationParams: { temp: TEMP, seed: 42, top_k: 1, predict: 400 }
    });
    let text = '';
    for await (const ev of run.events) if (ev.type === 'contentDelta') text += ev.text;
    let p = null; try { p = JSON.parse(text); } catch {}
    outs.push({ text, parsed: p, score: score(p, CASES[i].truth) });
  }
  const identical = outs.every(o => o.text === outs[0].text);
  const correct = outs.filter(o => o.score.ok).length;
  console.log(`caso ${i + 1}: identico en ${REPEATS} corridas: ${identical ? 'SI' : 'NO'} | correcto: ${correct}/${REPEATS}`);
  if (!outs[0].score.ok) console.log(`   errores 1a corrida: ${outs[0].score.errs.join(' ; ')}`);
  all.push({ case: i + 1, identical, correct, repeats: REPEATS, first: outs[0].parsed, errs: outs.map(o => o.score.errs) });
}
await sdk.unloadModel({ modelId });

mkdirSync('bench', { recursive: true });
writeFileSync(`bench/determinism_${MODEL_NAME}_temp${TEMP}.json`, JSON.stringify({ model: MODEL_NAME, temp: TEMP, results: all }, null, 2));
const det = all.filter(a => a.identical).length, acc = all.reduce((s, a) => s + a.correct, 0);
console.log(`\nRESUMEN  determinista: ${det}/${CASES.length} casos | exactitud: ${acc}/${CASES.length * REPEATS}`);
