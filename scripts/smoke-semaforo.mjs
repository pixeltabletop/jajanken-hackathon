// El semáforo dice la verdad. Prueba SIN Electron.
//
//   node scripts/smoke-semaforo.mjs
//
// Qué demuestra, en este orden:
//
//   1. Con el worker sano, `verifyStatus` no da falsas alarmas.
//   2. Matando el worker, `verifyStatus` lo detecta SIN correr una sola
//      inferencia. Antes hacía falta que alguien tropezara para enterarse.
//   3. Tras detectarlo, los modelos se recargan solos.
//
// El fallo que arregla: el worker de QVAC se reinicia, los identificadores que
// guardamos en memoria dejan de existir, y `models:status` sigue devolviendo
// tres verdes mientras toda inferencia falla.

import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

process.env.QVAC_CONFIG_PATH ??= resolve('qvac.config.json')

const { loadEmbed, verifyStatus, getModelStatus, forget } = await import('../src/main/qvac/models.ts')

const fallos = []
const check = (ok, etiqueta) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${etiqueta}`)
  if (!ok) fallos.push(etiqueta)
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

// La revisión real está limitada a una cada 5 s para no inundar de RPC el sondeo
// del renderer. Las rondas con el worker sano tienen que respetar esa ventana o
// medirían la caché en vez del worker.
const VENTANA = 5200

function matarWorker() {
  try {
    const salida = execSync('tasklist /FI "IMAGENAME eq bare.exe" /NH', { encoding: 'utf8' })
    if (!/bare\.exe/i.test(salida)) return false
    execSync('taskkill /F /IM bare.exe /T', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

console.log('Cargando el modelo de deduplicación (el más liviano de los tres)...')
const t0 = Date.now()
await loadEmbed()
console.log(`   listo en ${((Date.now() - t0) / 1000).toFixed(1)} s\n`)

// --- 0. Olvidar en mitad de una carga no arranca una segunda -----------------
// Se descubrio en vivo: Gemma quedo en error con "ya registrado" y toda la
// extraccion caida, con el modelo cargado y utilizable. La causa era olvidar un
// modelo mientras se cargaba, lo que dejaba la carga en curso huerfana y hacia
// que la siguiente llamada arrancara otra en paralelo.
{
  const p1 = loadEmbed()
  await dormir(300)
  forget('embed')
  const p2 = loadEmbed()
  const r = await Promise.allSettled([p1, p2])
  const rechazos = r.filter((x) => x.status === 'rejected')
  check(rechazos.length === 0, 'olvidar un modelo mientras carga no rompe la carga',
    rechazos.length ? String(rechazos[0].reason).slice(0, 80) : 'las dos llamadas se enganchan a la misma carga')
  check(getModelStatus().embed.state === 'ready', 'y el modelo queda listo, no en error')
}

// --- 1. Worker sano: ni una falsa alarma -------------------------------------
const sano = await verifyStatus()
check(sano.embed.state === 'ready', 'con el worker sano, el semáforo sigue en verde')

await dormir(VENTANA)
const sano2 = await verifyStatus()
check(sano2.embed.state === 'ready', 'una segunda revisión tampoco lo apaga')

// --- 2. Worker muerto: se detecta sin inferir --------------------------------
console.log('\nMatando el worker de QVAC...')
const murio = matarWorker()
check(murio, 'bare.exe estaba vivo y se pudo matar')

const antes = getModelStatus()
check(antes.embed.state === 'ready', 'el estado en memoria TODAVÍA dice verde (esa era la mentira)')

// Se sondea en vez de preguntar una sola vez. `verifyStatus` solo revisa de
// verdad una vez cada VENTANA y devuelve la caché el resto del tiempo, así que
// un único disparo cronometrado es una carrera contra esa ventana, no una
// prueba. Así se mide además cuánto tarda en enterarse, que es el dato útil.
let tras = null
const tDeteccion = Date.now()
for (let i = 0; i < 24; i += 1) {
  await dormir(1000)
  const s = await verifyStatus()
  if (s.embed.state !== 'ready') {
    tras = s
    break
  }
}
console.log(
  tras
    ? `   el semáforo pasó a: ${tras.embed.state} a los ${((Date.now() - tDeteccion) / 1000).toFixed(1)} s`
    : '   el semáforo siguió en verde durante 24 s'
)
check(
  tras !== null,
  'tras matar el worker, el semáforo deja de decir verde SIN correr inferencia'
)

// --- 3. Se recupera al usarlo, no por un temporizador -------------------------
// NO se recarga solo a proposito: un fallo de un modelo no justifica releer los
// tres, y con la memoria apretada ese recalentado mataba al worker una y otra
// vez. Lo que se comprueba es que la siguiente carga funciona.
const t1 = Date.now()
const recuperado = await loadEmbed().then(() => true).catch(() => false)
check(recuperado, 'al volver a pedirlo, el modelo se carga de nuevo',
  `${((Date.now() - t1) / 1000).toFixed(1)} s`)
check(getModelStatus().embed.state === 'ready', 'y el semáforo vuelve a verde, ahora de verdad')

console.log(`\n${fallos.length === 0 ? 'SEMÁFORO OK' : `SEMÁFORO CON FALLOS: ${fallos.length}`}`)
process.exit(fallos.length === 0 ? 0 : 1)
