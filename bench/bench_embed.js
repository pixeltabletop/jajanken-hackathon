// Prueba de embeddings para resolucion de entidades.
//
// El brief de Philips pide detectar duplicados: varios empleados reportando
// el mismo hospital. El problema real de este dataset es que contiene dos
// clientes DISTINTOS con nombres casi identicos:
//     Hospital DemoCare North        -> Monterrey, Mexico
//     Hospital DemoCare Metro North  -> Quito, Ecuador
// Un emparejador ingenuo los funde y corrompe la base. Esta prueba mide
// las dos cosas a la vez: si acerca las variantes de un mismo hospital y
// si mantiene separados los dos que deben quedar separados.

import * as sdk from '@qvac/sdk';
import { writeFileSync, mkdirSync } from 'node:fs';

const MODEL_NAME = process.argv[2] || 'EMBEDDINGGEMMA_300M_Q8_0';

const CANON = [
  'Hospital DemoCare Pacific', 'Hospital DemoCare Horizon', 'Clinica DemoCare Light',
  'Centro Medico DemoCare Valley', 'Hospital DemoCare North', 'Clinica DemoCare Andes',
  'Hospital DemoCare Park', 'Clinica DemoCare Central', 'Hospital DemoCare Pines',
  'Instituto DemoCare Lima', 'Hospital DemoCare Green',
  'Centro Diagnostico DemoCare Caribbean', 'Hospital DemoCare Metro North'
];

// Cada consulta es como podria llegar el nombre: dicho corto, en espanol,
// o mal transcrito por el reconocimiento de voz.
const QUERIES = [
  { q: 'DemoCare Pacific', expect: 'Hospital DemoCare Pacific', kind: 'forma corta' },
  { q: 'hospital democare pacifico', expect: 'Hospital DemoCare Pacific', kind: 'castellanizado' },
  { q: 'Demo Care Pacific', expect: 'Hospital DemoCare Pacific', kind: 'ASR separa palabras' },
  { q: 'el DemoCare de Panama', expect: 'Hospital DemoCare Pacific', kind: 'coloquial' },
  { q: 'Clinica DemoCare Luz', expect: 'Clinica DemoCare Light', kind: 'traducido' },
  { q: 'DemoCare Valley', expect: 'Centro Medico DemoCare Valley', kind: 'forma corta' },
  { q: 'Instituto DemoCare de Lima', expect: 'Instituto DemoCare Lima', kind: 'con preposicion' },
  { q: 'DemoCare Caribbean', expect: 'Centro Diagnostico DemoCare Caribbean', kind: 'forma corta' },
  // Los dos criticos: deben resolver a hospitales DISTINTOS.
  { q: 'Hospital DemoCare North', expect: 'Hospital DemoCare North', kind: 'CRITICO exacto' },
  { q: 'Hospital DemoCare Metro North', expect: 'Hospital DemoCare Metro North', kind: 'CRITICO exacto' },
  { q: 'DemoCare North en Monterrey', expect: 'Hospital DemoCare North', kind: 'CRITICO con ciudad' },
  { q: 'DemoCare Metro North en Quito', expect: 'Hospital DemoCare Metro North', kind: 'CRITICO con ciudad' }
];

const cos = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb));
};

const modelId = await sdk.loadModel({ modelSrc: sdk[MODEL_NAME] });
console.log(`modelo de embeddings: ${MODEL_NAME}\n`);

const t0 = Date.now();
const canonVecs = [];
for (const c of CANON) canonVecs.push((await sdk.embed({ modelId, text: c })).embedding);
const embedMs = Date.now() - t0;
console.log(`${CANON.length} nombres canonicos vectorizados en ${embedMs}ms (${Math.round(embedMs / CANON.length)}ms c/u)`);
console.log(`dimensiones del vector: ${canonVecs[0].length}\n`);

const rows = [];
let ok = 0, okCrit = 0, totCrit = 0;

for (const { q, expect, kind } of QUERIES) {
  const v = (await sdk.embed({ modelId, text: q })).embedding;
  const ranked = CANON.map((c, i) => ({ c, s: cos(v, canonVecs[i]) })).sort((a, b) => b.s - a.s);
  const hit = ranked[0].c === expect;
  const margin = ranked[0].s - ranked[1].s;
  if (hit) ok++;
  const crit = kind.startsWith('CRITICO');
  if (crit) { totCrit++; if (hit) okCrit++; }

  console.log(`${hit ? 'OK  ' : 'FALLA'} [${kind}] "${q}"`);
  console.log(`      1o ${ranked[0].s.toFixed(3)} ${ranked[0].c}`);
  console.log(`      2o ${ranked[1].s.toFixed(3)} ${ranked[1].c}   margen ${margin.toFixed(3)}`);
  rows.push({ query: q, kind, expected: expect, top1: ranked[0].c, top1_score: +ranked[0].s.toFixed(4), top2: ranked[1].c, top2_score: +ranked[1].s.toFixed(4), margin: +margin.toFixed(4), hit });
}

// Que tan parecidos se ven los dos hospitales que NO deben fundirse
const iN = CANON.indexOf('Hospital DemoCare North');
const iM = CANON.indexOf('Hospital DemoCare Metro North');
const confusion = cos(canonVecs[iN], canonVecs[iM]);

await sdk.unloadModel({ modelId });
mkdirSync('bench', { recursive: true });
writeFileSync(`bench/embed_${MODEL_NAME}.json`, JSON.stringify({
  model: MODEL_NAME, dims: canonVecs[0].length, embed_ms_each: Math.round(embedMs / CANON.length),
  matched: `${ok}/${QUERIES.length}`, critical: `${okCrit}/${totCrit}`,
  north_vs_metro_north_similarity: +confusion.toFixed(4), rows
}, null, 2));

console.log(`\nRESUMEN ${MODEL_NAME}`);
console.log(`  variantes resueltas      : ${ok}/${QUERIES.length}`);
console.log(`  casos criticos           : ${okCrit}/${totCrit}`);
console.log(`  similitud North vs Metro : ${confusion.toFixed(3)}  (mientras mas alto, mas riesgo de fundirlos)`);
console.log(`  costo por vector         : ${Math.round(embedMs / CANON.length)} ms`);
