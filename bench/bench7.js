// Exactitud del esquema compacto contra los 10 prompts oficiales de Philips.
// Resuelve los identificadores contra el catalogo local antes de puntuar,
// para comparar manzanas con manzanas frente al esquema completo.

import * as sdk from '@qvac/sdk';
import { writeFileSync, mkdirSync } from 'node:fs';
import { MODALITIES, BRANDS, STATUSES, CONFIDENCE } from '../schema.js';

const MODEL_NAME = process.argv[2] || 'GEMMA4_2B_MULTIMODAL_Q4_K_M';
const LANG = process.argv[3] || 'es';

const COMPACTO = {
  type: 'object', additionalProperties: false,
  required: ['f', 'eq'],
  properties: {
    f: { type: 'string' },
    ci: { type: ['string', 'null'] },
    eq: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['m', 'q', 'e', 'b', 'a', 'c', 's', 'ev'],
      properties: {
        m: { type: 'integer', minimum: 0, maximum: MODALITIES.length - 1 },
        q: { type: 'integer', minimum: 1 },
        e: { type: 'boolean' },
        b: { type: 'integer', minimum: -1, maximum: BRANDS.length - 1 },
        a: { type: ['number', 'null'] },
        c: { type: 'integer', minimum: 0, maximum: 2 },
        s: { type: 'integer', minimum: 0, maximum: 3 },
        ev: { type: 'string' }
      } } }
  }
};

const SISTEMA = `Extraes equipo medico de una nota de campo. Responde solo el JSON compacto.
Claves: f sitio, ci ciudad, eq equipos. Por equipo: m modalidad, q cantidad, e cantidad estimada,
b marca, a edad en anios, c confianza, s estado, ev evidencia.

m: ${MODALITIES.map((v, i) => i + '=' + v).join(' ')}
b: -1=desconocida ${BRANDS.map((v, i) => i + '=' + v).join(' ')}
c: ${CONFIDENCE.map((v, i) => i + '=' + v).join(' ')}
s: ${STATUSES.map((v, i) => i + '=' + v).join(' ')}

Reglas:
1. Solo equipo que el observador VIO. Si la nota dice que algo NO estaba, no crees fila.
2. b=-1 si no se menciona la marca. Nunca adivines una marca.
3. e=true SOLO si la cantidad viene con duda: "unos", "quizas", "varios", "como". Si dice un numero claro, e=false.
4. a solo si se menciona un numero de anios. Si dice "nuevo" o "viejo" sin numero, a=null.
5. Si la misma modalidad tiene edades distintas, crea filas separadas.
6. ev es la cita TEXTUAL de la nota que justifica la fila, copiada palabra por palabra.
Sinonimos: resonancia/resonador/MRI=0, tomografo/scanner/CT=1, ecografo/ultrasonido=2, monitores de paciente=4.`;

const CASES = [
  { en: 'I am at Hospital DemoCare Pacific in Panama. They have two MR systems and one CT.',
    es: 'Estoy en el Hospital DemoCare Pacific en Panama. Tienen dos resonadores y un tomografo.',
    truth: { facility: 'DemoCare Pacific', equip: { MR: 2, CT: 1 } } },
  { en: 'At Hospital DemoCare Horizon I saw three MR systems. Two seem old and one looks much newer.',
    es: 'En el Hospital DemoCare Horizon vi tres resonadores. Dos se ven viejos y uno se ve mucho mas nuevo.',
    truth: { facility: 'DemoCare Horizon', equip: { MR: 3 }, minRows: 2 } },
  { en: 'Clinica DemoCare Light has two CT scanners, both Orion Imaging, around eleven years old.',
    es: 'La Clinica DemoCare Light tiene dos tomografos, ambos Orion Imaging, de unos once anios.',
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
    es: 'El Hospital DemoCare Park tiene un resonador, quizas de diez anios, mas tres tomografos.',
    truth: { facility: 'DemoCare Park', equip: { MR: 1, CT: 3 }, age: 10 } },
  { en: 'Clinica DemoCare Central has many ultrasound systems, maybe eight, all Aurelia Health.',
    es: 'La Clinica DemoCare Central tiene muchos ecografos, quizas ocho, todos Aurelia Health.',
    truth: { facility: 'DemoCare Central', equip: { Ultrasound: 8 }, brand: 'Aurelia Health', estimate: true } },
  { en: 'Instituto DemoCare Lima has two old CTs and one recently installed MR.',
    es: 'El Instituto DemoCare Lima tiene dos tomografos viejos y un resonador instalado hace poco.',
    truth: { facility: 'DemoCare Lima', equip: { CT: 2, MR: 1 } } },
  { en: 'Hospital DemoCare Metro North has two MR systems. I know the brand is Aurelia Health but not the model.',
    es: 'El Hospital DemoCare Metro North tiene dos resonadores. Se que la marca es Aurelia Health pero no el modelo.',
    truth: { facility: 'DemoCare Metro North', equip: { MR: 2 }, brand: 'Aurelia Health' } }
];

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '');

// Traduce la salida compacta al mismo shape que el esquema completo.
function resolver(p) {
  if (!p) return null;
  return {
    facility: p.f, city: p.ci ?? null,
    equipment: (p.eq || []).map(e => ({
      modality: MODALITIES[e.m], quantity: e.q, quantity_is_estimate: e.e,
      brand: e.b === -1 ? null : BRANDS[e.b], approx_age_years: e.a,
      confidence: CONFIDENCE[e.c], status: STATUSES[e.s], evidence: e.ev
    }))
  };
}

function score(p, t, note) {
  if (!p) return { errs: ['sin JSON'], ev: 0, evT: 0 };
  const errs = [];
  if (!norm(p.facility).includes(norm(t.facility))) errs.push(`facility="${p.facility}"`);
  const got = {};
  for (const e of p.equipment) got[e.modality] = (got[e.modality] || 0) + e.quantity;
  for (const [m, q] of Object.entries(t.equip)) if (got[m] !== q) errs.push(`${m}=${got[m] ?? 'ausente'} esp ${q}`);
  for (const m of Object.keys(got)) if (!(m in t.equip)) errs.push(`${m} INVENTADO`);
  if (t.minRows && p.equipment.length < t.minRows) errs.push(`${p.equipment.length} filas, esp >=${t.minRows}`);
  if (t.brand && !p.equipment.some(e => norm(e.brand).includes(norm(t.brand)))) errs.push(`marca ${t.brand} perdida`);
  if (t.brandNull && p.equipment.some(e => e.brand)) errs.push('invento marca');
  if (t.age && !p.equipment.some(e => e.approx_age_years !== null && Math.abs(e.approx_age_years - t.age) <= 1)) errs.push(`edad ~${t.age} perdida`);
  if (t.estimate && !p.equipment.some(e => e.quantity_is_estimate)) errs.push('no marco estimado');
  const n = norm(note);
  const q = p.equipment.map(e => e.evidence).filter(Boolean);
  const bad = q.filter(x => !n.includes(norm(x)));
  return { errs, ev: q.length - bad.length, evT: q.length, bad };
}

const modelId = await sdk.loadModel({ modelSrc: sdk[MODEL_NAME], modelConfig: { ctx_size: 4096 } });
console.log(`compacto | ${MODEL_NAME} | ${LANG}\n`);

let ok = 0, evOk = 0, evT = 0, totMs = 0;
const rows = [];
for (let i = 0; i < CASES.length; i++) {
  const note = CASES[i][LANG];
  const t0 = Date.now();
  const run = sdk.completion({
    modelId, history: [{ role: 'system', content: SISTEMA }, { role: 'user', content: note }],
    stream: true,
    responseFormat: { type: 'json_schema', json_schema: { name: 'obs', schema: COMPACTO } },
    generationParams: { temp: 0, seed: 42, top_k: 1, predict: 600 },
    ...(process.argv[4] === 'nocache' ? {} : { kvCache: `compacto-${LANG}-${i}` })
  });
  let text = '';
  for await (const ev of run.events) if (ev.type === 'contentDelta') text += ev.text;
  const ms = Date.now() - t0; totMs += ms;
  let raw = null; try { raw = JSON.parse(text); } catch {}
  const p = resolver(raw);
  const s = score(p, CASES[i].truth, note);
  if (!s.errs.length) ok++;
  evOk += s.ev; evT += s.evT;
  console.log(`${String(i + 1).padStart(2)}. ${s.errs.length ? 'FALLA' : 'OK  '} ${ms}ms  evidencia ${s.ev}/${s.evT}`);
  if (s.errs.length) console.log(`      ${s.errs.join(' ; ')}`);
  rows.push({ n: i + 1, note, ms, ok: !s.errs.length, errs: s.errs, resolved: p });
}
await sdk.unloadModel({ modelId });
mkdirSync('bench', { recursive: true });
writeFileSync(`bench/compacto10_${MODEL_NAME}_${LANG}.json`, JSON.stringify({ model: MODEL_NAME, lang: LANG, schema: 'compacto', passed: ok, total: 10, evidence: `${evOk}/${evT}`, avg_ms: Math.round(totMs / 10), rows }, null, 2));
console.log(`\nRESUMEN compacto ${MODEL_NAME} [${LANG}]`);
console.log(`  correctos       : ${ok}/10`);
console.log(`  citas validas   : ${evOk}/${evT}`);
console.log(`  tiempo promedio : ${Math.round(totMs / 10)} ms`);
