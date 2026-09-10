// Conduce la aplicación por los trece planos de `docs/GUION-VIDEO.md` mientras
// ffmpeg graba la pantalla.
//
//   npm run demo:ensayo    # recorre y cronometra, SIN grabar
//   npm run demo:grabar    # lo mismo, grabando
//
// Por qué existe. El video es lo primero que revisa el jurado y solo hay una
// oportunidad de grabarlo bien. Coreografiar cinco minutos a mano significa
// repetir la coreografía entera cada vez que algo sale mal, y cada repetición se
// desvía un poco. Aquí la coreografía es código: si una toma sale mal, se repite
// idéntica sin volver a pensarla.
//
// Lo que este guion NO hace: la narración. Se pone encima, con la voz de una
// persona leyendo `docs/GUION-VIDEO.md`, que trae el texto palabra por palabra y
// el conteo de palabras contra la capacidad de cada plano.
//
// CUIDADO: el recargado en caliente no cubre el proceso principal. Si tocaste
// `src/main/`, cierra y vuelve a abrir la app antes de grabar.

import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, statSync } from 'node:fs'
import os from 'node:os'

const PUERTO = 9222
const ENSAYO = process.argv.includes('--ensayo')

/**
 * 30 fotogramas por segundo.
 *
 * Una demostración de interfaz es texto quieto la mayor parte del tiempo, y a
 * 15 fps se ve perfectamente. Pero este video tiene cruces entre secciones con
 * la marca animada y un logo en movimiento: por debajo de 30 esos tramos se ven
 * a tirones, y un jurado lo lee como una aplicación lenta, no como un video de
 * pocos fotogramas.
 */
const FPS = 30

/**
 * Cuanta memoria libre hace falta, y por que son dos numeros.
 *
 * Los tres modelos piden unos 4,2 GB. Pero si YA estan cargados, esa memoria
 * esta ocupada por ellos y contarla otra vez como "libre que hace falta" es
 * exigir el doble. La primera version hacia justo eso y se negaba a ensayar con
 * los modelos perfectamente listos.
 *
 * Con los modelos cargados solo hace falta holgura para ffmpeg y para el pico de
 * la inferencia. Sin cargar, hace falta sitio para los tres.
 */
const GB_SIN_CARGAR = 4.6
/**
 * 1,5 GB con los modelos ya cargados, y el numero sale de una medicion, no de
 * una corazonada. En el primer ensayo completo, con 0,4 GB libres, interpretar
 * la pregunta del plano 9 tardo 175 segundos en vez de los 30 presupuestados.
 * Con 1,8 GB libres, la MISMA pregunta tardo 13,7 s. Doce veces mas lento por
 * falta de memoria, sin ningun error y sin ninguna senal en pantalla.
 *
 * Grabar en ese estado da un video de siete minutos y medio que incumple el
 * limite del reto, y peor: hace parecer lenta una aplicacion que no lo es.
 */
const GB_YA_CARGADOS = 1.5
/** Ensayar no lanza ffmpeg, asi que necesita menos holgura. No es rebajar el
 *  liston: es que el codificador de video no esta corriendo. */
const GB_ENSAYO = 0.25

// --------------------------------------------------------------- protocolo

const t = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`).catch(() => null))?.json() ?? []
const pagina = t.find((x) => x.type === 'page' && /localhost:5173|MAM/i.test(`${x.url} ${x.title}`))
if (!pagina) {
  console.error(`No encontré la ventana de MAM en el puerto ${PUERTO}.`)
  console.error('Levántala con: npm run dev -- -- --remote-debugging-port=9222')
  process.exit(1)
}

const ws = new WebSocket(pagina.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pendientes = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pendientes.has(m.id)) { pendientes.get(m.id)(m); pendientes.delete(m.id) }
}
const envia = (method, params = {}) =>
  new Promise((r) => { const id = ++seq; pendientes.set(id, r); ws.send(JSON.stringify({ id, method, params })) })

await envia('Runtime.enable')

async function js(expr) {
  const r = await envia('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  const ex = r.result?.exceptionDetails
  if (ex) throw new Error(ex.exception?.description ?? ex.text)
  return r.result?.result?.value
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

/** Espera a un HECHO, no a un reloj. Todo lo que se puede comprobar, se comprueba. */
async function esperar(expr, queEs, limiteMs = 40000, cada = 250) {
  const t0 = Date.now()
  for (;;) {
    if (await js(expr).catch(() => false)) return Date.now() - t0
    if (Date.now() - t0 > limiteMs) throw new Error(`Tiempo agotado esperando: ${queEs}`)
    await dormir(cada)
  }
}

/**
 * Mueve el puntero al control ANTES de pulsarlo, y espera un momento.
 *
 * El guion insiste en que el ratón no salte. Un clic sintético sin movimiento
 * previo se ve en el video como si las cosas pasaran solas, que es peor que
 * lento: parece un montaje.
 */
async function pulsar(selector, queEs) {
  // Se DESPLAZA primero. Las coordenadas del protocolo son de la parte visible,
  // no del documento: un control por debajo del borde inferior recibe el clic en
  // el vacio y no pasa nada, en silencio. Costo un ensayo entero descubrirlo,
  // con el boton de interpretar a 904 pixeles en una ventana de 779 de alto.
  // Y de paso se ve mejor: en el video la pagina baja hasta el control.
  const caja = await aLaVista(selector)
  if (!caja) throw new Error(`No encontré para pulsar: ${queEs} (${selector})`)
  const { x, y } = caja
  await envia('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 })
  await dormir(420)
  await envia('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 })
  await dormir(90)
  await envia('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 })
}

/** Solo señala, sin pulsar. El guion lo pide en dos planos. */
async function senalar(selector) {
  const caja = await aLaVista(selector)
  if (!caja) return
  await envia('Input.dispatchMouseEvent', { type: 'mouseMoved', x: caja.x, y: caja.y, buttons: 0 })
}

/**
 * Trae el elemento a la parte visible y devuelve su centro, ya en coordenadas
 * de ventana. Devuelve null si no existe o no ocupa espacio.
 */
async function aLaVista(selector) {
  const bruto = await js(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)})
    if (!e) return null
    const r0 = e.getBoundingClientRect()
    if (r0.width === 0 || r0.height === 0) return null
    const fuera = r0.top < 60 || r0.bottom > innerHeight - 10
    if (fuera) e.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return JSON.stringify({ desplazo: fuera })
  })()`)
  if (!bruto) return null
  if (JSON.parse(bruto).desplazo) await dormir(700) // que termine el desplazamiento suave
  const fino = await js(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)})
    if (!e) return null
    const r = e.getBoundingClientRect()
    if (r.bottom < 0 || r.top > innerHeight) return null
    return JSON.stringify({ x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) })
  })()`)
  return fino ? JSON.parse(fino) : null
}

/** Escribe por el portapapeles, como pide el guion: nada de teclear en cámara. */
const escribir = (sel, val) =>
  js(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement : HTMLInputElement
    Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, ${JSON.stringify(val)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  })()`)

const tema = async (id) => {
  for (let i = 0; i < 3; i++) {
    if ((await js(`document.documentElement.dataset.theme`)) === id) return true
    await pulsar('#lat-tema', 'interruptor de tema')
    await dormir(800)
  }
  return (await js(`document.documentElement.dataset.theme`)) === id
}

// --------------------------------------------------------- antes de grabar

console.log('Comprobando antes de gastar una toma...\n')
const problemas = []

const estado = await js(`window.api ? window.api.modelsStatus() : null`)
const listos = estado && ['gemma', 'whisper', 'embed'].every((k) => estado[k].state === 'ready')
console.log(`   modelos      ${listos ? 'los tres listos' : JSON.stringify(estado)}`)
if (!listos) problemas.push('los tres modelos tienen que estar listos: grabar cinco minutos y descubrir al final que faltaba uno es tirar el trabajo')

const gb = os.freemem() / 1024 ** 3
const minimo = !listos ? GB_SIN_CARGAR : ENSAYO ? GB_ENSAYO : GB_YA_CARGADOS
console.log(`   memoria      ${gb.toFixed(1)} GB libres · hacen falta ${minimo} ${!listos ? '(hay que cargar los tres)' : ENSAYO ? '(ensayo: sin ffmpeg)' : '(los modelos ya ocupan lo suyo)'}`)
if (gb < minimo) problemas.push(`quedan ${gb.toFixed(1)} GB y hacen falta ${minimo}: cierra aplicaciones o el motor se muere a mitad de la inferencia`)

if (!ENSAYO) {
  const ff = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' })
  const hay = ff.status === 0
  console.log(`   ffmpeg       ${hay ? ff.stdout.split('\n')[0].slice(0, 46) : 'NO ESTÁ'}`)
  if (!hay) problemas.push('ffmpeg no está en el PATH y sin él no hay grabación')
}

const ventana = await js(`innerWidth + 'x' + innerHeight`)
console.log(`   ventana      ${ventana}`)
if (Number(String(ventana).split('x')[0]) < 1200) {
  problemas.push(`la ventana mide ${ventana} y el texto de la demostración se verá apretado: agrándala antes de grabar`)
}

const enAcceso = await js(`!!document.querySelector('.access')`)
const dentro = await js(`!!document.querySelector('.lateral')`)
console.log(`   pantalla     ${enAcceso ? 'acceso' : dentro ? 'ya dentro' : 'arranque'}`)
if (!enAcceso) problemas.push('la toma empieza en la pantalla de acceso: cierra sesión o reinicia la app antes de grabar')

if (problemas.length) {
  console.error('\nNo se graba. Arregla esto primero:')
  for (const p of problemas) console.error(`   · ${p}`)
  ws.close()
  process.exit(1)
}
console.log('\nTodo en orden.\n')

// ------------------------------------------------------------- la grabación

mkdirSync('bench/demo', { recursive: true })
const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const salida = `bench/demo/toma-${marca}.mp4`
let ffmpeg = null

if (!ENSAYO) {
  // `-i desktop` graba la pantalla entera. Se prefiere a capturar solo la
  // ventana porque el guion muestra el PDF abriéndose en otro visor, y una
  // captura por título perdería ese plano.
  ffmpeg = spawn('ffmpeg', [
    '-y', '-f', 'gdigrab', '-framerate', String(FPS), '-i', 'desktop',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    salida
  ], { stdio: ['pipe', 'ignore', 'pipe'] })
  let arranco = false
  ffmpeg.stderr.on('data', (d) => { if (/frame=/.test(String(d))) arranco = true })
  await dormir(2500)
  if (ffmpeg.exitCode !== null) {
    console.error('ffmpeg murió al arrancar. Sin grabación.')
    ws.close(); process.exit(1)
  }
  console.log(`Grabando en ${salida}\n`)
}

const inicioTotal = Date.now()
const planos = []

/**
 * Un plano. Hace lo suyo y luego espera lo que falte para cumplir su duración.
 *
 * Si se pasa del tiempo, NO se recorta: se anota la desviación y se sigue. Un
 * plano cortado a mitad se ve peor que un video de cinco minutos y dos segundos,
 * y el informe del final dice exactamente dónde se fue el tiempo.
 */
async function plano(n, titulo, segundos, hacer) {
  const t0 = Date.now()
  process.stdout.write(`Plano ${String(n).padStart(2)} · ${titulo.padEnd(38)}`)
  await hacer()
  const usado = Date.now() - t0
  const falta = segundos * 1000 - usado
  if (falta > 0) await dormir(falta)
  const real = (Date.now() - t0) / 1000
  planos.push({ n, titulo, planificado: segundos, real: +real.toFixed(1), desvio: +(real - segundos).toFixed(1) })
  console.log(`${real.toFixed(1)}s / ${segundos}s${real - segundos > 2 ? '   SE PASÓ' : ''}`)
}

const NOTA = 'Estuve en DemoCare Chiriquí. Me mostraron el piso de monitoreo, unos quince monitores de paciente. No vi ningún equipo de imagen.'
const CONSULTA = 'equipos de Panamá, en San Francisco, con confianza baja o media'

try {
  await plano(1, 'la marca y el acceso', 12, async () => {
    await dormir(4000)
  })

  await plano(2, 'entrar sin credenciales', 20, async () => {
    await senalar('.access-modo')
    await dormir(3500)
    await escribir('#acc-user', 'Josué Carrillo')
    await dormir(1800)
    await pulsar('.access button.primary, .access button', 'Entrar')
    await esperar(`!!document.querySelector('.lateral')`, 'la barra lateral tras entrar')
  })

  await plano(3, 'las dos columnas y las dos puertas', 18, async () => {
    await tema('blanco')
    await senalar('.lateral')
    await dormir(2500)
    await senalar('#door-capture')
    await dormir(1500)
    await senalar('#door-follow')
  })

  await plano(4, 'registrar: la nota', 28, async () => {
    await pulsar('#nav-capture', 'Registrar equipos')
    await esperar(`!!document.querySelector('#note')`, 'el campo de la nota')
    await dormir(1600) // el cruce de marca, entero
    await escribir('#note', NOTA)
    await dormir(3200)
    await pulsar('button.primary', 'Interpretar')
  })

  await plano(5, 'la inferencia, sin esconder la espera', 24, async () => {
    await dormir(1200)
    await senalar('.lat-semaforo')
    await dormir(1800)
    await senalar('.grid')
    await esperar(`document.querySelectorAll('tbody tr').length > 0 || !!document.querySelector('.eq-row')`,
      'las filas de equipo', 40000)
  })

  await plano(6, 'el diferenciador: cada dato con su cita', 32, async () => {
    for (const sel of ['.evidence, mark', 'tbody tr', '.eq-row']) {
      await senalar(sel)
      await dormir(2200)
    }
  })

  await plano(7, 'resolver el sitio y guardar', 20, async () => {
    await senalar('.dedup, .dup')
    await dormir(2500)
    const guardo = await pulsar('button.primary', 'Guardar').then(() => true).catch(() => false)
    if (guardo) await dormir(1200)
  })

  await plano(8, 'el registro ya está en la base', 18, async () => {
    await pulsar('#acc-base', 'Ver la base registrada')
    await esperar(`document.querySelectorAll('table').length > 0`, 'la tabla de la base')
    await senalar('tbody tr')
  })

  await plano(9, 'la pregunta en español', 30, async () => {
    await pulsar('#nav-follow', 'Seguimiento y reportes')
    await esperar(`!!document.querySelector('#q-input')`, 'la barra de pregunta')
    await dormir(1600) // el cruce, entero
    await escribir('#q-input', CONSULTA)
    await dormir(2400)
    await pulsar('#q-ask, .qbar button.primary', 'Preguntar')
    await esperar(`!!document.querySelector('.answer') && document.querySelector('.answer').textContent.length > 20`,
      'la respuesta', 40000)
  })

  await plano(10, 'qué entendió, cifras, tabla y gráficos', 30, async () => {
    await senalar('.interp-parts, .chip')
    await dormir(2600)
    await senalar('.answer')
    await dormir(2600)
    await pulsar('#tab-charts', 'pestaña de gráficos')
    await dormir(1800)
    await pulsar('.bar-btn', 'una barra del gráfico')
    await dormir(2600)
    await pulsar('.bar-btn', 'la misma barra, para quitar el filtro')
  })

  await plano(11, 'el reporte en PDF, en disco', 22, async () => {
    await pulsar('#tab-result', 'pestaña de resultados')
    await dormir(1200)
    await pulsar('.exportbar button.primary', 'Abrir PDF')
    await dormir(6000) // que el visor abra y se lea el encabezado
    await senalar('.exportbar')
  })

  await plano(12, 'los dos temas y la barra plegable', 20, async () => {
    await tema('negro')
    await dormir(2600)
    await pulsar('.lat-plegar', 'plegar la barra')
    await dormir(2800)
    await pulsar('.lat-plegar', 'desplegar la barra')
    await dormir(1200)
    await tema('blanco')
    await dormir(1200)
    await pulsar('#nav-home', 'Inicio')
  })

  await plano(13, 'cierre en el inicio', 24, async () => {
    await esperar(`document.querySelectorAll('.door').length === 2`, 'el inicio')
    await senalar('.home-logo')
  })
} catch (e) {
  console.error(`\nLa toma se interrumpió: ${e.message}`)
  console.error('No se monta un video a medias. Revisa Riesgos en vivo en docs/GUION-VIDEO.md y repite.')
} finally {
  const total = (Date.now() - inicioTotal) / 1000

  if (ffmpeg) {
    // Se cierra con `q`, NUNCA matándolo: un mp4 sin cerrar no se reproduce.
    ffmpeg.stdin.write('q')
    await new Promise((r) => { ffmpeg.on('close', r); setTimeout(r, 12000) })
  }

  console.log('\n---------------------------------------------------------------')
  console.log('Plano  Planificado  Real   Desvío  Qué')
  for (const p of planos) {
    console.log(
      `${String(p.n).padStart(4)}  ${String(p.planificado).padStart(9)}s  ${String(p.real).padStart(5)}s  ` +
      `${String(p.desvio > 0 ? '+' + p.desvio : p.desvio).padStart(6)}  ${p.titulo}`
    )
  }
  const mm = Math.floor(total / 60)
  const ss = Math.round(total % 60)
  console.log('---------------------------------------------------------------')
  console.log(`TOTAL  ${mm}:${String(ss).padStart(2, '0')}   (el reto permite 5:00 como máximo)`)
  if (total > 300) console.log('\nSE PASA DE CINCO MINUTOS. Eso incumple el reto: recorta antes de entregar.')

  const desviados = planos.filter((p) => Math.abs(p.desvio) > 2)
  if (desviados.length) {
    console.log(`\nPlanos que se desviaron más de dos segundos: ${desviados.map((p) => p.n).join(', ')}`)
  }

  let video = null
  if (ffmpeg && !ENSAYO) {
    try {
      const bytes = statSync(salida).size
      const dur = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=nw=1:nk=1', salida], { encoding: 'utf8' }).stdout.trim()
      video = { ruta: salida, mb: +(bytes / 1024 ** 2).toFixed(1), segundos: +Number(dur).toFixed(1) }
      console.log(`\nVideo: ${salida} · ${video.mb} MB · ${video.segundos} s reales`)
    } catch {
      console.log('\nNo pude medir el video. Compruébalo a mano antes de darlo por bueno.')
    }
  }

  writeFileSync(`bench/demo/toma-${marca}.json`, JSON.stringify({
    marca, ensayo: ENSAYO, totalSegundos: +total.toFixed(1), dentroDelLimite: total <= 300,
    planos, desviados: desviados.map((p) => p.n), video
  }, null, 2))
  console.log(`Informe: bench/demo/toma-${marca}.json`)

  ws.close()
  process.exit(planos.length === 13 && total <= 300 ? 0 : 1)
}
