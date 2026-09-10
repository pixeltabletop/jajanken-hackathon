// Los casos de las dos auditorías externas del 10 de septiembre, congelados.
//
// Cada bloque de abajo reproduce el caso EXACTO que reportó un auditor, sobre
// las funciones puras y sin cargar un solo modelo. Sirve para dos cosas: dejar
// escrito qué se arregló, y que ninguno de estos fallos pueda volver a entrar
// sin que la puerta de calidad lo cace.
//
// Lo que este script NO puede comprobar: nada que necesite el motor cargado ni
// la aplicación abierta. Eso vive en `npm run smoke` y en `scripts/e2e-4b.mjs`.
//
// Uso:  node scripts/check-auditoria.mjs

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brandIsSupported, resolveCompact } from '../src/main/qvac/extract.ts'
import { desgloseDe, resolvePlan } from '../src/main/qvac/query.ts'
import { redact } from '../src/shared/query-engine.ts'
import { normalizeTranscript } from '../src/shared/transcript.ts'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')

let fallos = 0
const ok = (cond, texto, detalle = '') => {
  if (!cond) fallos++
  console.log(`  ${cond ? 'OK   ' : 'FALLA'} ${texto}${detalle ? ` · ${detalle}` : ''}`)
}

// ---------------------------------------------------------------------- H2
console.log('H2 · la forma natural de pedir un desglose\n')

for (const [pregunta, esperado] of [
  ['cuántos equipos hay en Panamá por modalidad', 'modality'],
  ['cuántos equipos hay por modalidad', 'modality'],
  ['dame el desglose por modalidad', 'modality'],
  ['equipos por marca', 'brand'],
  ['cuántos hay por ciudad', 'city'],
  ['reparto por país', 'country'],
  ['cuántos por estatus', 'status'],
  ['cuántos por confianza', 'confidence'],
  ['equipos por antigüedad', 'ageBand'],
  ['cuántos equipos hay por sitio', 'facility'],
  // Las que ya funcionaban antes del arreglo, para que no se rompan.
  ['qué marcas hay en Ciudad de Panamá', 'brand'],
  ['cuál es el estatus de las unidades en Panamá', 'status'],
  ['breakdown by modality', 'modality'],
  // Y una que NO debe convertirse en desglose.
  ['cuántos equipos hay en Panamá', null]
]) {
  ok(desgloseDe(pregunta) === esperado, `"${pregunta}"`, desgloseDe(pregunta) ?? 'sin desglose')
}

console.log('\nH2 · el filtro que el modelo se inventa\n')

const ctx = { countries: ['Panama'], cities: ['Ciudad de Panamá'] }
const vacio = { lugares: [], m: [], b: [], amin: null, amax: null, s: [], c: [], i: 0, g: -1 }

{
  // Literal de la auditoría: a "dame el desglose por modalidad" el modelo le
  // colgaba modality "MR" y la respuesta salía restringida a resonancias.
  const { plan, warnings } = resolvePlan({ ...vacio, m: [0], i: 2, g: 3 }, ctx, 'dame el desglose por modalidad')
  ok(plan.intent === 'breakdown', 'sigue siendo un desglose', plan.intent)
  ok(plan.groupBy === 'modality', 'agrupado por modalidad', String(plan.groupBy))
  ok(plan.filter.modality === null, 'el filtro MR inventado se descarta', JSON.stringify(plan.filter.modality))
  ok(warnings.some((w) => /no nombra "MR"/.test(w)), 'y no se descarta en silencio', warnings.join(' | ') || 'sin avisos')
}
{
  const { plan } = resolvePlan({ ...vacio, m: [0], i: 2, g: 3 }, ctx, 'desglose por modalidad de las resonancias')
  ok(plan.filter.modality === 'MR', 'un filtro que la pregunta sí nombra se respeta', String(plan.filter.modality))
}
{
  const { plan } = resolvePlan({ ...vacio, m: [0], i: 2, g: 4 }, ctx, 'equipos por marca')
  ok(plan.filter.modality === 'MR', 'agrupando por marca, el filtro de modalidad no se toca', String(plan.filter.modality))
}
{
  const { plan, warnings } = resolvePlan({ ...vacio, i: 1, g: -1 }, ctx, 'cuántos equipos hay en Panamá por modalidad')
  ok(plan.intent === 'breakdown', 'la pregunta convierte el conteo en desglose', plan.intent)
  ok(warnings.length > 0, 'y lo avisa', warnings.join(' | '))
}

// ---------------------------------------------------------------------- H5
console.log('\nH5 · la marca extraída se valida contra la nota\n')

// La nota literal de la auditoría. Dijo Siemens, que no está en el catálogo; el
// modelo puso NovaMed con confianza Alta y una cita textual correcta.
const nota =
  'Estoy en la Clínica DemoCare Costa del Este, en Ciudad de Panamá. Vi tres tomógrafos Siemens de unos nueve años, un resonador Zenith MedTech nuevo y dos ecógrafos sin marca visible.'

{
  const { observation, warnings } = resolveCompact(
    {
      f: 'Clínica DemoCare Costa del Este',
      ci: 'Ciudad de Panamá',
      eq: [
        { m: 1, q: 3, e: false, b: 0, a: 9, c: 0, s: 0, ev: 'tres tomógrafos Siemens de unos nueve años' },
        { m: 0, q: 1, e: false, b: 5, a: null, c: 0, s: 0, ev: 'un resonador Zenith MedTech nuevo' },
        { m: 2, q: 2, e: false, b: -1, a: null, c: 0, s: 0, ev: 'dos ecógrafos sin marca visible' }
      ]
    },
    { rawText: nota, language: 'es' }
  )
  const [ct, mr, us] = observation.equipment
  ok(ct.confidence === 'Low', 'la fila con marca inventada baja a confianza Baja', `${ct.brand} / ${ct.confidence}`)
  ok(warnings.some((w) => /NovaMed no se dice en la nota/.test(w)), 'y se avisa con el nombre', warnings.join(' | '))
  ok(mr.confidence === 'High', 'la marca que sí se dijo conserva confianza Alta', `${mr.brand} / ${mr.confidence}`)
  ok(us.confidence === 'High', 'sin marca no se penaliza nada', `${us.brand ?? 'sin marca'} / ${us.confidence}`)
  ok(ct.evidence.includes('Siemens'), 'la cita textual se conserva tal cual', ct.evidence)
}

ok(brandIsSupported(nota, 'Zenith MedTech'), 'el nombre completo cuenta')
ok(brandIsSupported('vi un equipo Zenith nuevo', 'Zenith MedTech'), 'la primera palabra también, que es como se dicta')
ok(!brandIsSupported(nota, 'NovaMed'), 'una marca que nadie dijo no cuenta')

// ---------------------------------------------------------------------- H9
console.log('\nH9 · redacción\n')

{
  const plan = {
    filter: {
      country: 'Panama', city: null, modality: null, brand: null,
      minAgeYears: null, maxAgeYears: null, status: null, confidence: null, textSearch: null
    },
    intent: 'count',
    groupBy: null
  }
  const frase = redact(plan, { rows: 12, equipment: 58, sites: 12, observations: 20, groups: [], lowConfidence: 0 })
  ok(!/:[^:]*:/.test(frase), 'la frase ya no lleva dos veces los dos puntos', frase)
  ok(frase.includes('país: Panamá'), 'y el alcance sigue estando')
}
{
  const { fixes } = normalizeTranscript('Estoy en la Clínica DemoCare Costa del Este', {
    brands: [],
    customers: ['DemoCare Costa del Este']
  })
  ok(fixes.every((f) => f.from !== f.to), 'ninguna corrección idéntica a sí misma', JSON.stringify(fixes))
}
{
  const { text, fixes } = normalizeTranscript('vi dos resinadores y unos ecagrafos en mocare', { brands: [], customers: [] })
  ok(/resonador/i.test(text) && /ecógrafo/i.test(text), 'la corrección de verdad sigue funcionando', text)
  ok(fixes.length === 3, 'y se sigue devolviendo lo que se cambió', JSON.stringify(fixes))
}

// ---------------------------------------------------------------------- H3
console.log('\nH3 · el botón de ayuda cambia de golpe, sin fundido\n')

const css = await readFile(join(RAIZ, 'src/renderer/src/assets/components.css'), 'utf8')
{
  const bloque = css.slice(css.indexOf('.helptip-btn {'), css.indexOf('.helptip-box {'))
  const trans = /transition:([^;]+);/.exec(bloque)?.[1] ?? ''
  const hover = /\.helptip-btn:hover[^{]*\{([^}]+)\}/.exec(bloque)?.[1] ?? ''
  ok(/background/.test(hover) && /color/.test(hover), 'al pasar el ratón cambian fondo Y texto a la vez', hover.trim())
  ok(!/background/.test(trans), 'y el fondo NO va en la transición', `transition:${trans.trim()}`)
  ok(!/\bcolor\b/.test(trans), 'el color tampoco: a mitad del cruce los dos tonos se encuentran en el medio')
}

// ---------------------------------------------------------------------- H4
console.log('\nH4 · el medidor de contraste no mide fotogramas de paso\n')

const medidor = await readFile(join(RAIZ, 'scripts/check-contrast-vivo.mjs'), 'utf8')
ok(/const ESPERAR_QUIETO = `/.test(medidor), 'existe la espera a que todo se detenga')
ok(/await js\(ESPERAR_QUIETO\)/.test(medidor), 'y auditar() la usa antes de medir')
ok(/getAnimations\(\)/.test(medidor), 'se le pregunta al navegador, no se espera un tiempo a ojo')
ok(/enMovimiento\(el\) \|\| saliendo\(el\)/.test(medidor), 'lo que se mueve o se va de pantalla se salta')

// Un error de sintaxis dentro de esas plantillas no lo caza ni el typecheck ni
// `node --check`: solo explota en vivo. Aquí se compilan las dos.
for (const nombre of ['AUDITOR', 'ESPERAR_QUIETO']) {
  const i = medidor.indexOf(`const ${nombre} = \``)
  const desde = medidor.indexOf('`', i) + 1
  let j = desde
  while (j < medidor.length) {
    if (medidor[j] === '\\') { j += 2; continue }
    if (medidor[j] === '`') break
    j++
  }
  const cuerpo = medidor.slice(desde, j).replace(/\\\\/g, '\\')
  try {
    new Function(`return (${cuerpo})`)
    ok(true, `${nombre} compila como expresión válida`)
  } catch (e) {
    ok(false, `${nombre} compila como expresión válida`, e.message)
  }
}

// ---------------------------------------------------------------------- H6
console.log('\nH6 · las verificaciones corren en cualquier máquina\n')

for (const s of ['audit.mjs', 'check-contrast-vivo.mjs', 'e2e-4b.mjs', 'e2e-cycle.mjs', 'smoke-semaforo-vivo.mjs', 'grabar-demo.mjs']) {
  const txt = await readFile(join(RAIZ, 'scripts', s), 'utf8')
  ok(/MAM_DEBUG_PORT/.test(txt), `${s} deja mover el puerto de depuración`)
}
{
  const e2e = await readFile(join(RAIZ, 'scripts/e2e-4b.mjs'), 'utf8')
  ok(!/localhost:5173/.test(e2e), 'la comprobación de red ya no cuelga de un puerto escrito a mano')
  ok(/hostname/.test(e2e), 'ahora lo local se reconoce por el host')
}

// ------------------------------------------------------------- nombre viejo
console.log('\nRestos del nombre anterior\n')

for (const f of ['src/main/index.ts', 'electron-builder.yml']) {
  const txt = await readFile(join(RAIZ, f), 'utf8')
  ok(!/com\.jajanken\.eco/.test(txt), `${f} usa el identificador nuevo`)
}
{
  const pkg = JSON.parse(await readFile(join(RAIZ, 'package.json'), 'utf8'))
  const lock = JSON.parse(await readFile(join(RAIZ, 'package-lock.json'), 'utf8'))
  ok(lock.name === pkg.name, 'el candado de npm se llama igual que el manifiesto', `${lock.name} / ${pkg.name}`)
  const enLock = Object.keys(lock.packages[''].dependencies ?? {}).sort().join(',')
  const enPkg = Object.keys(pkg.dependencies ?? {}).sort().join(',')
  ok(enLock === enPkg, 'y declara las mismas dependencias de producción', enLock)
}

console.log(`\n${fallos === 0 ? 'Los hallazgos auditados siguen cerrados.' : `${fallos} comprobaciones fallidas.`}`)
process.exit(fallos === 0 ? 0 : 1)
