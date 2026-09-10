// Contraste medido sobre la app EN EJECUCIÓN, elemento por elemento.
//
//   1. npm run dev -- -- --remote-debugging-port=9222
//   2. node scripts/check-contrast-vivo.mjs
//
// Por qué existe además de check-contrast.mjs: aquel mide los pares que yo
// declaro. Este mide lo que de verdad quedó pintado, incluidos los casos que no
// se me ocurrió declarar: un fondo heredado, una regla que gana por
// especificidad, el resaltado del sistema sobre una opción de un desplegable.
//
// Recorre los dos temas, aplica los estados (hover, foco, elegido, presionado)
// y calcula el color de fondo efectivo subiendo por los ancestros hasta
// encontrar uno opaco. Sale con código distinto de cero si algún texto visible
// queda por debajo de su umbral.

import { writeFileSync, mkdirSync } from 'node:fs'

const PORT = 9222
mkdirSync('bench', { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function findPage() {
  for (let i = 0; i < 40; i++) {
    try {
      const t = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      const p = t.find((x) => x.type === 'page' && /localhost:5173|Eco/i.test(`${x.url} ${x.title}`))
      if (p) return p
    } catch { /* aún no */ }
    await sleep(1000)
  }
  throw new Error('No encontré la ventana de Eco en el puerto 9222')
}

const page = await findPage()
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
await send('Runtime.enable')

async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  const ex = r.result?.exceptionDetails
  if (ex) throw new Error(ex.exception?.description ?? ex.text)
  return r.result?.result?.value
}

// El auditor corre dentro de la página: necesita getComputedStyle de verdad.
const AUDITOR = `(() => {
  const lum = (rgb) => {
    const c = rgb.map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 })
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const parse = (s) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(s || '')
    if (!m) return null
    const p = m[1].split(',').map((v) => parseFloat(v.trim()))
    return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }
  }
  const over = (fg, bg) => fg.rgb.map((v, i) => Math.round(v * fg.a + bg[i] * (1 - fg.a)))
  // Fondo efectivo: se sube por los ancestros hasta dar con uno opaco.
  const bgOf = (el) => {
    let cur = el, acc = null
    while (cur) {
      const b = parse(getComputedStyle(cur).backgroundColor)
      if (b && b.a > 0) acc = acc ? over({ rgb: acc, a: 1 }, over(b, [255, 255, 255])) : over(b, [255, 255, 255])
      if (b && b.a >= 0.999) return acc
      cur = cur.parentElement
    }
    return acc ?? [255, 255, 255]
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && parse(s.color)?.a > 0.05
  }
  const tieneTexto = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
  const camino = (el) => {
    const partes = []
    let cur = el
    for (let i = 0; cur && i < 3; i++) {
      partes.unshift(cur.tagName.toLowerCase() + (cur.className && typeof cur.className === 'string' ? '.' + cur.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''))
      cur = cur.parentElement
    }
    return partes.join(' > ')
  }
  const out = []
  for (const el of document.querySelectorAll('body *')) {
    if (!tieneTexto(el) || !visible(el)) continue
    const s = getComputedStyle(el)
    const fg = parse(s.color)
    if (!fg) continue
    const bg = bgOf(el)
    const color = over(fg, bg)
    const r = ratio(color, bg)
    const px = parseFloat(s.fontSize)
    const grande = px >= 24 || (px >= 18.66 && parseInt(s.fontWeight, 10) >= 700)
    const min = grande ? 3 : 4.5
    const texto = (el.textContent || '').trim().slice(0, 40)
    out.push({ camino: camino(el), texto, ratio: Math.round(r * 100) / 100, min, px, ok: r + 0.005 >= min,
      fg: 'rgb(' + color.join(',') + ')', bg: 'rgb(' + bg.join(',') + ')' })
  }
  return out
})()`

const results = []
const problemas = []

async function auditar(etiqueta) {
  const filas = await js(AUDITOR)
  const malas = filas.filter((f) => !f.ok)
  results.push({ estado: etiqueta, medidos: filas.length, fallos: malas.length, malas })
  console.log(`${malas.length ? 'FALLA' : 'OK   '} ${etiqueta} · ${filas.length - malas.length}/${filas.length} textos`)
  for (const m of malas.slice(0, 8)) {
    console.log(`      ${m.ratio}:1 (necesita ${m.min}) · ${m.fg} sobre ${m.bg} · ${m.camino} · "${m.texto}"`)
    problemas.push({ estado: etiqueta, ...m })
  }
  if (malas.length > 8) console.log(`      … y ${malas.length - 8} más`)
}

/**
 * Fuerza :hover y :active sobre TODOS los elementos que casen con el selector, y
 * devuelve una funcion para soltarlos.
 *
 * Esto es el agujero por el que se colo el peor defecto de contraste del
 * proyecto. El auditor recorria pantallas y estados de datos, pero nunca pasaba
 * el raton por encima de nada. Y el fallo estaba justo ahi: la regla generica
 * `button:hover` le ganaba en especificidad a la de la tarjeta y le metia un
 * azul claro de fondo sin tocar el color del texto. Invisible para un humano que
 * no este mirando en ese instante, invisible para una lista de pares, y bien
 * visible para quien usa la aplicacion.
 *
 * `Emulation.setEmulatedMedia` no sirve: :hover no es una media query. Hay que
 * pedirselo al motor de estilos nodo por nodo.
 */
const forzarEstado = async (selector, estados) => {
  await send('DOM.enable')
  await send('CSS.enable')
  const doc = await send('DOM.getDocument', { depth: -1 })
  const raiz = doc.result?.root?.nodeId
  if (!raiz) return async () => undefined
  const encontrados = await send('DOM.querySelectorAll', { nodeId: raiz, selector })
  const nodeIds = encontrados.result?.nodeIds ?? []
  for (const nodeId of nodeIds) {
    await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: estados })
  }
  return async () => {
    for (const nodeId of nodeIds) {
      await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] })
    }
  }
}

const setTheme = async (id) => {
  // El tema es un interruptor de un clic, en el pie de la barra lateral.
  for (let i = 0; i < 3; i++) {
    if ((await js(`document.documentElement.dataset.theme`)) === id) return true
    await js(`(() => { const b=document.querySelector('#lat-tema'); if (b) b.click() })()`)
    await sleep(500)
  }
  return (await js(`document.documentElement.dataset.theme`)) === id
}

// Cerrar sesión y cambiar de usuario viven en el pie de la barra lateral.
const menu = async (texto) => {
  await js(`(() => { const b=document.querySelector('#lat-quien'); if (b) b.click() })()`)
  await sleep(260)
  const r = await js(`(() => { const b=[...document.querySelectorAll('.menu-list button')].find(x=>x.textContent.includes(${JSON.stringify(texto)})); if(!b) return 'no-existe'; if(b.disabled) return 'deshabilitado'; b.click(); return true })()`)
  await sleep(260)
  return r
}


try {
  await send('Page.enable')
  await send('Page.reload', { ignoreCache: false })
  await sleep(7000)
  if (await js(`!!document.querySelector('.access')`)) {
    await auditar('acceso')
    await js(`(() => { const b=[...document.querySelectorAll('.access button')].find(x=>/Entrar/.test(x.textContent)); if (b) b.click() })()`)
    await sleep(800)
  }
  await js(`(() => { const b=document.querySelector('.theme-first button.primary'); if (b) b.click() })()`)
  await sleep(600)

  for (const tema of ['blanco', 'negro']) {
    await setTheme(tema)
    await sleep(700)

    // El inicio, con el raton encima de las dos puertas y luego presionandolas.
    // Son los dos estados donde el texto desaparecia.
    await auditar(`${tema} · inicio en reposo`)

    let soltar = await forzarEstado('.door', ['hover'])
    await sleep(400)
    await auditar(`${tema} · puertas con el raton encima`)
    await soltar()

    soltar = await forzarEstado('.door', ['hover', 'active'])
    await sleep(400)
    await auditar(`${tema} · puertas presionadas`)
    await soltar()

    await js(`(() => { const d=document.getElementById('nav-capture'); if (d) d.click() })()`)
    await sleep(900)
    await auditar(`${tema} · inicio y registro`)

    // Todo lo pulsable de la pantalla, a la vez, con el raton encima. Si alguna
    // regla generica le gana a la de un componente, sale aqui.
    soltar = await forzarEstado('button, [role="tab"], a', ['hover'])
    await sleep(400)
    await auditar(`${tema} · registro, todo pulsable con el raton encima`)
    await soltar()

    await js(`(() => { const b=document.querySelector('#lat-quien'); if (b) b.click() })()`)
    await sleep(350)
    await auditar(`${tema} · menú de sesión abierto`)
    await js(`document.body.click()`)
    await sleep(250)

    // Estados elegidos del registro: columnas, y la base abierta.
    await js(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Ver la base registrada/.test(x.textContent)); if (b) b.click() })()`)
    await sleep(700)
    await js(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/^Columnas/.test(x.textContent.trim())); if (b) b.click() })()`)
    await sleep(500)
    await auditar(`${tema} · base abierta y selector de columnas`)

    await js(`(() => { const d=document.getElementById('nav-home'); if (d) d.click() })()`)
    await sleep(900)
    await js(`(() => { const d=document.getElementById('nav-follow'); if (d) d.click() })()`)
    await sleep(900)
    await auditar(`${tema} · seguimiento`)

    soltar = await forzarEstado('button, [role="tab"]', ['hover'])
    await sleep(400)
    await auditar(`${tema} · seguimiento, todo pulsable con el raton encima`)
    await soltar()

    soltar = await forzarEstado('button, [role="tab"]', ['hover', 'active'])
    await sleep(400)
    await auditar(`${tema} · seguimiento, todo pulsable presionado`)
    await soltar()

    await js(`(() => { const b=[...document.querySelectorAll('.guide-toggle')].find(x=>/Cómo pedirlo/.test(x.textContent)); if (b) b.click() })()`)
    await sleep(600)
    await auditar(`${tema} · guía de cómo pedirlo`)
    await js(`(() => { const b=[...document.querySelectorAll('.guide-toggle')].find(x=>/Cómo pedirlo/.test(x.textContent)); if (b) b.click() })()`)
    await sleep(400)

    // Barras de gráfico elegidas y pestaña de gráficos.
    await js(`(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>/Gráficos/.test(x.textContent)); if (t) t.click() })()`)
    await sleep(600)
    await js(`(() => { const b=document.querySelector('.bar-btn'); if (b) b.click() })()`)
    await sleep(600)
    await auditar(`${tema} · gráfico con una barra elegida`)

    await js(`(() => { const b=[...document.querySelectorAll('.interp-parts .ghost')].find(x=>/Limpiar/.test(x.textContent)); if (b) b.click() })()`)
    await sleep(500)
    await js(`(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>/Resultados/.test(x.textContent)); if (t) t.click() })()`)
    await sleep(500)
    await js(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Ver la nota/.test(x.textContent)); if (b) b.click() })()`)
    await sleep(600)
    await auditar(`${tema} · nota abierta con la evidencia`)

    // La barra lateral estrecha reaqueta cada fila a un cuadrado con solo el
    // icono. Es un estado distinto del ancho y hay que medirlo como tal.
    await js(`(() => { const b=document.querySelector('.lat-plegar'); if (b) b.click() })()`)
    await sleep(600)
    await auditar(`${tema} · barra lateral estrecha`)
    await js(`(() => { const b=document.querySelector('.lat-plegar'); if (b) b.click() })()`)
    await sleep(600)

    // Con una acción encendida y la sección actual marcada a la vez: son los
    // dos estados "elegido" de la barra, y son los que hacen desaparecer texto.
    await js(`(() => { const b=document.getElementById('acc-guia'); if (b) b.click() })()`)
    await sleep(600)
    await auditar(`${tema} · barra con acción encendida y sección actual`)

    soltar = await forzarEstado('.lateral .lat-item', ['hover'])
    await sleep(400)
    await auditar(`${tema} · barra lateral con el raton encima`)
    await soltar()

    await js(`(() => { const d=document.getElementById('nav-home'); if (d) d.click() })()`)
    await sleep(900)
  }
} catch (e) {
  console.log('FALLA auditoría interrumpida:', e.message)
  problemas.push({ estado: 'auditoría', texto: e.message, ratio: 0, min: 0, ok: false })
} finally {
  ws.close()
}

writeFileSync('bench/contraste-vivo.json', JSON.stringify({ ok: problemas.length === 0, problemas, results }, null, 2))
console.log(`\n${problemas.length ? `CONTRASTE VIVO: ${problemas.length} textos por debajo del umbral` : 'CONTRASTE VIVO OK'} · detalle en bench/contraste-vivo.json`)
process.exit(problemas.length ? 1 : 0)
