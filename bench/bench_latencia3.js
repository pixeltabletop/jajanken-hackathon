// La idea de Josue, bien planteada: que el modelo no escriba lo que una
// base de datos local ya sabe.
//
// El cuello es la velocidad de generacion (~7 tok/s). Entonces la palanca
// real es que el modelo escriba MENOS tokens, no que lea menos.
//
// Dos ahorros, ambos apoyados en un catalogo local:
//   1. Claves cortas. "quantity_is_estimate" cuesta ~5 tokens CADA fila.
//      "e" cuesta 1. El modelo genera las claves, no solo los valores.
//   2. Identificadores en vez de texto. En vez de escribir "Aurelia Health"
//      el modelo escribe 1, y el catalogo local resuelve el nombre.
//      En vez de copiar la cita, escribe posiciones de caracter.

import * as sdk from '@qvac/sdk';
import { writeFileSync, mkdirSync } from 'node:fs';
import { OBSERVATION_SCHEMA, SYSTEM_ES, MODALITIES, BRANDS, STATUSES, CONFIDENCE } from '../schema.js';

const MODEL_NAME = process.argv[2] || 'GEMMA4_2B_MULTIMODAL_Q4_K_M';

const NOTAS = [
  'Estoy en el Hospital DemoCare Pacific en Panama. Tienen dos resonadores y un tomografo.',
  'El Hospital DemoCare Park tiene un resonador, quizas de diez anios, mas tres tomografos.',
  'La Clinica DemoCare Central tiene muchos ecografos, quizas ocho, todos Aurelia Health.'
];

// Esquema compacto: claves de una letra, catalogos como indices,
// evidencia como par de posiciones en la nota.
const COMPACTO = {
  type: 'object', additionalProperties: false,
  required: ['f', 'eq'],
  properties: {
    f: { type: 'string' },                                  // nombre del sitio
    ci: { type: ['string', 'null'] },                       // ciudad
    eq: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['m', 'q', 'e', 'b', 'a', 'c', 's', 'ev'],
        properties: {
          m: { type: 'integer', minimum: 0, maximum: MODALITIES.length - 1 },   // modalidad
          q: { type: 'integer', minimum: 1 },                                    // cantidad
          e: { type: 'boolean' },                                                // cantidad estimada
          b: { type: 'integer', minimum: -1, maximum: BRANDS.length - 1 },        // marca, -1 = desconocida
          a: { type: ['number', 'null'] },                                        // edad en anios
          c: { type: 'integer', minimum: 0, maximum: 2 },                          // confianza
          s: { type: 'integer', minimum: 0, maximum: 3 },                          // estado
          ev: { type: 'string' } // cita textual
        }
      }
    }
  }
};

const SISTEMA_COMPACTO = `Extraes equipo medico de una nota de campo. Responde solo el JSON compacto.
Claves: f sitio, ci ciudad, eq equipos. Por equipo: m modalidad, q cantidad, e cantidad estimada,
b marca, a edad en anios, c confianza, s estado, ev evidencia.

m (modalidad): ${MODALITIES.map((v, i) => i + '=' + v).join(' ')}
b (marca): -1=desconocida ${BRANDS.map((v, i) => i + '=' + v).join(' ')}
c (confianza): ${CONFIDENCE.map((v, i) => i + '=' + v).join(' ')}
s (estado): ${STATUSES.map((v, i) => i + '=' + v).join(' ')}

Reglas: solo equipo que el observador vio. b=-1 si no se menciona la marca, nunca adivines.
e=true si la cantidad viene con duda como "unos", "quizas", "varios".
a solo si se dice un numero de anios, si no null.
ev es la cita TEXTUAL de la nota que justifica la fila, copiada palabra por palabra.
Sinonimos: resonancia y resonador = 0, tomografo y scanner = 1, ecografo y ultrasonido = 2, monitores = 4.`;

const VARIANTES = [
  { id: 'A completo', schema: OBSERVATION_SCHEMA, system: SYSTEM_ES, kv: false },
  { id: 'E compacto', schema: COMPACTO, system: SISTEMA_COMPACTO, kv: false },
  { id: 'E compacto + cache', schema: COMPACTO, system: SISTEMA_COMPACTO, kv: true }
];

const modelId = await sdk.loadModel({ modelSrc: sdk[MODEL_NAME] });
console.log(`modelo: ${MODEL_NAME}\n`);
console.log('variante              prompt  salida    TTFT    tok/s   total');
console.log('-'.repeat(64));

const out = [];
for (const v of VARIANTES) {
  let pt = 0, gt = 0, ttft = 0, tps = 0, ms = 0;
  const salidas = [];
  for (const nota of NOTAS) {
    const t0 = Date.now();
    const run = sdk.completion({
      modelId,
      history: [{ role: 'system', content: v.system }, { role: 'user', content: nota }],
      stream: true,
      responseFormat: { type: 'json_schema', json_schema: { name: 'obs', schema: v.schema } },
      generationParams: { temp: 0, seed: 42, top_k: 1, predict: 900 },
      ...(v.kv ? { kvCache: 'compacto-test' } : {})
    });
    let text = '';
    for await (const ev of run.events) if (ev.type === 'contentDelta') text += ev.text;
    const fin = await run.final;
    ms += Date.now() - t0;
    const s = fin.stats || {};
    pt += s.promptTokens || 0; gt += s.generatedTokens || 0;
    ttft += s.timeToFirstToken || 0; tps += s.tokensPerSecond || 0;
    salidas.push(text);
  }
  const n = NOTAS.length;
  const row = { variante: v.id, prompt: Math.round(pt / n), salida: Math.round(gt / n), ttft: Math.round(ttft / n), tps: +(tps / n).toFixed(1), total_ms: Math.round(ms / n), muestra: salidas[0] };
  out.push(row);
  console.log(row.variante.padEnd(21) + String(row.prompt).padStart(6) + String(row.salida).padStart(8) +
    String(row.ttft + 'ms').padStart(9) + String(row.tps).padStart(8) + String((row.total_ms / 1000).toFixed(1) + 's').padStart(8));
}

await sdk.unloadModel({ modelId });
mkdirSync('bench', { recursive: true });
writeFileSync(`bench/latencia3_${MODEL_NAME}.json`, JSON.stringify({ model: MODEL_NAME, variantes: out }, null, 2));

console.log('\nSALIDA COMPACTA de la nota 1:');
console.log('  ' + out[1].muestra);
console.log('\nnota 1 para verificar posiciones:');
console.log('  ' + JSON.stringify(NOTAS[0]));

// Resolver la salida compacta a texto legible, como haria la aplicacion.
try {
  const p = JSON.parse(out[1].muestra);
  console.log('\nRESUELTO contra el catalogo local:');
  console.log(`  sitio: ${p.f}${p.ci ? ' / ' + p.ci : ''}`);
  for (const e of p.eq) {
    const cita = e.ev;
    console.log(`  ${MODALITIES[e.m]} x${e.q}${e.e ? ' (estimado)' : ''} | marca ${e.b === -1 ? 'Desconocida' : BRANDS[e.b]} | ${CONFIDENCE[e.c]} | ${STATUSES[e.s]}`);
    console.log(`     evidencia -> "${cita}"`);
  }
} catch (err) { console.log('\nno se pudo resolver:', err.message); }

const ahorro = ((out[0].total_ms - out[2].total_ms) / out[0].total_ms * 100).toFixed(0);
console.log(`\nA completo ${(out[0].total_ms / 1000).toFixed(1)}s  ->  E compacto+cache ${(out[2].total_ms / 1000).toFixed(1)}s   ahorro ${ahorro}%`);
