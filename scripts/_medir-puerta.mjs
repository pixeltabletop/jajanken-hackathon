// Mide la tarjeta de puerta EN EL ESTADO PRESIONADO, tema oscuro, que es donde
// Josue ve el texto desaparecer. Fuerza :active con CDP, no con CSS de mentira.
const objetivos = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const pagina = objetivos.find((t) => t.type === 'page')
const ws = new WebSocket(pagina.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let n = 1
const cmd = (method, params = {}) =>
  new Promise((res, rej) => {
    const id = n++
    const h = (m) => {
      const d = JSON.parse(m.data)
      if (d.id !== id) return
      ws.removeEventListener('message', h)
      d.error ? rej(new Error(JSON.stringify(d.error))) : res(d.result)
    }
    ws.addEventListener('message', h)
    ws.send(JSON.stringify({ id, method, params }))
  })
const ev = async (e) => (await cmd('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.value
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

for (let i = 0; i < 40; i++) { if (await ev(`!!document.querySelector('.access')`)) break; await dormir(500) }
await ev(`(()=>{const b=[...document.querySelectorAll('.access button')].find(x=>/Entrar/.test(x.textContent)); if(b)b.click()})()`)
await dormir(2000)

// Tema oscuro
for (let i = 0; i < 3; i++) {
  if ((await ev(`document.documentElement.dataset.theme`)) === 'negro') break
  await ev(`(()=>{const b=document.querySelector('#lat-tema'); if(b)b.click()})()`)
  await dormir(600)
}
console.log('tema:', await ev(`document.documentElement.dataset.theme`))

const tokens = await ev(`(() => {
  const cs = getComputedStyle(document.documentElement)
  return ['--sky','--on-sky','--surface','--surface-2','--ink','--muted','--primary','--primary-deep','--line']
    .map(k => k + '=' + cs.getPropertyValue(k).trim()).join('  ')
})()`)
console.log('tokens:', tokens)

// Forzar :active y :hover de verdad, por el protocolo.
await cmd('DOM.enable')
await cmd('CSS.enable')
const doc = await cmd('DOM.getDocument', { depth: -1 })
const nodo = await cmd('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#door-capture' })
await cmd('CSS.forcePseudoState', { nodeId: nodo.nodeId, forcedPseudoClasses: ['hover', 'active'] })
await dormir(500)

const medida = await ev(`(() => {
  const d = document.querySelector('#door-capture')
  const leer = (el) => {
    const cs = getComputedStyle(el)
    return { fondo: cs.backgroundColor, texto: cs.color }
  }
  const partes = {
    tarjeta: leer(d),
    titulo: leer(d.querySelector('b')),
    sub: leer(d.querySelector('.door-sub')),
    vinieta: leer(d.querySelector('.door-list li')),
    arriba: leer(d.querySelector('.door-top')),
    pie: leer(d.querySelector('.door-foot'))
  }
  return JSON.stringify(partes, null, 1)
})()`)
console.log('PRESIONADA:\n' + medida)

// Contraste real de cada texto contra el fondo efectivo de la tarjeta.
const ratios = await ev(`(() => {
  const lum = (c) => {
    const [r,g,b] = c.match(/\\d+(\\.\\d+)?/g).slice(0,3).map(Number).map(v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4) })
    return 0.2126*r + 0.7152*g + 0.0722*b
  }
  const ratio = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05) }
  const d = document.querySelector('#door-capture')
  const fondo = getComputedStyle(d).backgroundColor
  return ['b','.door-sub','.door-list li','.door-kicker','.door-go'].map(sel => {
    const el = d.querySelector(sel); if(!el) return sel + ': no existe'
    return sel + ': ' + ratio(fondo, getComputedStyle(el).color).toFixed(2) + ':1'
  }).join('\\n')
})()`)
console.log('\nCONTRASTE contra el fondo de la tarjeta presionada:\n' + ratios)

const shot = await cmd('Page.captureScreenshot', { format: 'png' })
const { writeFileSync } = await import('node:fs')
writeFileSync('bench/puerta-presionada.png', Buffer.from(shot.data, 'base64'))
console.log('\nbench/puerta-presionada.png')
ws.close()
process.exit(0)
