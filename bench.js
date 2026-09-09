import * as sdk from '@qvac/sdk';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODEL_NAME = process.argv[2] || 'QWEN3_600M_INST_Q4';
const modelSrc = sdk[MODEL_NAME];
if (!modelSrc) { console.error('Unknown model constant:', MODEL_NAME); process.exit(1); }

// Caso de uso real del reto Philips: extraccion estructurada desde lenguaje natural.
const SYSTEM = `You extract medical-equipment observations into JSON.
Return ONLY a JSON object, no prose, with this exact shape:
{"facility":string,"city":string|null,"country":string|null,"equipment":[{"modality":string,"quantity":number,"approx_age_years":string|null,"confidence":"high"|"medium"|"low"}]}
Use null when the information is not stated. Never invent values.`;

const USER = `I visited Hospital Alpha in Sao Paulo today. They have three MR systems,
two CT systems and four ultrasound systems. Two of the MR systems appear to be around
8 to 10 years old. One of the CTs looks fairly new but I could not check the model.`;

const t0 = Date.now();
let sysres = null;
try { sysres = await sdk.getSystemResources(); } catch {}

process.stderr.write(`Cargando ${MODEL_NAME} ...\n`);
const loadStart = Date.now();
const modelId = await sdk.loadModel({
  modelSrc,
  onProgress: (p) => {
    if (!p || !p.total) return;
    const mb = n => (n / 1e6).toFixed(0);
    process.stderr.write(`\r  descarga ${p.percentage.toFixed(0)}% (${mb(p.downloaded)}/${mb(p.total)} MB)   `);
  }
});
const loadMs = Date.now() - loadStart;
process.stderr.write(`\n  modelo listo en ${(loadMs/1000).toFixed(1)}s\n\n`);

let info = null;
try { info = await sdk.getModelInfo({ modelId }); } catch {}

const history = [
  { role: 'system', content: SYSTEM },
  { role: 'user', content: USER }
];

const genStart = Date.now();
let ttft = null, tokens = 0, out = '';
const result = sdk.completion({ modelId, history, stream: true });
for await (const token of result.tokenStream) {
  if (ttft === null) ttft = Date.now() - genStart;
  tokens++;
  out += token;
  process.stdout.write(token);
}
const genMs = Date.now() - genStart;
await sdk.unloadModel({ modelId });

const decodeMs = genMs - (ttft ?? 0);
const report = {
  timestamp: new Date().toISOString(),
  model_constant: MODEL_NAME,
  model_info: info,
  hardware: { note: 'HP ProBook 450 G10, i7-1355U, 16GB RAM, Intel UHD iGPU, Windows 11' },
  system_resources: sysres,
  metrics: {
    model_load_ms: loadMs,
    ttft_ms: ttft,
    total_generation_ms: genMs,
    output_tokens: tokens,
    decode_tokens_per_sec: decodeMs > 0 ? +(tokens / (decodeMs / 1000)).toFixed(2) : null,
    end_to_end_ms: Date.now() - t0
  },
  prompt: { system: SYSTEM, user: USER },
  output: out
};

mkdirSync('bench', { recursive: true });
const file = `bench/${MODEL_NAME}.json`;
writeFileSync(file, JSON.stringify(report, null, 2));

console.log('\n\n=============== METRICAS ===============');
console.log('modelo              :', MODEL_NAME);
console.log('carga del modelo    :', (loadMs/1000).toFixed(1), 's');
console.log('TTFT                :', ttft, 'ms');
console.log('tokens generados    :', tokens);
console.log('throughput (decode) :', report.metrics.decode_tokens_per_sec, 'tok/s');
console.log('reporte guardado en :', file);
