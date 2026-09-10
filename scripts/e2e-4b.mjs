// Verificación del Bloque 4B contra la app REAL en ejecución, por el protocolo
// de depuración de Chromium. Sin dependencias: fetch y WebSocket de Node.
//
//   1. npm run dev -- -- --remote-debugging-port=9222
//   2. node scripts/e2e-4b.mjs
//
// Cubre los 21 puntos de la verificación del bloque: arranque con logo, selector
// de dos puertas, ciclo de registro, pregunta en español, estado vacío, PDF,
// pestañas, gráficos que filtran, temas y movimiento reducido.
//
// Recarga el renderer al empezar para ser repetible, y usa datos únicos por
// corrida: si no, la auditoría solo pasa la primera vez. Aborta si alguien está
// usando la app en vivo.
//
// CUIDADO: el HMR de electron-vite solo recarga el RENDERER. Cualquier cambio en
// `src/main/` (IPC, almacén, reportes, motor QVAC) exige cerrar y volver a abrir
// la app, o esta verificación estará midiendo código viejo del proceso principal
// mientras la pantalla ya muestra el nuevo.

import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = 9222
const OUT = 'bench/e2e'
mkdirSync(OUT, { recursive: true })

const STAMP = Date.now().toString().slice(-5)
const SITE = `Policlínica DemoCare Prueba ${STAMP}`
const NOTE = `Estoy en la ${SITE}, en Ciudad de Panamá. Vi dos resonadores Zenith MedTech de unos cinco años y tres ecógrafos, la marca no la vi.`

const results = []
const check = (ok, label, detail = '') => {
  results.push({ ok, label, detail })
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${label}${detail ? ` · ${detail}` : ''}`)
}
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
  throw new Error(`No encontré la ventana de Eco en el puerto ${PORT}`)
}

const page = await findPage()
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
const consoleErrors = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) {
    consoleErrors.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200)}`)
  }
  if (m.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(`excepción: ${m.params.exceptionDetails.exception?.description?.slice(0, 200)}`)
  }
}
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setEmulatedMedia', { features: [] })

async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  const ex = r.result?.exceptionDetails
  if (ex) throw new Error(ex.exception?.description ?? ex.text)
  return r.result?.result?.value
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.result.data, 'base64'))
  return `${OUT}/${name}.png`
}
async function waitFor(expr, label, timeoutMs, every = 600) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) { if (await js(expr)) return Date.now() - t0; await sleep(every) }
  throw new Error(`Tiempo agotado esperando: ${label}`)
}
const clickText = (t, sel = 'button') =>
  js(`(() => { const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.textContent.trim().startsWith(${JSON.stringify(t)})); if(!b) return 'no-existe'; if(b.disabled) return 'deshabilitado'; b.click(); return true })()`)
const setInput = (sel, val) =>
  js(`(() => { const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return false; const proto = el.tagName==='TEXTAREA'?HTMLTextAreaElement:el.tagName==='SELECT'?HTMLSelectElement:HTMLInputElement; Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(el, ${JSON.stringify(val)}); el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true})); return true })()`)
const setTheme = (id) =>
  js(`(() => { const s=document.querySelector('.theme-switch select'); if(!s) return false; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s, ${JSON.stringify(id)}); s.dispatchEvent(new Event('change',{bubbles:true})); return true })()`)

const summary = { stamp: STAMP, site: SITE }

try {
  // ---- 0. no pisar a nadie ------------------------------------------------
  const inUse = await js(`(() => { const draft=document.querySelectorAll('.eq-row').length>0; const typed=(document.querySelector('#note')?.value||'').trim().length>0; return draft ? 'borrador sin confirmar' : typed ? 'texto en el cuadro' : '' })()`)
  if (inUse) throw new Error(`La app está en uso (${inUse}). No interfiero.`)

  // ---- 1. arranque con logo (puntos 12 y 13) ------------------------------
  console.log('\n--- 1. arranque con el logo ---')
  const t0 = Date.now()
  await send('Page.reload', { ignoreCache: false })
  await sleep(1200)
  check(await js(`!!document.querySelector('.splash')`), 'la app abre con el arranque de marca')
  const logo = await js(`(() => { const el=document.querySelector('.splash .logo'); if(!el) return null; return { tag: el.tagName, ancho: el.getBoundingClientRect().width } })()`)
  check(!!logo && logo.ancho > 150, 'el logo ocupa el centro de la pantalla', logo ? `${logo.tag} de ${Math.round(logo.ancho)} px` : 'sin logo')
  const legal = await js(`(document.querySelector('.splash-legal')||{}).textContent||''`)
  check(/No es un producto oficial de Philips/.test(legal) && /Jajanken/.test(legal), 'el pie legal se lee durante el arranque')
  check(/Eco/.test(await js(`(document.querySelector('.splash-name')||{}).textContent||''`)), 'el nombre aparece junto al logo')
  await shot('4b-01-arranque')
  // Esc antes del segundo 5 no salta
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
  await sleep(300)
  const stillThere = await js(`!!document.querySelector('.splash')`)
  check(stillThere, 'Esc antes del segundo 5 no salta el arranque', `${Math.round((Date.now() - t0) / 100) / 10} s desde la recarga`)
  const splashMs = await waitFor(`!document.querySelector('.splash')`, 'el arranque termina', 40000, 400)
  summary.splashMs = Date.now() - t0
  check(summary.splashMs >= 5000, 'el arranque dura al menos 5 segundos', `${(summary.splashMs / 1000).toFixed(1)} s`)
  const net = await js(`performance.getEntriesByType('resource').filter(r => !/^(file|data|blob)/.test(r.name) && !/localhost:5173/.test(r.name)).map(r => r.name).slice(0,5)`)
  check(net.length === 0, 'nada se descarga de la red: el vídeo viaja en el paquete', net.join(' ') || 'ninguna petición externa')

  // el paso de tema solo sale en un perfil limpio; si sale, se cierra
  if (await js(`!!document.querySelector('.theme-first')`)) {
    check(true, 'primera ejecución: aparece el paso de elección de tema')
    await shot('4b-02-tema-primera-vez')
    await clickText('Continuar')
    await sleep(600)
  } else {
    check(true, 'el tema ya estaba elegido y no se vuelve a preguntar', 'settings.json guardado')
  }

  // ---- 2. selector de dos puertas (punto 1) -------------------------------
  console.log('\n--- 2. selector de dos puertas ---')
  check(await js(`document.querySelectorAll('.door').length === 2`), 'la app abre en el selector con dos tarjetas')
  const doorsAreButtons = await js(`[...document.querySelectorAll('.door')].every(d => d.tagName === 'BUTTON' && d.tabIndex >= 0)`)
  check(doorsAreButtons, 'las dos tarjetas son botones alcanzables con Tab')
  const focusRing = await js(`(() => { const d=document.getElementById('door-capture'); d.focus(); const s=getComputedStyle(d); return { foco: document.activeElement === d, outline: s.outlineWidth, color: s.outlineColor } })()`)
  check(focusRing.foco, 'la tarjeta recibe foco de teclado', `contorno ${focusRing.outline}`)
  await shot('4b-03-selector-foco')
  check(await js(`document.querySelectorAll('.stats article').length === 4`), 'la fila de métricas se ve antes de elegir')
  summary.doorsHome = await js(`[...document.querySelectorAll('.door b')].map(b=>b.textContent.trim())`)

  // ---- 3. puerta izquierda: el ciclo sigue igual (punto 2) ----------------
  console.log('\n--- 3. puerta izquierda: registrar ---')
  await js(`document.getElementById('door-capture').click()`)
  await sleep(700)
  check(await js(`!!document.querySelector('#note')`), 'entrar a Registrar lleva a la captura')
  // Punto 14: Registrar no pinta la tabla de la base
  check(await js(`document.querySelectorAll('table').length === 0`), 'Registrar abre SIN la tabla de la base')
  check((await clickText('Ver la base registrada')) === true, 'el control "Ver la base registrada" existe')
  await sleep(600)
  check(await js(`document.querySelectorAll('table').length > 0`), 'la tabla se abre cuando se pide')
  const rowsBefore = await js(`document.querySelectorAll('tbody tr').length`)
  await clickText('Ocultar la base registrada')
  await sleep(400)
  check(await js(`document.querySelectorAll('table').length === 0`), 'y se puede volver a cerrar')

  await setInput('#note', NOTE)
  check((await clickText('Interpretar con QVAC')) === true, 'el botón de interpretar responde')
  await sleep(1000)
  check(await js(`!!document.querySelector('.wait')`), 'la espera muestra fases y progreso, no un spinner mudo')
  const extractMs = await waitFor(`document.querySelectorAll('.eq-row').length > 0`, 'filas de equipo', 120000)
  summary.extractMs = extractMs
  await sleep(3000)
  const marks = await js(`document.querySelectorAll('.evidence mark').length`)
  check(marks >= 1, 'la evidencia queda resaltada sobre la nota', `${marks} citas`)
  await shot('4b-04-revision')
  await clickText('Es nuevo')
  await sleep(200)
  check((await clickText('Confirmar y guardar')) === true, 'guarda con un clic')
  await waitFor(`/Guardado/.test(document.querySelector('[role=status]')?.textContent || '')`, 'mensaje de guardado', 25000, 400)
  await clickText('Ver la base registrada')
  await sleep(700)
  const rowsAfter = await js(`document.querySelectorAll('tbody tr').length`)
  check(rowsAfter > rowsBefore, 'la tabla creció tras guardar', `${rowsBefore} → ${rowsAfter} filas`)

  // ---- 4. volver al inicio con borrador (punto 7) -------------------------
  console.log('\n--- 4. volver al inicio con un borrador ---')
  await setInput('#note', 'Nota a medias que no se ha guardado')
  await js(`window.__confirmAsked = null; window.__origConfirm = window.confirm; window.confirm = (m) => { window.__confirmAsked = m; return false }`)
  await clickText('← Volver al inicio')
  await sleep(400)
  const asked = await js(`window.__confirmAsked`)
  check(!!asked && /sin guardar/i.test(asked), 'volver al inicio con un borrador pide confirmación', String(asked).slice(0, 60))
  check(await js(`!!document.querySelector('#note')`), 'y al decir que no, se queda en Registrar')
  await js(`window.confirm = () => true`)
  await clickText('← Volver al inicio')
  await sleep(700)
  await js(`window.confirm = window.__origConfirm`)
  check(await js(`document.querySelectorAll('.door').length === 2`), 'al confirmar, vuelve al selector')

  // ---- 5. puerta derecha: la pregunta (puntos 3, 4, 11) -------------------
  console.log('\n--- 5. puerta derecha: seguimiento ---')
  await js(`document.getElementById('door-follow').click()`)
  await sleep(700)
  check(await js(`!!document.querySelector('#q-input')`), 'entrar a Seguimiento lleva a la barra de pregunta')
  check(await js(`document.activeElement === document.getElementById('q-input')`), 'el foco aterriza en el primer control del modo nuevo')
  check(/Seguimiento/.test(await js(`(document.getElementById('mode-live')||{}).textContent||''`)), 'el cambio se anuncia en la región viva')
  check(await js(`document.querySelectorAll('.qbar-examples button').length >= 3`), 'hay preguntas de ejemplo pulsables')

  await setInput('#q-input', 'cuál es el estatus de las unidades en Panamá')
  // React necesita un tick para rehabilitar el botón tras el evento de entrada.
  await sleep(500)
  check((await clickText('Preguntar')) === true, 'el botón Preguntar responde')
  await sleep(400)
  const queryMs = await waitFor(`!!document.querySelector('.ichip')`, 'la interpretación', 90000, 600)
  summary.queryMs = queryMs
  const chip = await js(`[...document.querySelectorAll('.ichip-text')].map(c=>c.textContent.trim())`)
  check(chip.some((c) => /país/.test(c)), 'el chip dice en palabras qué entendió', chip.join(' · '))
  check(chip.some((c) => /desglose por/.test(c)), 'el chip declara el desglose')
  const answer = await js(`(document.querySelector('.answer')||{}).textContent||''`)
  check(/equipos registrados/.test(answer), 'la frase redactada responde con cifras', answer.slice(0, 110))
  // Los números del desglose suman el total de KPI
  const suma = await js(`(() => {
    const m = [...(document.querySelector('.answer').textContent.match(/Por [^:]+: (.+)\\./)||[])][1] || ''
    const nums = [...m.matchAll(/(\\d+)/g)].map(x=>+x[1])
    const kpi = +document.querySelector('.stats article strong').textContent.trim()
    return { desglose: nums, suma: nums.reduce((a,b)=>a+b,0), kpi }
  })()`)
  check(suma.suma === suma.kpi, 'los números del desglose suman el total de equipos', `${suma.desglose.join('+')} = ${suma.suma} · KPI ${suma.kpi}`)
  summary.breakdown = suma
  await shot('4b-05-seguimiento')

  // ---- 6. pestañas (punto 15) --------------------------------------------
  console.log('\n--- 6. pestañas ---')
  const tabs = await js(`[...document.querySelectorAll('[role=tab]')].map(t => ({ label: t.textContent.trim(), sel: t.getAttribute('aria-selected') }))`)
  check(tabs.length === 2 && tabs.every((t) => /\d/.test(t.label)), 'dos pestañas, cada una declara cuántas filas trae', tabs.map((t) => t.label).join(' | '))
  await js(`(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>x.getAttribute('aria-selected')==='true'); t.focus(); })()`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 })
  await sleep(400)
  const moved = await js(`(() => { const on=[...document.querySelectorAll('[role=tab]')].findIndex(x=>x.getAttribute('aria-selected')==='true'); return { on, foco: document.activeElement?.getAttribute('role') } })()`)
  check(moved.foco === 'tab', 'las pestañas se recorren con las flechas del teclado', `activa la ${moved.on + 1}`)

  // ---- 7. gráficos que filtran (punto 16) --------------------------------
  console.log('\n--- 7. gráficos que filtran ---')
  // La pestaña activa puede haber cambiado con las flechas del paso anterior.
  await js(`(() => { const t=[...document.querySelectorAll('[role=tab]')].find(x=>/Gráficos/.test(x.textContent)); if (t) t.click() })()`)
  await sleep(500)
  const chartsN = await js(`document.querySelectorAll('.chart').length`)
  check(chartsN >= 3, 'la pestaña de gráficos trae varias dimensiones', `${chartsN} gráficos`)
  const before = await js(`(() => ({ kpi: [...document.querySelectorAll('.stats strong')].map(s=>s.textContent.trim()), answer: document.querySelector('.answer').textContent.trim() }))()`)
  const barInfo = await js(`(() => {
    const chart = [...document.querySelectorAll('.chart')].find(c => /modalidad/i.test(c.querySelector('h3').textContent))
    const bars = [...chart.querySelectorAll('.bar-btn')]
    return { total: bars.length, primera: bars[0].textContent.trim(), pressed: bars[0].getAttribute('aria-pressed') }
  })()`)
  check(barInfo.pressed === 'false', 'las barras son controles con aria-pressed', `${barInfo.total} barras`)
  await js(`(() => { const chart=[...document.querySelectorAll('.chart')].find(c=>/modalidad/i.test(c.querySelector('h3').textContent)); chart.querySelectorAll('.bar-btn')[0].click() })()`)
  await sleep(500)
  const after = await js(`(() => {
    const chart = [...document.querySelectorAll('.chart')].find(c => /modalidad/i.test(c.querySelector('h3').textContent))
    const bars = [...chart.querySelectorAll('.bar-btn')]
    return {
      kpi: [...document.querySelectorAll('.stats strong')].map(s=>s.textContent.trim()),
      answer: document.querySelector('.answer').textContent.trim(),
      mismasCategorias: bars.length,
      elegidas: bars.filter(b=>b.getAttribute('aria-pressed')==='true').length,
      atenuadas: bars.filter(b=>b.classList.contains('dim')).length,
      chips: [...document.querySelectorAll('.ichip-from')].map(c=>c.textContent.trim())
    }
  })()`)
  check(JSON.stringify(after.kpi) !== JSON.stringify(before.kpi), 'un clic en una barra recalcula los KPI', `${before.kpi.join('/')} → ${after.kpi.join('/')}`)
  check(after.answer !== before.answer, 'y también la frase redactada')
  check(after.mismasCategorias === barInfo.total, 'el gráfico donde hiciste clic conserva todas sus categorías', `${after.mismasCategorias} barras`)
  check(after.elegidas === 1 && after.atenuadas === barInfo.total - 1, 'la elegida se marca y las demás se atenúan')
  check(after.chips.some((c) => /gráfico/.test(c)), 'el chip distingue lo que vino de un clic en el gráfico', after.chips.join(' · '))
  await shot('4b-06-grafico-filtrando')
  // Segundo clic: es un interruptor
  await js(`(() => { const chart=[...document.querySelectorAll('.chart')].find(c=>/modalidad/i.test(c.querySelector('h3').textContent)); chart.querySelectorAll('.bar-btn')[0].click() })()`)
  await sleep(500)
  // Solo en el gráfico donde se hizo clic: el de país sigue marcado por la
  // condición que vino de la pregunta, y eso es lo correcto.
  const undone = await js(`(() => {
    const chart = [...document.querySelectorAll('.chart')].find(c => /modalidad/i.test(c.querySelector('h3').textContent))
    return [...chart.querySelectorAll('.bar-btn')].filter(b => b.getAttribute('aria-pressed') === 'true').length
  })()`)
  check(undone === 0, 'un segundo clic lo deshace: es un interruptor')

  // ---- 8. estado vacío explicado (puntos 5 y 17) -------------------------
  console.log('\n--- 8. estado vacío ---')
  await js(`(() => {
    const chart = [...document.querySelectorAll('.chart')].find(c => /modalidad/i.test(c.querySelector('h3').textContent))
    chart.querySelectorAll('.bar-btn')[0].click()
  })()`)
  await sleep(300)
  await js(`(() => {
    const chart = [...document.querySelectorAll('.chart')].find(c => /marca/i.test(c.querySelector('h3').textContent))
    const libre = [...chart.querySelectorAll('.bar-btn')].reverse().find(b => b.getAttribute('aria-pressed') === 'false')
    if (libre) libre.click()
  })()`)
  await sleep(600)
  let vacio = await js(`!!document.querySelector('.empty-state')`)
  if (!vacio) {
    // Si la combinación aún devuelve filas, se fuerza con una pregunta sin resultado.
    await js(`[...document.querySelectorAll('[role=tab]')][0].click()`)
    await sleep(300)
    await js(`(() => { const b=[...document.querySelectorAll('.interp-parts .ghost')].find(x=>/Limpiar/.test(x.textContent)); if(b) b.click() })()`)
    await sleep(300)
    await setInput('.fb-selects select:nth-of-type(1)', '')
    await js(`(() => { const s=[...document.querySelectorAll('.fb-selects select')]; const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s[0],'Brazil'); s[0].dispatchEvent(new Event('change',{bubbles:true})); })()`)
    await sleep(300)
    await js(`(() => { const s=[...document.querySelectorAll('.fb-selects select')]; const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s[3],'Aurelia Health'); s[3].dispatchEvent(new Event('change',{bubbles:true})); })()`)
    await sleep(600)
    vacio = await js(`!!document.querySelector('.empty-state')`)
  }
  check(vacio, 'una combinación sin resultados muestra el estado vacío explicado')
  const vacioTxt = await js(`(document.querySelector('.empty-state')||{}).textContent||''`)
  check(/Ningún registro cumple ese filtro/.test(vacioTxt), 'lo dice con esas palabras, no una tabla en blanco')
  check(/Quitar la condición|Deshacer la última/.test(vacioTxt), 'y ofrece quitar la condición')
  await shot('4b-07-estado-vacio')
  await js(`(() => { const b=[...document.querySelectorAll('.empty-state button')].find(x=>/Limpiar todo|Quitar/.test(x.textContent)); if(b) b.click() })()`)
  await sleep(500)

  // ---- 9. tabla con evidencia --------------------------------------------
  console.log('\n--- 9. la evidencia vive también en Seguimiento ---')
  await js(`[...document.querySelectorAll('[role=tab]')][0].click()`)
  await sleep(400)
  await js(`(() => { const b=[...document.querySelectorAll('.interp-parts .ghost')].find(x=>/Limpiar/.test(x.textContent)); if(b) b.click() })()`)
  await sleep(500)
  const verNota = await clickText('Ver la nota')
  check(verNota === true, 'cada fila del resultado abre su nota original')
  await sleep(400)
  check(await js(`document.querySelectorAll('.evidence-row .evidence mark').length > 0`), 'la nota se abre con la cita resaltada')
  await shot('4b-08-evidencia')

  // ---- 10. PDF (punto 6) --------------------------------------------------
  console.log('\n--- 10. exportación ---')
  const pdf = await js(`(async () => {
    const r = await window.api.report({
      kind: 'consulta', requestedBy: 'Auditoría 4B',
      filter: { country: 'Panama', city: null, modality: null, brand: null, minAgeYears: null, maxAgeYears: null, status: null, confidence: null, textSearch: null },
      columns: ['site','city','country','modality','quantity','brand','age','confidence','status'],
      question: 'cuál es el estatus de las unidades en Panamá',
      intent: 'breakdown', groupBy: 'status'
    }, 'open')
    return r.error ? 'ERR: ' + r.error.message : r.path
  })()`)
  check(typeof pdf === 'string' && pdf.endsWith('.pdf'), 'el PDF de la consulta se genera', String(pdf).slice(0, 110))
  summary.pdf = pdf

  // ---- 11. temas (puntos 18, 19, 20, 21) ---------------------------------
  console.log('\n--- 11. temas ---')
  const filtroAntes = await js(`document.querySelectorAll('tbody tr').length`)
  for (const th of ['negro', 'azul', 'blanco']) {
    check((await setTheme(th)) === true, `el tema ${th} se puede elegir desde el encabezado`)
    await sleep(900)
    const applied = await js(`document.documentElement.dataset.theme`)
    check(applied === th, `el tema ${th} se aplica al instante`, `data-theme=${applied}`)
    const legible = await js(`(() => {
      const el = document.querySelector('.answer') || document.body
      const s = getComputedStyle(el)
      return { fondo: s.backgroundColor, texto: s.color }
    })()`)
    summary[`tema_${th}`] = legible
    await shot(`4b-09-tema-${th}`)
  }
  const filtroDespues = await js(`document.querySelectorAll('tbody tr').length`)
  check(filtroAntes === filtroDespues, 'cambiar de tema no pierde el filtro ni el resultado', `${filtroAntes} → ${filtroDespues} filas`)

  // ---- 12. movimiento reducido (punto 10) --------------------------------
  console.log('\n--- 12. movimiento reducido ---')
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await send('Page.reload', { ignoreCache: false })
  await sleep(6500)
  await js(`(() => { const b=document.querySelector('.theme-first button.primary'); if(b) b.click() })()`)
  await sleep(500)
  const rm = await js(`(() => {
    const d = document.getElementById('door-follow')
    if (!d) return null
    d.click()
    return true
  })()`)
  await sleep(600)
  check(rm === true && (await js(`!!document.querySelector('#q-input')`)), 'con movimiento reducido la app sigue siendo usable')
  const anim = await js(`(() => { const el=document.querySelector('.mode-enter'); if(!el) return 'sin capa'; const s=getComputedStyle(el); return { nombre: s.animationName, dur: s.animationDuration } })()`)
  check(anim === 'sin capa' || /fadeOnly/.test(anim.nombre) || anim.dur === '0.08s', 'la transición queda en un fundido corto, sin desplazamiento', JSON.stringify(anim))
  await shot('4b-10-movimiento-reducido')
  await send('Emulation.setEmulatedMedia', { features: [] })

  check(consoleErrors.length === 0, 'sin errores ni avisos en consola', consoleErrors.slice(0, 3).join(' | ') || 'ninguno')
  summary.consoleErrors = consoleErrors
} catch (e) {
  check(false, `verificación interrumpida: ${e.message}`)
  try { await shot('4b-99-error') } catch { /* nada */ }
} finally {
  ws.close()
}

const failed = results.filter((r) => !r.ok)
writeFileSync('bench/e2e-4b.json', JSON.stringify({ ok: failed.length === 0, total: results.length, failed: failed.length, results, summary }, null, 2))
console.log(`\n${failed.length === 0 ? 'BLOQUE 4B OK' : `BLOQUE 4B: ${failed.length} fallos`} · ${results.length - failed.length}/${results.length} · detalle en bench/e2e-4b.json`)
process.exit(failed.length === 0 ? 0 : 1)
