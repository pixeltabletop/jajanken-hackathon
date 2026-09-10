// Ciclo completo de usuario contra la app REAL en ejecución, vía el protocolo de
// depuración de Chromium. Sin dependencias: fetch y WebSocket nativos de Node.
//
//   1. npm run dev -- -- --remote-debugging-port=9222   (o el de MAM_DEBUG_PORT)
//   2. node scripts/e2e-cycle.mjs
//
// Verifica el criterio del Bloque 4 del blueprint: teclear una nota, extraer,
// ver filas con la cita resaltada, elegir cliente, guardar y ver crecer la tabla.
// Deja capturas en bench/e2e/ y un resumen en bench/e2e-bloque4.json.

import { mkdirSync, writeFileSync } from 'node:fs'

// El puerto de depuracion se puede mover: en una maquina donde el 9222 este
// ocupado por otro programa (el widget de Lenovo Vantage, por ejemplo) este
// script no encuentra la ventana y falla entero. MAM_DEBUG_PORT lo cambia,
// aqui y en el arranque de la app.
const PORT = Number(process.env.MAM_DEBUG_PORT ?? 9222)
const NOTE = 'Estoy en la Clínica DemoCare Costa del Este, en Ciudad de Panamá. Vi dos resonadores Zenith MedTech de unos cinco años y tres ecógrafos, la marca no la vi.'
const OUT = 'bench/e2e'
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label) => { console.log(`${ok ? 'OK   ' : 'FALLA'} ${label}`); if (!ok) failures.push(label) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// --- conexión CDP ---------------------------------------------------------
async function findPage() {
  for (let i = 0; i < 30; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      const page = targets.find((t) => t.type === 'page' && /^https?:\/\/(localhost|127\.0\.0\.1)[:/]|MAM/i.test(`${t.url} ${t.title}`))
      if (page) return page
    } catch { /* aún no escucha */ }
    await sleep(1000)
  }
  throw new Error(`No encontré la ventana de MAM en el puerto ${PORT}. ¿Está corriendo npm run dev con --remote-debugging-port?`)
}

const page = await findPage()
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
await send('Runtime.enable'); await send('Page.enable')

async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text)
  return r.result?.result?.value
}
async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png' })
  const file = `${OUT}/${name}.png`
  writeFileSync(file, Buffer.from(r.result.data, 'base64'))
  console.log(`      captura → ${file}`)
  return file
}
async function waitFor(expr, label, timeoutMs, everyMs = 1000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if (await js(expr)) return Date.now() - t0
    await sleep(everyMs)
  }
  throw new Error(`Tiempo agotado (${timeoutMs / 1000} s) esperando: ${label}`)
}
const clickByText = (text) => js(`(() => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(${JSON.stringify(text)})); if (!b) return false; if (b.disabled) return 'disabled'; b.click(); return true })()`)

const summary = { note: NOTE, steps: {} }
try {
  // 0. Bloque 4B: la app abre en el arranque de marca y luego en el selector de
  // dos puertas. El ciclo de registro vive detrás de la puerta izquierda, y la
  // tabla de la base ya no se pinta de entrada: hay que pedirla.
  console.log('--- 0. arranque y puerta izquierda ---')
  // Recargar el renderer hace el ciclo repetible: deja la interfaz en el mismo
  // punto de partida sin tocar los modelos, que viven en el proceso principal.
  await send('Page.reload', { ignoreCache: false })
  await sleep(1500)
  await waitFor(`!document.querySelector('.splash')`, 'que termine el arranque de marca', 60000, 500)
  // Pantalla de acceso: no valida nada, pero hay que atravesarla.
  await js(`(() => { const b=[...document.querySelectorAll('.access button')].find(x=>/Entrar/.test(x.textContent)); if (b) b.click() })()`)
  await sleep(1200)
  await js(`(() => { const b=document.querySelector('.theme-first button.primary'); if (b) b.click() })()`)
  await sleep(500)
  await js(`(() => { const d=document.getElementById('door-capture'); if (d) d.click() })()`)
  await sleep(1500)
  check(await js(`!!document.querySelector('#note')`), 'la puerta izquierda lleva a la captura')
  await js(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/Ver la base registrada/.test(x.textContent)); if (b) b.click() })()`)
  await sleep(600)

  // 1. Modelos listos
  console.log('--- 1. modelos ---')
  const msReady = await waitFor(`document.querySelectorAll('.dot.ready').length === 3`, 'los tres modelos en listo', 180000, 2000)
  summary.steps.modelsReadyMs = msReady
  check(true, `tres modelos listos en ${(msReady / 1000).toFixed(0)} s`)
  const before = await js(`document.querySelectorAll('tbody tr').length`)
  const statsBefore = await js(`[...document.querySelectorAll('.stats strong')].map(s => s.textContent.trim())`)
  console.log(`      tabla antes: ${before} filas · stats ${JSON.stringify(statsBefore)}`)
  await shot('01-listo')

  // 1b. Nunca pisar a una persona que esté usando la app: si hay una extracción en
  // curso, un borrador sin confirmar o texto en el cuadro, se aborta sin tocar nada.
  const inUse = await js(`(() => { const busy = [...document.querySelectorAll('button')].some(b => /Procesando/.test(b.textContent)); const draft = document.querySelectorAll('.eq-row').length > 0; const typed = (document.querySelector('#note')?.value || '').trim().length > 0; return busy ? 'extracción en curso' : draft ? 'borrador sin confirmar' : typed ? 'texto escrito en el cuadro' : '' })()`)
  if (inUse) throw new Error(`La app está en uso (${inUse}). No interfiero: cierra o confirma lo tuyo y vuelve a correr el ciclo.`)

  // 2. Teclear la nota (input controlado por React)
  console.log('--- 2. nota ---')
  await js(`(() => { const ta = document.querySelector('#note'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(ta, ${JSON.stringify(NOTE)}); ta.dispatchEvent(new Event('input', { bubbles: true })); return ta.value.length })()`)
  const typed = await js(`document.querySelector('#note').value`)
  check(typed === NOTE, 'la nota quedó en el cuadro')

  // 3. Interpretar
  console.log('--- 3. extracción ---')
  const clicked = await clickByText('Interpretar con QVAC')
  check(clicked === true, `clic en Interpretar (${clicked})`)
  await sleep(1500)
  const waiting = await js(`!!document.querySelector('.wait')`)
  check(waiting, 'aparece el estado de espera con progreso')
  await shot('02-esperando')
  const msExtract = await waitFor(`document.querySelectorAll('.eq-row').length > 0`, 'filas de equipo en la revisión', 90000)
  summary.steps.extractMs = msExtract
  await sleep(2500) // que termine la deduplicación
  await shot('03-revision')

  const rows = await js(`document.querySelectorAll('.eq-row').length`)
  const marks = await js(`document.querySelectorAll('.evidence mark').length`)
  const invalid = await js(`document.querySelectorAll('.evidence mark.invalid, .eq-row.invalid').length`)
  const facility = await js(`document.querySelector('#rv-f').value`)
  const rowTitles = await js(`[...document.querySelectorAll('.eq-row-top strong')].map(s => s.textContent.trim())`)
  const quotes = await js(`[...document.querySelectorAll('.eq-quote q')].map(q => q.textContent.trim())`)
  const dupItems = await js(`document.querySelectorAll('.dup-item').length`)
  const dupReason = await js(`(document.querySelector('.dup .muted') || {}).textContent || ''`)
  Object.assign(summary.steps, { rows, marks, invalid, facility, rowTitles, quotes, dupItems, dupReason })
  console.log(`      ${rows} filas: ${rowTitles.join(' | ')}`)
  console.log(`      citas: ${quotes.map((q) => `"${q}"`).join(' · ')}`)
  console.log(`      sitio: ${facility} · duplicados propuestos: ${dupItems - 1} · ${dupReason}`)
  // La UI se juzga por lo que muestra, no por la exactitud del modelo (esa la mide bench/).
  check(rows >= 1, `al menos una fila de equipo (obtuvo ${rows})`)
  check(marks >= rows, `cada fila tiene su cita resaltada en la nota (${marks} marcas para ${rows} filas)`)
  check(invalid === 0, `ninguna cita inválida (${invalid})`)
  check(/costa del este/i.test(facility), `sitio reconocido: ${facility}`)
  check(dupItems >= 1, 'el bloque de cliente apareció (candidatos o nuevo)')
  const quality = { expectedRows: 2, gotRows: rows, hasMR: rowTitles.some((t) => /Resonancia/.test(t)), hasUS: rowTitles.some((t) => /Ecograf/.test(t)) }
  summary.steps.quality = quality
  if (rows !== 2 || !quality.hasUS) console.log(`      CALIDAD (no bloquea): la nota tiene 2 equipos y el modelo devolvió ${rows}; ecografía ${quality.hasUS ? 'sí' : 'NO'} detectada. Coherente con 8/10 del banco.`)

  // 4. Cliente nuevo y guardar
  console.log('--- 4. guardar ---')
  const nuevo = await clickByText('Es nuevo')
  check(nuevo === true || nuevo === false, `clic en "Es nuevo" (${nuevo === false ? 'ya estaba elegido' : nuevo})`)
  const saved = await clickByText('Confirmar y guardar')
  check(saved === true, `clic en Confirmar y guardar (${saved})`)
  const msSave = await waitFor(`document.querySelectorAll('tbody tr').length === ${before + rows}`, `la tabla crece de ${before} a ${before + rows}`, 15000, 500)
  summary.steps.saveMs = msSave
  const after = await js(`document.querySelectorAll('tbody tr').length`)
  const statsAfter = await js(`[...document.querySelectorAll('.stats strong')].map(s => s.textContent.trim())`)
  const msg = await js(`document.querySelector('[role=status]').textContent`)
  Object.assign(summary.steps, { rowsBefore: before, rowsAfter: after, statsBefore, statsAfter, message: msg })
  console.log(`      tabla después: ${after} filas · stats ${JSON.stringify(statsAfter)}`)
  console.log(`      mensaje: ${msg}`)
  check(after === before + rows, `la tabla creció en ${rows} fila${rows !== 1 ? 's' : ''}`)
  check(/Guardado/.test(msg), 'mensaje de guardado')
  const draftGone = await js(`document.querySelectorAll('.eq-row').length === 0`)
  check(draftGone, 'el panel de revisión se vació tras guardar')
  const inTable = await js(`[...document.querySelectorAll('tbody tr td:first-child')].some(td => /Costa del Este/.test(td.textContent))`)
  check(inTable, 'el cliente nuevo aparece en la tabla')
  await js(`window.scrollTo(0, 0)`)
  await shot('04-guardado')
  await js(`document.querySelector('table').scrollIntoView()`)
  await sleep(300)
  await shot('05-tabla')
} catch (e) {
  check(false, e.message)
  try { await shot('99-error') } catch { /* sin captura */ }
} finally {
  ws.close()
}

summary.ok = failures.length === 0
summary.failures = failures
writeFileSync('bench/e2e-bloque4.json', JSON.stringify(summary, null, 2))
console.log(`\n${summary.ok ? 'CICLO OK' : 'CICLO FALLÓ: ' + failures.length + ' checks'} · resumen en bench/e2e-bloque4.json`)
process.exit(summary.ok ? 0 : 1)
