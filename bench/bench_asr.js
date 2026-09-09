// Prueba de voz a texto sobre las 10 notas en espanol.
// Lo critico no es el porcentaje global de palabras: es si el nombre del
// hospital y las cantidades sobreviven, porque de eso depende que la
// extraccion posterior encuentre el registro correcto.

import * as sdk from '@qvac/sdk';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

const MODEL_NAME = process.argv[2] || 'WHISPER_SPANISH_TINY_Q8_0';

const REF = [
  { text: 'Estoy en el Hospital DemoCare Pacific en Panama. Tienen dos resonadores y un tomografo.', facility: 'democare pacific', numbers: ['dos', 'un'] },
  { text: 'En el Hospital DemoCare Horizon vi tres resonadores. Dos se ven viejos y uno se ve mucho mas nuevo.', facility: 'democare horizon', numbers: ['tres', 'dos', 'uno'] },
  { text: 'La Clinica DemoCare Light tiene dos tomografos, ambos Orion Imaging, de unos once anios.', facility: 'democare light', numbers: ['dos', 'once'] },
  { text: 'El Centro Medico DemoCare Valley tiene un resonador y dos tomografos. No se las marcas.', facility: 'democare valley', numbers: ['un', 'dos'] },
  { text: 'El Hospital DemoCare North tiene unos seis ecografos, casi todos nuevos.', facility: 'democare north', numbers: ['seis'] },
  { text: 'La Clinica DemoCare Andes tiene un tomografo muy viejo y dos resonadores del mismo fabricante.', facility: 'democare andes', numbers: ['un', 'dos'] },
  { text: 'El Hospital DemoCare Park tiene un resonador, quizas de diez anios, mas tres tomografos.', facility: 'democare park', numbers: ['un', 'diez', 'tres'] },
  { text: 'La Clinica DemoCare Central tiene muchos ecografos, quizas ocho, todos Aurelia Health.', facility: 'democare central', numbers: ['ocho'] },
  { text: 'El Instituto DemoCare Lima tiene dos tomografos viejos y un resonador instalado hace poco.', facility: 'democare lima', numbers: ['dos', 'un'] },
  { text: 'El Hospital DemoCare Metro North tiene dos resonadores. Se que la marca es Aurelia Health pero no el modelo.', facility: 'democare metro north', numbers: ['dos'] }
];

const norm = s => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Distancia de edicion a nivel de palabra -> tasa de error (WER)
function wer(ref, hyp) {
  const r = norm(ref).split(' '), h = norm(hyp).split(' ');
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 0; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++)
    for (let j = 1; j <= h.length; j++)
      d[i][j] = r[i - 1] === h[j - 1] ? d[i - 1][j - 1] : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1]);
  return d[r.length][h.length] / r.length;
}

// MODO: "auto" replica el error original (sin idioma). "es" fuerza espanol.
// "es+prompt" ademas siembra los nombres propios via initial_prompt, que es
// la palanca de whisper.cpp para sesgar hacia un vocabulario conocido.
const MODE = process.argv[3] || 'es';
const HINT = 'Nota de campo de un tecnico de equipo medico. Hospitales: DemoCare Pacific, DemoCare Horizon, DemoCare Light, DemoCare Valley, DemoCare North, DemoCare Andes, DemoCare Park, DemoCare Central, DemoCare Pines, DemoCare Lima, DemoCare Green, DemoCare Caribbean, DemoCare Metro North. Marcas: NovaMed, Aurelia Health, BluePeak Medical, Orion Imaging, HelixCare, Zenith MedTech.';

const config = {};
if (MODE !== 'auto') { config.language = 'es'; config.translate = false; }
if (MODE === 'es+prompt') config.initial_prompt = HINT;

const modelId = await sdk.loadModel({
  modelSrc: sdk[MODEL_NAME],
  ...(Object.keys(config).length ? { modelConfig: config } : {})
});
console.log(`modelo ASR: ${MODEL_NAME} | modo: ${MODE}\n`);

const rows = [];
let werSum = 0, facOk = 0, numOk = 0, numTot = 0, msSum = 0;

for (let i = 0; i < REF.length; i++) {
  const path = `audio/es_${String(i + 1).padStart(2, '0')}.wav`;
  if (!existsSync(path)) { console.log(`falta ${path}`); continue; }
  const t0 = Date.now();
  let hyp = '';
  try { hyp = await sdk.transcribe({ modelId, audioChunk: path }); }
  catch (e) { hyp = `ERROR: ${e.message}`; }
  const ms = Date.now() - t0; msSum += ms;

  const w = wer(REF[i].text, hyp); werSum += w;
  const nh = norm(hyp);
  const fac = nh.includes(norm(REF[i].facility));
  if (fac) facOk++;
  const nums = REF[i].numbers.filter(n => nh.includes(' ' + n + ' ') || nh.startsWith(n + ' ') || nh.endsWith(' ' + n));
  numOk += nums.length; numTot += REF[i].numbers.length;

  console.log(`${String(i + 1).padStart(2)}. WER ${(w * 100).toFixed(0).padStart(3)}%  hospital ${fac ? 'OK  ' : 'ROTO'}  numeros ${nums.length}/${REF[i].numbers.length}  ${ms}ms`);
  if (!fac) console.log(`      oyo: "${String(hyp).trim().slice(0, 110)}"`);

  rows.push({ n: i + 1, ref: REF[i].text, hyp: String(hyp).trim(), wer: +(w * 100).toFixed(1), facility_ok: fac, numbers: `${nums.length}/${REF[i].numbers.length}`, ms });
}

await sdk.unloadModel({ modelId });
mkdirSync('bench', { recursive: true });
writeFileSync(`bench/asr_${MODEL_NAME}_${MODE}.json`, JSON.stringify({
  model: MODEL_NAME, audio: 'Windows SAPI es-MX, 16kHz mono, voz sintetica',
  avg_wer_pct: +(werSum / rows.length * 100).toFixed(1),
  facility_ok: `${facOk}/${rows.length}`, numbers_ok: `${numOk}/${numTot}`,
  avg_ms: Math.round(msSum / rows.length), rows
}, null, 2));

console.log(`\nRESUMEN ${MODEL_NAME}`);
console.log(`  WER promedio        : ${(werSum / rows.length * 100).toFixed(1)}%`);
console.log(`  hospital reconocido : ${facOk}/${rows.length}`);
console.log(`  numeros correctos   : ${numOk}/${numTot}`);
console.log(`  tiempo promedio     : ${Math.round(msSum / rows.length)} ms`);
