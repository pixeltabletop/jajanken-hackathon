// La regla dura del reto: la inferencia corre en el dispositivo. Llamar a una
// API en la nube descalifica, por bueno que sea el resto.
//
//   npm run check:sin-red
//
// Esto lo comprueba sobre el CÓDIGO QUE SE EMPAQUETA, no sobre la aplicación en
// ejecución. Es la mitad que faltaba: la verificación en vivo solo puede mirar
// las peticiones del renderer, y la inferencia no vive ahí. Vive en el proceso
// principal, que es justo el que ninguna herramienta del navegador observa.
//
// Falla, y sale con código distinto de cero, si en `src/main`, `src/shared` o
// `src/preload` aparece:
//
//   · una forma de hablar por red (fetch, XHR, WebSocket, sockets, correo…),
//   · una dirección que no sea local,
//   · otro motor de inteligencia artificial que no sea el SDK de QVAC.
//
// Los scripts de desarrollo quedan fuera a propósito: `scripts/` habla con el
// puerto de depuración de la propia aplicación y no se empaqueta. La exclusión
// se comprueba abajo contra `electron-builder.yml`, para que no sea una excusa.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAICES = ['src/main', 'src/shared', 'src/preload']

/** Cada regla dice qué busca y por qué importa, para que el fallo se entienda. */
const PROHIBIDO = [
  { re: /\bfetch\s*\(/, que: 'fetch()', por: 'petición HTTP desde el proceso que hace la inferencia' },
  { re: /\bXMLHttpRequest\b/, que: 'XMLHttpRequest', por: 'petición HTTP' },
  { re: /\bnew\s+WebSocket\b/, que: 'WebSocket', por: 'conexión persistente a un servidor' },
  { re: /\bEventSource\b/, que: 'EventSource', por: 'conexión persistente a un servidor' },
  { re: /\bnavigator\s*\.\s*sendBeacon\b/, que: 'sendBeacon', por: 'telemetría' },
  { re: /\brequire\s*\(\s*['"](node:)?(http|https|net|tls|dgram)['"]\s*\)/, que: 'módulo de red de Node', por: 'salida a la red' },
  { re: /\bfrom\s+['"](node:)?(http|https|net|tls|dgram)['"]/, que: 'módulo de red de Node', por: 'salida a la red' },
  { re: /\bnodemailer\b|\bsmtp\b/i, que: 'envío de correo', por: 'salida de datos del equipo' },
  { re: /\bopenai\b|\banthropic\b|\bgoogleapis\b|\bhuggingface\b|\bgroq\b|\bcohere\b|\breplicate\b/i, que: 'otro proveedor de IA', por: 'la inferencia debe ser solo del SDK de QVAC' }
]

/** Direcciones. Localhost sí, cualquier otra no. */
const URL_CUALQUIERA = /\bhttps?:\/\/[^\s'"`)]+/gi
const URL_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i

// `mailto:` NO es red: se lo entrega al cliente de correo del sistema operativo
// y lo dispara una persona pulsando un botón. Se declara aquí para que quede
// escrito que se pensó, en vez de que se cuele por descuido.
const PERMITIDO_EXPLICITO = [
  { patron: /mailto:/, razon: 'abre el cliente de correo del usuario, no envía nada por su cuenta' },
  { patron: /ELECTRON_RENDERER_URL/, razon: 'servidor de desarrollo de Vite, solo bajo is.dev' }
]

function archivos(dir) {
  const salida = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta))
    else if (/\.(ts|tsx|js|mjs)$/.test(nombre)) salida.push(ruta)
  }
  return salida
}

const hallazgos = []
let lineasRevisadas = 0
let archivosRevisados = 0

for (const raiz of RAICES) {
  for (const ruta of archivos(raiz)) {
    archivosRevisados += 1
    const lineas = readFileSync(ruta, 'utf8').split(/\r?\n/)
    lineas.forEach((linea, i) => {
      lineasRevisadas += 1
      const limpia = linea.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
      if (!limpia.trim()) return

      for (const regla of PROHIBIDO) {
        if (!regla.re.test(limpia)) continue
        hallazgos.push({ ruta: relative('.', ruta), linea: i + 1, que: regla.que, por: regla.por, texto: linea.trim().slice(0, 120) })
      }

      for (const url of limpia.match(URL_CUALQUIERA) ?? []) {
        if (URL_LOCAL.test(url)) continue
        if (PERMITIDO_EXPLICITO.some((p) => p.patron.test(limpia))) continue
        hallazgos.push({ ruta: relative('.', ruta), linea: i + 1, que: `dirección externa ${url}`, por: 'todo lo que sale del equipo', texto: linea.trim().slice(0, 120) })
      }
    })
  }
}

// La coartada de "los scripts no se empaquetan" solo vale si es cierta.
const builder = readFileSync('electron-builder.yml', 'utf8')
const scriptsFuera = /!scripts(\/|\b)/.test(builder)

for (const h of hallazgos) {
  console.log(`FALLA ${h.ruta}:${h.linea} · ${h.que} · ${h.por}`)
  console.log(`      ${h.texto}`)
}

console.log(`\n${archivosRevisados} archivos y ${lineasRevisadas} líneas revisadas en ${RAICES.join(', ')}`)
console.log(`scripts/ excluido del instalador: ${scriptsFuera ? 'sí, comprobado en electron-builder.yml' : 'NO, y eso invalida la exclusión'}`)

if (!scriptsFuera) {
  console.log('\nSIN RED: electron-builder.yml ya no excluye scripts/. O se vuelve a excluir, o hay que auditarlos también.')
  process.exit(1)
}

console.log(hallazgos.length === 0
  ? '\nSIN RED OK · ninguna salida a la red en el código que se empaqueta'
  : `\nSIN RED: ${hallazgos.length} hallazgos`)
process.exit(hallazgos.length === 0 ? 0 : 1)
