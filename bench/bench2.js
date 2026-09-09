import * as sdk from '@qvac/sdk';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODEL_NAME = process.argv[2] || 'QWEN3_600M_INST_Q4';
const modelSrc = sdk[MODEL_NAME];
if (!modelSrc) { console.error('Constante desconocida:', MODEL_NAME); process.exit(1); }

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['facility', 'city', 'country', 'equipment'],
  properties: {
    facility: { type: 'string' },
    city: { type: ['string', 'null'] },
    country: { type: ['string', 'null'] },
    equipment: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['modality', 'quantity', 'approx_age_years', 'confidence'],
        properties: {
          modality: { type: 'string', enum: ['MR', 'CT', 'Ultrasound', 'X-Ray', 'Monitoring', 'Other'] },
          quantity: { type: 'integer' },
          approx_age_years: { type: ['string', 'null'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
        }
      }
    }
  }
};

const SYSTEM = 'Extract medical-equipment observations from the field note into the required JSON. Use null when a value is not stated. Never invent values.';
const CASES = [
  'I visited Hospital Alpha in Sao Paulo today. They have three MR systems, two CT systems and four ultrasound systems. Two of the MR systems appear to be around 8 to 10 years old. One of the CTs looks fairly new but I could not check the model.',
  'Quick note from Clinica Bellavista here in Panama City. Saw one CT, pretty old, maybe twelve years. Also two ultrasounds, no idea how old.',
  'Was at Hospital Norte. They showed me the monitoring floor, about fifteen patient monitors. Did not see any imaging equipment.'
];

process.stderr.write(`Cargando ${MODEL_NAME} ...\n`);
let lastPct = -1;
const loadStart = Date.now();
const modelId = await sdk.loadModel({
  modelSrc,
  onProgress: (p) => {
    if (!p?.total) return;
    const pct = Math.floor(p.percentage / 5) * 5;
    if (pct === lastPct) return;
    lastPct = pct;
    process.stderr.write(`  descarga ${pct}%\n`);
  }
});
const loadMs = Date.now() - loadStart;
process.stderr.write(`  modelo listo en ${(loadMs / 1000).toFixed(1)}s\n\n`);

const runs = [];
for (let i = 0; i < CASES.length; i++) {
  const history = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: CASES[i] }
  ];
  const t = Date.now();
  let ttft = null, tokens = 0, text = '';
  const run = sdk.completion({
    modelId,
    history,
    stream: true,
    responseFormat: { type: 'json_schema', json_schema: { name: 'installed_base_observation', schema: SCHEMA } }
  });
  for await (const ev of run.events) {
    if (ev.type === 'contentDelta') {
      if (ttft === null) ttft = Date.now() - t;
      tokens++;
      text += ev.text;
    }
  }
  const totalMs = Date.now() - t;
  let parsed = null, valid = false;
  try { parsed = JSON.parse(text); valid = true; } catch {}
  const decodeMs = totalMs - (ttft ?? 0);
  runs.push({
    case_index: i,
    input: CASES[i],
    ttft_ms: ttft,
    total_ms: totalMs,
    output_tokens: tokens,
    decode_tokens_per_sec: decodeMs > 0 ? +(tokens / (decodeMs / 1000)).toFixed(2) : null,
    json_valid: valid,
    output: parsed ?? text
  });
  console.log(`--- caso ${i + 1} --- TTFT ${ttft}ms | ${tokens} tok | JSON valido: ${valid}`);
  console.log(JSON.stringify(parsed ?? text, null, 2));
  console.log('');
}

await sdk.unloadModel({ modelId });

const report = {
  timestamp: new Date().toISOString(),
  model_constant: MODEL_NAME,
  hardware: 'HP ProBook 450 G10 / Intel i7-1355U / 16GB RAM / Intel UHD iGPU / Windows 11 / Vulkan 1.4.313',
  constrained_decoding: 'json_schema -> GBNF (llama.cpp)',
  model_load_ms: loadMs,
  runs
};
mkdirSync('bench', { recursive: true });
writeFileSync(`bench/${MODEL_NAME}_schema.json`, JSON.stringify(report, null, 2));

const ok = runs.filter(r => r.json_valid).length;
const avgTtft = Math.round(runs.reduce((a, r) => a + (r.ttft_ms ?? 0), 0) / runs.length);
const avgTps = +(runs.reduce((a, r) => a + (r.decode_tokens_per_sec ?? 0), 0) / runs.length).toFixed(2);
console.log('=============== RESUMEN ===============');
console.log('modelo           :', MODEL_NAME);
console.log('carga            :', (loadMs / 1000).toFixed(1), 's');
console.log('JSON valido      :', ok + '/' + runs.length);
console.log('TTFT promedio    :', avgTtft, 'ms');
console.log('throughput prom. :', avgTps, 'tok/s');
