// Descompone los ~20 s por extraccion para saber que palanca vale la pena.
//
// Hipotesis a falsear:
//   H1 el tiempo se va en generar tokens de salida, no en leer el prompt
//   H2 el campo evidence es caro porque copia texto literal
//   H3 la cache de contexto (kvCache) ahorra el prompt de sistema
//   H4 puede estar corriendo en CPU pudiendo usar la GPU integrada

import * as sdk from '@qvac/sdk';
import { writeFileSync, mkdirSync } from 'node:fs';
import { OBSERVATION_SCHEMA, SYSTEM_ES } from '../schema.js';

const MODEL_NAME = process.argv[2] || 'GEMMA4_2B_MULTIMODAL_Q4_K_M';

const NOTAS = [
  'Estoy en el Hospital DemoCare Pacific en Panama. Tienen dos resonadores y un tomografo.',
  'El Hospital DemoCare Park tiene un resonador, quizas de diez anios, mas tres tomografos.',
  'La Clinica DemoCare Central tiene muchos ecografos, quizas ocho, todos Aurelia Health.'
];

// Variante sin evidence: mismo esquema menos el campo que copia texto.
const sinEvidencia = structuredClone(OBSERVATION_SCHEMA);
sinEvidencia.properties.equipment.items.required =
  sinEvidencia.properties.equipment.items.required.filter(r => r !== 'evidence');
delete sinEvidencia.properties.equipment.items.properties.evidence;

// Pase rapido: solo lo que hace falta para pintar la ficha de inmediato.
const minimo = {
  type: 'object', additionalProperties: false,
  required: ['facility', 'equipment'],
  properties: {
    facility: { type: 'string' },
    equipment: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['modality', 'quantity'],
      properties: {
        modality: { type: 'string', enum: ['MR', 'CT', 'Ultrasound', 'X-Ray', 'Patient Monitoring', 'Image Guided Therapy', 'Other'] },
        quantity: { type: 'integer', minimum: 1 }
      } } }
  }
};

const SISTEMA_CORTO = 'Extraes equipo medico de una nota de campo. Solo lo que el observador vio. No inventes.';

const VARIANTES = [
  { id: 'A completo', schema: OBSERVATION_SCHEMA, system: SYSTEM_ES, kv: false },
  { id: 'B completo + cache', schema: OBSERVATION_SCHEMA, system: SYSTEM_ES, kv: true },
  { id: 'C sin evidencia', schema: sinEvidencia, system: SYSTEM_ES, kv: false },
  { id: 'D pase rapido', schema: minimo, system: SISTEMA_CORTO, kv: false }
];

const modelId = await sdk.loadModel({ modelSrc: sdk[MODEL_NAME] });
console.log(`modelo: ${MODEL_NAME}\n`);
console.log('variante             prompt  salida    TTFT     tok/s   total   equipo');
console.log('-'.repeat(76));

const out = [];
for (const v of VARIANTES) {
  let pt = 0, gt = 0, ttft = 0, tps = 0, ms = 0, dev = '?', cache = 0;
  for (const nota of NOTAS) {
    const t0 = Date.now();
    const run = sdk.completion({
      modelId,
      history: [{ role: 'system', content: v.system }, { role: 'user', content: nota }],
      stream: true,
      responseFormat: { type: 'json_schema', json_schema: { name: 'obs', schema: v.schema } },
      generationParams: { temp: 0, seed: 42, top_k: 1, predict: 900 },
      ...(v.kv ? { kvCache: 'latencia-test' } : {})
    });
    for await (const ev of run.events) { /* consumir */ }
    const fin = await run.final;
    ms += Date.now() - t0;
    const s = fin.stats || {};
    pt += s.promptTokens || 0; gt += s.generatedTokens || 0;
    ttft += s.timeToFirstToken || 0; tps += s.tokensPerSecond || 0;
    cache += s.cacheTokens || 0;
    dev = s.backendDevice || dev;
  }
  const n = NOTAS.length;
  const row = {
    variante: v.id,
    prompt_tokens: Math.round(pt / n), salida_tokens: Math.round(gt / n),
    ttft_ms: Math.round(ttft / n), tokens_por_seg: +(tps / n).toFixed(1),
    total_ms: Math.round(ms / n), cache_tokens: Math.round(cache / n), dispositivo: dev
  };
  out.push(row);
  console.log(
    row.variante.padEnd(20) +
    String(row.prompt_tokens).padStart(6) +
    String(row.salida_tokens).padStart(8) +
    String(row.ttft_ms + 'ms').padStart(9) +
    String(row.tokens_por_seg).padStart(8) +
    String((row.total_ms / 1000).toFixed(1) + 's').padStart(8) +
    ('  ' + row.dispositivo).padStart(9)
  );
}

await sdk.unloadModel({ modelId });
mkdirSync('bench', { recursive: true });
writeFileSync(`bench/latencia_${MODEL_NAME}.json`, JSON.stringify({ model: MODEL_NAME, variantes: out }, null, 2));

const a = out[0], d = out[3];
console.log('\nLECTURA');
console.log(`  tokens de salida A vs D : ${a.salida_tokens} -> ${d.salida_tokens}`);
console.log(`  tiempo total A vs D     : ${(a.total_ms / 1000).toFixed(1)}s -> ${(d.total_ms / 1000).toFixed(1)}s`);
console.log(`  corriendo en            : ${a.dispositivo}`);
