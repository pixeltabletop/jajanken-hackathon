// El semáforo, en la app de verdad. Mata el worker de QVAC con la ventana
// abierta y cronometra cuánto tarda la pantalla en dejar de mentir.
//
//   npm run dev -- -- --remote-debugging-port=9222
//   node scripts/smoke-semaforo-vivo.mjs
//
// Cuidado: el recargado en caliente NO cubre el proceso principal. Si tocaste
// src/main/, cierra y vuelve a abrir la app o esto mide código viejo.

import { execSync } from 'node:child_process'

const PUERTO = 9222

const objetivos = await (await fetch(`http://127.0.0.1:${PUERTO}/json/list`)).json()
const pagina = objetivos.find((t) => t.type === 'page')
if (!pagina) {
  console.error('No hay ventana. Levanta la app con --remote-debugging-port=9222')
  process.exit(1)
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

const ws = new WebSocket(pagina.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let siguiente = 1
const evaluar = (expresion) =>
  new Promise((res, rej) => {
    const id = siguiente++
    const oir = (e) => {
      const m = JSON.parse(e.data)
      if (m.id !== id) return
      ws.removeEventListener('message', oir)
      if (m.result?.exceptionDetails) rej(new Error(m.result.exceptionDetails.text))
      else res(m.result?.result?.value)
    }
    ws.addEventListener('message', oir)
    ws.send(
      JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: { expression: expresion, awaitPromise: true, returnByValue: true }
      })
    )
  })

// Lo que ve una persona mirando la pantalla, no lo que dice el proceso principal.
const LEER_PUNTOS = `[...document.querySelectorAll('.dots .dot')].map(d => d.className.replace('dot ','')).join(',')`

const fallos = []
const check = (ok, etiqueta) => {
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${etiqueta}`)
  if (!ok) fallos.push(etiqueta)
}

// Tras recargar, la app vuelve al acceso y el encabezado todavia no existe.
// El semaforo solo se ve una vez dentro, asi que se entra igual que una persona.
await evaluar(
  `(() => { const b = [...document.querySelectorAll('.access button')].find(x => /Entrar/.test(x.textContent)); if (b) b.click(); return !!b })()`
)
await dormir(1500)

const inicial = await evaluar(LEER_PUNTOS)
console.log(`puntos en pantalla: ${inicial}`)
check(inicial === 'ready,ready,ready', 'los tres puntos empiezan en verde')
if (fallos.length) {
  console.log('\nEspera a que carguen los tres modelos y repite.')
  process.exit(1)
}

console.log('\nMatando bare.exe con la ventana abierta...')
execSync('taskkill /F /IM bare.exe /T', { stdio: 'ignore' })
const t0 = Date.now()

let apagado = null
for (let i = 0; i < 120; i += 1) {
  await dormir(500)
  const puntos = await evaluar(LEER_PUNTOS)
  if (puntos !== 'ready,ready,ready') {
    apagado = { puntos, ms: Date.now() - t0 }
    break
  }
}
check(apagado !== null, 'la pantalla deja de decir verde sin que nadie toque nada')
if (apagado) console.log(`   ${apagado.puntos} a los ${(apagado.ms / 1000).toFixed(1)} s`)

let vuelto = null
for (let i = 0; i < 400; i += 1) {
  await dormir(500)
  const puntos = await evaluar(LEER_PUNTOS)
  if (puntos === 'ready,ready,ready') {
    vuelto = Date.now() - t0
    break
  }
}
check(vuelto !== null, 'los tres vuelven a verde solos, sin recargar la app')
if (vuelto) console.log(`   verde otra vez a los ${(vuelto / 1000).toFixed(1)} s`)

ws.close()
console.log(`\n${fallos.length === 0 ? 'SEMÁFORO VIVO OK' : `FALLOS: ${fallos.length}`}`)
process.exit(fallos.length === 0 ? 0 : 1)
