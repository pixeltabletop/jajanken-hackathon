// Las reglas de comportamiento que el producto no puede romper, comprobadas
// sobre las funciones puras y sin cargar un solo modelo.
//
// Son reglas de producto, no de estilo: qué tiene que entender la consulta, qué
// no puede afirmar la extracción sin evidencia, y qué no puede quedar ilegible
// en pantalla. Cada una falló alguna vez, y por eso está escrita aquí.
//
// Uso:  node scripts/check-reglas.mjs

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

// --------------------------------------------------------------- la pregunta
console.log('La pregunta manda sobre el modelo\n')

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
  ['qué marcas hay en Ciudad de Panamá', 'brand'],
  ['cuál es el estatus de las unidades en Panamá', 'status'],
  ['breakdown by modality', 'modality'],
  ['cuántos equipos hay en Panamá', null]
]) {
  ok(desgloseDe(pregunta) === esperado, `"${pregunta}"`, desgloseDe(pregunta) ?? 'sin desglose')
}

const ctx = { countries: ['Panama'], cities: ['Ciudad de Panamá'] }
const vacio = { lugares: [], m: [], b: [], amin: null, amax: null, s: [], c: [], i: 0, g: -1 }

console.log('\nUn filtro que la pregunta no nombra no se aplica\n')
{
  const { plan, warnings } = resolvePlan({ ...vacio, m: [0], i: 2, g: 3 }, ctx, 'dame el desglose por modalidad')
  ok(plan.intent === 'breakdown', 'el desglose se respeta', plan.intent)
  ok(plan.groupBy === 'modality', 'agrupado por modalidad', String(plan.groupBy))
  ok(plan.filter.modality === null, 'el filtro que nadie pidió se descarta', JSON.stringify(plan.filter.modality))
  ok(warnings.some((w) => /no nombra "MR"/.test(w)), 'y no se descarta en silencio', warnings.join(' | ') || 'sin avisos')
}
{
  const { plan } = resolvePlan({ ...vacio, m: [0], i: 2, g: 3 }, ctx, 'desglose por modalidad de las resonancias')
  ok(plan.filter.modality === 'MR', 'un filtro que la pregunta sí nombra se respeta', String(plan.filter.modality))
}
{
  const { plan } = resolvePlan({ ...vacio, m: [0], i: 2, g: 4 }, ctx, 'equipos por marca')
  ok(plan.filter.modality === 'MR', 'filtrar por una dimensión y agrupar por otra es legítimo', String(plan.filter.modality))
}
{
  const { plan, warnings } = resolvePlan({ ...vacio, i: 1, g: -1 }, ctx, 'cuántos equipos hay en Panamá por modalidad')
  ok(plan.intent === 'breakdown', 'la frase convierte el conteo en desglose', plan.intent)
  ok(warnings.length > 0, 'y lo avisa', warnings.join(' | '))
}

// ------------------------------------------------------------- la extracción
console.log('\nNada se afirma sin evidencia en la nota\n')

// El catálogo de marcas es cerrado y el esquema obliga a elegir un índice: ante
// una marca de fuera, el modelo pone la que más se le parece. La cita puede ser
// correcta y la marca no, así que se comprueban por separado.
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
  ok(ct.confidence === 'Low', 'una marca que la nota no dice baja la confianza', `${ct.brand} / ${ct.confidence}`)
  ok(warnings.some((w) => /NovaMed no se dice en la nota/.test(w)), 'y se avisa con el nombre', warnings.join(' | '))
  ok(mr.confidence === 'High', 'la marca que sí se dijo conserva confianza Alta', `${mr.brand} / ${mr.confidence}`)
  ok(us.confidence === 'High', 'sin marca no se penaliza nada', `${us.brand ?? 'sin marca'} / ${us.confidence}`)
  ok(ct.evidence.includes('Siemens'), 'la cita textual se conserva tal cual', ct.evidence)
}

ok(brandIsSupported(nota, 'Zenith MedTech'), 'el nombre completo cuenta como dicho')
ok(brandIsSupported('vi un equipo Zenith nuevo', 'Zenith MedTech'), 'la primera palabra también, que es como se dicta')
ok(!brandIsSupported(nota, 'NovaMed'), 'una marca que nadie dijo no cuenta')

// -------------------------------------------------------------- la respuesta
console.log('\nLo que se escribe en pantalla\n')

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
  ok(!/:[^:]*:/.test(frase), 'la frase no encadena dos veces los dos puntos', frase)
  ok(frase.includes('país: Panamá'), 'y el alcance del filtro sigue estando')
}
{
  const { fixes } = normalizeTranscript('Estoy en la Clínica DemoCare Costa del Este', {
    brands: [],
    customers: ['DemoCare Costa del Este']
  })
  ok(fixes.every((f) => f.from !== f.to), 'no se enseña una corrección idéntica a sí misma', JSON.stringify(fixes))
}
{
  const { text, fixes } = normalizeTranscript('vi dos resinadores y unos ecagrafos en mocare', { brands: [], customers: [] })
  ok(/resonador/i.test(text) && /ecógrafo/i.test(text), 'el vocabulario del dominio sí se corrige', text)
  ok(fixes.length === 3, 'y cada cambio se devuelve para mostrarlo', JSON.stringify(fixes))
}

// ------------------------------------------------------------- la legibilidad
console.log('\nNada se vuelve ilegible al pasar el ratón\n')

const css = await readFile(join(RAIZ, 'src/renderer/src/assets/components.css'), 'utf8')
{
  // Este botón se INVIERTE al pasar el ratón: fondo claro con texto oscuro pasa
  // a fondo oscuro con texto claro. Si uno de los dos se anima y el otro no, o
  // si se animan los dos, durante la transición el texto desaparece.
  const bloque = css.slice(css.indexOf('.helptip-btn {'), css.indexOf('.helptip-box {'))
  const trans = /transition:([^;]+);/.exec(bloque)?.[1] ?? ''
  const hover = /\.helptip-btn:hover[^{]*\{([^}]+)\}/.exec(bloque)?.[1] ?? ''
  ok(/background/.test(hover) && /color/.test(hover), 'fondo y texto cambian juntos', hover.trim())
  ok(!/background/.test(trans) && !/\bcolor\b/.test(trans), 'y cambian de golpe, sin fundido', `transition:${trans.trim()}`)
}

// -------------------------------------------------------------- el empaquetado
console.log('\nEl paquete es coherente consigo mismo\n')

for (const f of ['src/main/index.ts', 'electron-builder.yml']) {
  const txt = await readFile(join(RAIZ, f), 'utf8')
  ok(/com\.jajanken\.mam/.test(txt), `${f} declara el mismo identificador de aplicación`)
}
{
  const pkg = JSON.parse(await readFile(join(RAIZ, 'package.json'), 'utf8'))
  const lock = JSON.parse(await readFile(join(RAIZ, 'package-lock.json'), 'utf8'))
  ok(lock.name === pkg.name, 'el candado de npm se llama igual que el manifiesto', `${lock.name} / ${pkg.name}`)
  const enLock = Object.keys(lock.packages[''].dependencies ?? {}).sort().join(',')
  const enPkg = Object.keys(pkg.dependencies ?? {}).sort().join(',')
  ok(enLock === enPkg, 'y declara las mismas dependencias de producción', enLock)
}

console.log(`\n${fallos === 0 ? 'Todas las reglas se cumplen.' : `${fallos} reglas rotas.`}`)
process.exit(fallos === 0 ? 0 : 1)
