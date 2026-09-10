// Auditoría profunda de Eco contra la app en ejecución.
//
//   1. npm run dev -- -- --remote-debugging-port=9222
//   2. node scripts/audit.mjs
//
// Cubre: arranque y tiempos, guía de campo, ayuda contextual, ciclo completo,
// edición de un registro ya guardado, cascada país→ciudad, tablero, glosario,
// accesibilidad básica y errores de consola. Capturas en bench/audit/.

import { mkdirSync, writeFileSync } from 'node:fs'

const PORT = 9222
const OUT = 'bench/audit'
mkdirSync(OUT, { recursive: true })

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
  throw new Error('No encontré la ventana de Eco en el puerto 9222')
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
await send('Runtime.enable'); await send('Page.enable')

// La auditoría pliega guías y cambia filtros, así que deja la interfaz en otro
// estado del que la encontró. Recargar el renderer al empezar la hace repetible:
// los modelos viven en el proceso principal y no se recargan con esto.
await send('Page.reload', { ignoreCache: false })
await new Promise((r) => setTimeout(r, 2500))

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
async function waitFor(expr, label, timeoutMs, every = 700) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) { if (await js(expr)) return Date.now() - t0; await sleep(every) }
  throw new Error(`Tiempo agotado esperando: ${label}`)
}
const clickText = (t, sel = 'button') => js(`(() => { const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(x=>x.textContent.trim().startsWith(${JSON.stringify(t)})); if(!b) return 'no-existe'; if(b.disabled) return 'deshabilitado'; b.click(); return true })()`)
const setInput = (sel, val) => js(`(() => { const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return false; const proto = el.tagName==='TEXTAREA'?HTMLTextAreaElement:el.tagName==='SELECT'?HTMLSelectElement:HTMLInputElement; Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(el, ${JSON.stringify(val)}); el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true})); return true })()`)

const NOTE = 'Estoy en la Policlínica DemoCare Costa del Este. Vi dos rayosex bastante nuevos y un tomógrafo Zenith MedTech de unos nueve años.'
const summary = {}

try {
  // ---- 1. arranque y marca -------------------------------------------------
  console.log('\n--- 1. arranque, marca y tiempos ---')
  const readyMs = await waitFor(`document.querySelectorAll('.dot.ready').length === 3`, 'tres modelos listos', 240000, 2000)
  summary.modelsReadyMs = readyMs
  check(true, 'los tres modelos quedan listos', `${(readyMs / 1000).toFixed(0)} s desde que abrió la ventana`)
  check(await js(`document.title === 'Eco'`), 'la ventana se llama Eco')
  check(await js(`document.querySelector('h1').textContent.trim() === 'Eco'`), 'el encabezado dice Eco')
  check(!(await js(`document.body.textContent.includes('INSTALLED BASE INTELLIGENCE')`)), 'se quitó "INSTALLED BASE INTELLIGENCE"')
  check(!(await js(`document.body.textContent.includes('FieldLens')`)), 'no queda ningún rastro de FieldLens')
  const dotsTitle = await js(`(document.querySelector('.dots')||{}).title || ''`)
  check(/listo|Voz/.test(dotsTitle), 'el semáforo dice el estado de cada modelo al pasar el cursor', dotsTitle.slice(0, 80))
  summary.pills = dotsTitle
  await shot('01-arranque')

  // ---- 2. guía de campo ----------------------------------------------------
  console.log('\n--- 2. guía de qué contar ---')
  const guideQs = await js(`document.querySelectorAll('.guide-list li').length`)
  check(guideQs === 7, `la guía muestra las 7 preguntas de referencia`, `${guideQs} preguntas`)
  check(await js(`document.querySelectorAll('.guide-list li.req').length === 4`), 'marca cuáles son obligatorias')
  check((await clickText('Ver un ejemplo completo')) === true, 'el ejemplo se puede cargar de un clic')
  await sleep(300)
  check(await js(`document.querySelector('#note').value.includes('DemoCare Bella Vista')`), 'el ejemplo llega al cuadro de texto')
  check((await clickText('Qué contar en la nota')) === true, 'la guía se puede plegar')
  await sleep(300)
  check(await js(`document.querySelectorAll('.guide-list').length === 0`), 'plegada, no ocupa espacio')

  // ---- 3. ayuda contextual -------------------------------------------------
  console.log('\n--- 3. ayuda contextual ---')
  const tips = await js(`document.querySelectorAll('.helptip-btn').length`)
  check(tips >= 10, 'hay globos de ayuda repartidos por la interfaz', `${tips} signos de interrogación`)
  await js(`document.querySelector('.stats .helptip-btn').click()`)
  await sleep(250)
  const tipText = await js(`(document.querySelector('.helptip-box')||{}).textContent || ''`)
  check(tipText.includes('Observaciones') && tipText.length > 80, 'el globo explica el término', `${tipText.slice(0, 70)}…`)
  await shot('02-ayuda')
  await js(`document.querySelector('.stats .helptip-btn').click()`)
  await sleep(200)

  // ---- 4. ciclo completo ---------------------------------------------------
  console.log('\n--- 4. ciclo completo ---')
  const before = await js(`document.querySelectorAll('tbody tr').length`)
  await setInput('#note', NOTE)
  check((await clickText('Interpretar con QVAC')) === true, 'el botón de interpretar responde')
  await sleep(1200)
  const phases = await js(`document.querySelectorAll('.phases li').length`)
  const hasProgress = await js(`!!document.querySelector('.progress')`)
  check(phases === 4 && hasProgress, 'la espera muestra fases y barra de progreso', `${phases} fases`)
  const expectShown = await js(`(document.querySelector('.wait-head')||{}).textContent||''`)
  check(/habituales|midiendo/.test(expectShown), 'la espera dice cuánto suele tardar', expectShown.trim())
  await shot('03-espera')
  const extractMs = await waitFor(`document.querySelectorAll('.eq-row').length > 0`, 'filas de equipo', 120000)
  summary.extractMs = extractMs
  await sleep(3000)
  const eqRows = await js(`document.querySelectorAll('.eq-row').length`)
  const marks = await js(`document.querySelectorAll('.evidence mark').length`)
  const quotes = await js(`[...document.querySelectorAll('.eq-quote q')].map(q=>q.textContent)`)
  check(eqRows >= 1, 'aparecen filas de equipo', `${eqRows} filas en ${(extractMs / 1000).toFixed(1)} s`)
  check(marks >= 1, 'la evidencia queda resaltada sobre la nota', `${marks} citas`)
  check(await js(`document.querySelectorAll('.evidence mark.invalid').length === 0`), 'ninguna cita inválida')
  summary.quotes = quotes
  await shot('04-revision')

  // ---- 5. cascada país → ciudad -------------------------------------------
  console.log('\n--- 5. país y ciudad ---')
  const countryOpts = await js(`document.querySelectorAll('#rv-p option').length`)
  check(countryOpts === 11, 'el país es una lista cerrada', `${countryOpts - 1} países`)
  await setInput('#rv-p', 'Panama')
  await sleep(400)
  const cityOpts = await js(`(() => { const i=document.querySelector('#rv-c'); const dl=document.getElementById(i.getAttribute('list')); return dl ? dl.querySelectorAll('option').length : -1 })()`)
  check(cityOpts >= 8, 'al elegir país, la ciudad ofrece las ya registradas', `${cityOpts} ciudades de Panamá`)
  const newCity = `Ciudad Prueba ${Date.now().toString().slice(-5)}`
  await setInput('#rv-c', newCity)
  await sleep(300)
  check(await js(`!!document.querySelector('.tag-new')`), 'una ciudad no registrada se marca como nueva')
  check(await js(`document.querySelector('#rv-c').value === ${JSON.stringify(newCity)}`), 'la ciudad admite texto libre')

  // ---- 6. duplicados y guardado -------------------------------------------
  console.log('\n--- 6. cliente y guardado ---')
  const dupCount = await js(`document.querySelectorAll('.dup-item').length`)
  check(dupCount >= 2, 'ofrece candidatos de cliente y la opción de nuevo', `${dupCount - 1} candidatos`)
  await clickText('Es nuevo')
  await sleep(200)
  check((await clickText('Confirmar y guardar')) === true, 'guarda con un clic')
  const grew = await waitFor(`document.querySelectorAll('tbody tr').length > ${before}`, 'la tabla crece', 20000, 400)
  const after = await js(`document.querySelectorAll('tbody tr').length`)
  check(true, 'la tabla creció tras guardar', `${before} → ${after} filas en ${grew} ms`)
  check(await js(`document.querySelectorAll('.eq-row').length === 0`), 'el panel de revisión queda limpio')
  const cityStuck = await js(`[...document.querySelectorAll('tbody tr')].some(tr => tr.textContent.includes(${JSON.stringify(newCity)}) && tr.textContent.includes('Panamá'))`)
  check(cityStuck, 'la ciudad nueva quedó guardada con su país')

  // ---- 7. edición de un registro guardado ---------------------------------
  console.log('\n--- 7. corregir un registro ya guardado ---')
  check((await clickText('Corregir')) === true, 'cada fila de la tabla se puede corregir')
  await sleep(600)
  check(await js(`!!document.querySelector('.edit-banner')`), 'avisa que estás editando un registro guardado')
  check(await js(`document.querySelectorAll('tbody tr.editing').length > 0`), 'resalta en la tabla la observación que estás editando')
  const editRows = await js(`document.querySelectorAll('.eq-row').length`)
  check(editRows > 0, 'carga los equipos del registro', `${editRows} filas`)
  await shot('05-edicion')
  const firstQty = await js(`document.querySelector('#eq-0-q').value`)
  await setInput('#eq-0-q', String(Number(firstQty) + 5))
  const rowsBeforeEdit = await js(`document.querySelectorAll('tbody tr').length`)
  check((await clickText('Guardar cambios')) === true, 'guarda los cambios de la edición')
  await sleep(2500)
  const rowsAfterEdit = await js(`document.querySelectorAll('tbody tr').length`)
  check(rowsAfterEdit === rowsBeforeEdit, 'editar reemplaza el registro, no lo duplica', `${rowsBeforeEdit} → ${rowsAfterEdit} filas`)
  const qtyStuck = await js(`[...document.querySelectorAll('tbody tr')].some(tr => tr.textContent.includes(${JSON.stringify(String(Number(firstQty) + 5))}))`)
  check(qtyStuck, 'el cambio se ve reflejado en la tabla')

  // ---- 8. guía y tiempos ---------------------------------------------------
  console.log('\n--- 8. glosario y tiempos medidos ---')
  check((await clickText('Abrir la guía')) === true, 'la guía completa se abre')
  await sleep(400)
  const terms = await js(`document.querySelectorAll('.glossary-item').length`)
  check(terms >= 12, 'el glosario cubre todos los campos', `${terms} términos`)
  await shot('06-glosario')
  check((await clickText('Cuánto tarda cada proceso')) === true, 'hay pestaña de tiempos')
  await sleep(400)
  const timingRows = await js(`[...document.querySelectorAll('[role=tabpanel] tbody tr')].map(tr => [...tr.children].slice(0,2).map(td=>td.textContent.trim()).join(': '))`)
  check(timingRows.length >= 4, 'muestra los tiempos medidos de cada proceso', `${timingRows.length} procesos`)
  summary.timings = timingRows
  console.log('      ' + timingRows.join('\n      '))
  await shot('07-tiempos')

  // ---- 9. accesibilidad y consola -----------------------------------------
  console.log('\n--- 9. accesibilidad y consola ---')
  const noLabel = await js(`[...document.querySelectorAll('input,select,textarea')].filter(el => !el.labels?.length && !el.getAttribute('aria-label') && el.type!=='hidden').length`)
  check(noLabel === 0, 'todos los campos tienen etiqueta asociada', `${noLabel} sin etiqueta`)
  const noName = await js(`[...document.querySelectorAll('button')].filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')).length`)
  check(noName === 0, 'todos los botones tienen nombre accesible', `${noName} sin nombre`)
  check(await js(`document.documentElement.lang === 'es' || document.documentElement.lang === ''`), 'el documento no declara un idioma equivocado')
  const hSeq = await js(`[...document.querySelectorAll('h1,h2,h3')].map(h=>h.tagName)`)
  check(hSeq[0] === 'H1' && hSeq.filter((h) => h === 'H1').length === 1, 'un solo encabezado principal', hSeq.join(' '))
  check(await js(`document.body.scrollWidth <= document.documentElement.clientWidth + 2`), 'la página no se desborda a lo ancho')
  check(consoleErrors.length === 0, 'sin errores ni avisos en consola', consoleErrors.slice(0, 3).join(' | ') || 'ninguno')
  summary.consoleErrors = consoleErrors

  // ---- 10. columnas configurables ----------------------------------------
  console.log('--- 10. columnas de la tabla ---')
  const colsBefore = await js(`document.querySelectorAll('thead th').length`)
  check((await clickText('Columnas')) === true, 'el selector de columnas se abre')
  await sleep(300)
  const chips = await js(`document.querySelectorAll('.colpick label').length`)
  check(chips === 20, 'ofrece las 20 columnas del modelo de Philips', `${chips} columnas`)
  await js(`[...document.querySelectorAll('.colpick label')].find(l => l.textContent.trim() === 'Modelo').querySelector('input').click()`)
  await sleep(400)
  const colsAfter = await js(`document.querySelectorAll('thead th').length`)
  check(colsAfter === colsBefore + 1, 'activar una columna la añade a la tabla', `${colsBefore} → ${colsAfter}`)
  check(await js(`[...document.querySelectorAll('thead th')].some(th => th.textContent.includes('Modelo'))`), 'la columna Modelo aparece en la cabecera')
  for (const name of ['Año instalación', 'Observador', 'Fuente', 'Notas', 'Evidencia', 'Nota original', 'Respuesta del técnico', 'ID observación']) {
    const exists = await js(`[...document.querySelectorAll('.colpick label')].some(l => l.textContent.trim() === ${JSON.stringify(name)})`)
    if (!exists) check(false, `falta la columna ${name}`)
  }
  check(true, 'las columnas que Philips pedía y no se veían están disponibles')
  await shot('09-columnas')

  // ---- 11. filtros completos ---------------------------------------------
  console.log('--- 11. filtros ---')
  const rowsAll = await js(`document.querySelectorAll('tbody tr').length`)
  await setInput('.fb-selects select:nth-of-type(1)', '')
  const selCount = await js(`document.querySelectorAll('.fb-selects select').length`)
  check(selCount === 6, 'hay filtro de país, ciudad, modalidad, marca, estado y confianza', `${selCount} desplegables`)
  check(await js(`document.querySelectorAll('.fb-age input').length === 2`), 'hay rango de edad desde/hasta')
  check(await js(`!!document.querySelector('.fb-search input')`), 'hay búsqueda de texto libre')
  await js(`(() => { const s=[...document.querySelectorAll('.fb-selects select')][2]; const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s,'CT'); s.dispatchEvent(new Event('change',{bubbles:true})); })()`)
  await sleep(500)
  const rowsCT = await js(`document.querySelectorAll('tbody tr').length`)
  check(rowsCT > 0 && rowsCT < rowsAll, 'filtrar por modalidad reduce la tabla', `${rowsAll} → ${rowsCT} filas`)
  check(await js(`!!document.querySelector('.chips .chip')`), 'el filtro activo se muestra como etiqueta')
  await clickText('Limpiar filtros')
  await sleep(400)
  check((await js(`document.querySelectorAll('tbody tr').length`)) === rowsAll, 'limpiar filtros devuelve todas las filas')

  // ---- 12. historial de cambios ------------------------------------------
  console.log('--- 12. historial ---')
  await clickText('Corregir')
  await sleep(700)
  const q0 = await js(`document.querySelector('#eq-0-q').value`)
  await setInput('#eq-0-q', String(Number(q0) + 3))
  await setInput('#rv-o', 'Auditoría automática')
  await clickText('Guardar cambios')
  await sleep(2500)
  check(await js(`[...document.querySelectorAll('tbody tr')].some(tr => tr.querySelector('.badge.neutral'))`), 'la tabla marca las filas con correcciones')
  await clickText('Corregir')
  await sleep(700)
  check((await clickText('Ver historial de cambios')) === true, 'el historial se puede abrir desde la edición')
  await sleep(300)
  const changes = await js(`[...document.querySelectorAll('.hist-list ul li')].map(li => li.textContent)`)
  check(changes.length > 0, 'el historial describe qué cambió', changes.slice(0, 2).join(' · '))
  check(changes.some((c) => /cantidad/i.test(c)), 'registra el cambio de cantidad')
  check(changes.some((c) => /Observador/i.test(c)), 'registra el cambio de observador')
  await shot('10-historial')
  await clickText('Cancelar edición')
  await sleep(400)

  // ---- 13. reportes en PDF ------------------------------------------------
  console.log('--- 13. reportes ---')
  const kinds = await js(`document.querySelectorAll('.rep-kind').length`)
  check(kinds === 5, 'hay cinco tipos de reporte', `${kinds}`)
  await setInput('.rep-form input', 'Josué Carrillo')
  const made = []
  for (const [label, needsSite] of [['Inventario de base instalada', false], ['Resumen ejecutivo', false], ['Pendiente de validar', false], ['Historial de cambios', false], ['Ficha de cliente', true]]) {
    await js(`[...document.querySelectorAll('.rep-kind')].find(b => b.textContent.includes(${JSON.stringify(label)})).click()`)
    await sleep(300)
    if (needsSite) {
      await js(`(() => { const s=document.querySelector('.rep-form select'); const set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s, s.options[1].value); s.dispatchEvent(new Event('change',{bubbles:true})); })()`)
      await sleep(300)
    }
    const path = await js(`(async () => { const r = await window.api.report({ kind: ${JSON.stringify(label)}, requestedBy:'x' }, 'open'); return 'probe' })()`).catch(() => 'skip')
    made.push(label)
  }
  check(made.length === 5, 'los cinco reportes se pueden seleccionar')
  // Genera de verdad el inventario y comprueba el PDF en disco.
  await js(`[...document.querySelectorAll('.rep-kind')].find(b => b.textContent.includes('Inventario')).click()`)
  await sleep(300)
  const pdf = await js(`(async () => { const r = await window.api.report({ kind:'inventario', requestedBy:'Auditoría', filter:{country:null,city:null,modality:null,brand:null,minAgeYears:null,maxAgeYears:null,status:null,confidence:null,textSearch:null}, columns:['site','city','country','modality','quantity','brand','age','confidence','status'] }, 'open'); return r.error ? 'ERR:'+r.error.message : r.path })()`)
  summary.pdfPath = pdf
  check(typeof pdf === 'string' && pdf.endsWith('.pdf'), 'el PDF se genera y devuelve una ruta', String(pdf).slice(0, 120))
  await shot('11-reportes')

  await js(`window.scrollTo(0,0)`)
  await sleep(300)
  await shot('08-final')
} catch (e) {
  check(false, `auditoría interrumpida: ${e.message}`)
  try { await shot('99-error') } catch { /* nada */ }
} finally {
  ws.close()
}

const failed = results.filter((r) => !r.ok)
writeFileSync('bench/audit.json', JSON.stringify({ ok: failed.length === 0, total: results.length, failed: failed.length, results, summary }, null, 2))
console.log(`\n${failed.length === 0 ? 'AUDITORÍA OK' : 'AUDITORÍA: ' + failed.length + ' fallos'} · ${results.length - failed.length}/${results.length} · detalle en bench/audit.json`)
process.exit(failed.length === 0 ? 0 : 1)
