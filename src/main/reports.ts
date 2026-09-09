// Generación de reportes en PDF. Sin librerías: se compone HTML y se imprime
// con printToPDF de Chromium, que ya viene dentro de Electron. Funciona sin red.

import { BrowserWindow } from 'electron'
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COLUMN_BY_KEY, countryLabel, type ColumnKey } from '../shared/columns.ts'
import { CONFIDENCE_LABEL_ES, MODALITY_LABEL_ES, STATUS_LABEL_ES } from '../shared/catalog.ts'
import { REPORT_BY_KIND, type ReportRequest } from '../shared/reports.ts'
import type { Equipment, Observation, QueryFilter } from '../shared/types.ts'

const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)

const norm = (s: string | null | undefined): string =>
  (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

interface Row { o: Observation; e: Equipment }

function flatten(obs: Observation[]): Row[] {
  return obs.flatMap((o) => o.equipment.map((e) => ({ o, e })))
}

function applyFilter(rows: Row[], f: QueryFilter): Row[] {
  return rows.filter(({ o, e }) => {
    if (f.country && norm(o.country) !== norm(f.country)) return false
    if (f.city && !norm(o.city).includes(norm(f.city))) return false
    if (f.modality && e.modality !== f.modality) return false
    if (f.brand && e.brand !== f.brand) return false
    if (f.minAgeYears !== null && (e.approxAgeYears === null || e.approxAgeYears < f.minAgeYears)) return false
    if (f.maxAgeYears !== null && (e.approxAgeYears === null || e.approxAgeYears > f.maxAgeYears)) return false
    if (f.status && e.status !== f.status) return false
    if (f.confidence && e.confidence !== f.confidence) return false
    if (f.textSearch) {
      const hay = norm(`${o.facilityCanonical ?? o.facility} ${o.city ?? ''} ${e.brand ?? ''} ${e.model ?? ''} ${o.rawText}`)
      if (!hay.includes(norm(f.textSearch))) return false
    }
    return true
  })
}

function describeFilter(f: QueryFilter): string[] {
  const out: string[] = []
  if (f.country) out.push(`País: ${countryLabel(f.country)}`)
  if (f.city) out.push(`Ciudad: ${f.city}`)
  if (f.modality) out.push(`Modalidad: ${MODALITY_LABEL_ES[f.modality]}`)
  if (f.brand) out.push(`Marca: ${f.brand}`)
  if (f.minAgeYears !== null) out.push(`Edad mínima: ${f.minAgeYears} años`)
  if (f.maxAgeYears !== null) out.push(`Edad máxima: ${f.maxAgeYears} años`)
  if (f.status) out.push(`Estado: ${STATUS_LABEL_ES[f.status]}`)
  if (f.confidence) out.push(`Confianza: ${CONFIDENCE_LABEL_ES[f.confidence]}`)
  if (f.textSearch) out.push(`Texto: "${f.textSearch}"`)
  return out
}

const CSS = `
*{box-sizing:border-box}
body{font:11px/1.5 Arial,Helvetica,sans-serif;color:#162b3d;margin:0}
.head{border-bottom:3px solid #0076ce;padding-bottom:12px;margin-bottom:16px;display:flex;gap:16px;align-items:flex-start}
.logo{width:58px;height:58px;background:#004b93;border-radius:4px;flex:none;display:flex;align-items:center;justify-content:center;padding:8px}
.logo img{width:100%}
.head h1{font-size:19px;color:#004b93;margin:0 0 2px}
.head .sub{color:#5b6f7f;font-size:11px;margin:0 0 6px}
.meta{font-size:10px;color:#5b6f7f;line-height:1.7}
.meta b{color:#162b3d}
.chips{margin:10px 0 0}
.chip{display:inline-block;background:#eaf6fd;color:#004b93;border-radius:10px;padding:2px 9px;font-size:10px;font-weight:700;margin:0 4px 4px 0}
.note{background:#fffdf3;border-left:3px solid #f5a623;padding:8px 11px;margin:12px 0;font-size:11px}
h2{font-size:13px;color:#004b93;margin:20px 0 8px;border-bottom:1px solid #d8e5ed;padding-bottom:4px}
h3{font-size:12px;color:#162b3d;margin:14px 0 5px}
table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:10px}
th{background:#eaf6fd;color:#004b93;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.4px;padding:6px 7px;border-bottom:1px solid #d8e5ed}
td{padding:5px 7px;border-bottom:1px solid #eef3f7;vertical-align:top}
td.num,th.num{text-align:right}
tr:nth-child(even) td{background:#fafcfe}
.b{display:inline-block;padding:1px 5px;border-radius:2px;font-size:9px;font-weight:700}
.b.alta{background:#dcede3;color:#1c6b47}.b.media{background:#f5e8d2;color:#8a5a0c}.b.baja{background:#f5e1de;color:#9e362b}
.kpis{display:flex;gap:10px;margin:12px 0}
.kpi{flex:1;border:1px solid #d8e5ed;border-radius:5px;padding:9px 11px}
.kpi span{display:block;color:#5b6f7f;font-size:10px}
.kpi b{font-size:19px;color:#004b93}
.bar{height:9px;background:#0076ce;border-radius:2px;display:inline-block;vertical-align:middle}
.quote{color:#5b6f7f;font-style:italic}
.rev{border-left:2px solid #d8e5ed;padding:0 0 0 11px;margin:0 0 12px}
.rev li{margin-bottom:2px}
.empty{color:#5b6f7f;padding:14px 0}
.foot{margin-top:22px;padding-top:9px;border-top:1px solid #d8e5ed;color:#5b6f7f;font-size:9px;line-height:1.6}
`

function confClass(c: Equipment['confidence']): string {
  return c === 'High' ? 'alta' : c === 'Medium' ? 'media' : 'baja'
}

function tableOf(rows: Row[], columns: ColumnKey[]): string {
  if (!rows.length) return '<p class="empty">No hay equipos que cumplan este filtro.</p>'
  const cols = columns.map((k) => COLUMN_BY_KEY[k]).filter(Boolean)
  const head = cols.map((c) => `<th class="${c.numeric ? 'num' : ''}">${esc(c.label)}</th>`).join('')
  const body = rows.map(({ o, e }) => {
    const tds = cols.map((c) => {
      const v = c.text(o, e)
      if (c.key === 'confidence') return `<td><span class="b ${confClass(e.confidence)}">${esc(v)}</span></td>`
      return `<td class="${c.numeric ? 'num' : ''}">${esc(v)}</td>`
    }).join('')
    return `<tr>${tds}</tr>`
  }).join('')
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function sumBy(rows: Row[], key: (r: Row) => string): Array<[string, number]> {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.e.quantity)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

function barTable(title: string, data: Array<[string, number]>): string {
  if (!data.length) return ''
  const max = Math.max(...data.map((d) => d[1]))
  const rows = data.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v}</td><td style="width:45%"><span class="bar" style="width:${Math.round((v / max) * 100)}%"></span></td></tr>`).join('')
  return `<h3>${esc(title)}</h3><table><tbody>${rows}</tbody></table>`
}

function bodyFor(req: ReportRequest, all: Observation[], rows: Row[]): string {
  const cols = req.columns.length ? req.columns : (['site', 'city', 'modality', 'quantity', 'brand', 'age', 'confidence', 'status'] as ColumnKey[])

  if (req.kind === 'inventario') {
    return `<h2>Equipos (${rows.length} filas, ${rows.reduce((s, r) => s + r.e.quantity, 0)} unidades)</h2>${tableOf(rows, cols)}`
  }

  if (req.kind === 'resumen') {
    const units = rows.reduce((s, r) => s + r.e.quantity, 0)
    const old = rows.filter((r) => (r.e.approxAgeYears ?? 0) >= 7).reduce((s, r) => s + r.e.quantity, 0)
    const sites = new Set(rows.map((r) => r.o.facilityCanonical ?? r.o.facility)).size
    const low = rows.filter((r) => r.e.confidence === 'Low').length
    const oldSites = [...new Set(rows.filter((r) => (r.e.approxAgeYears ?? 0) >= 7).map((r) => r.o.facilityCanonical ?? r.o.facility))]
    return `
      <div class="kpis">
        <div class="kpi"><span>Clientes</span><b>${sites}</b></div>
        <div class="kpi"><span>Unidades</span><b>${units}</b></div>
        <div class="kpi"><span>Con 7+ años</span><b>${old}</b></div>
        <div class="kpi"><span>Confianza baja</span><b>${low}</b></div>
      </div>
      <h2>Distribución</h2>
      ${barTable('Por modalidad', sumBy(rows, (r) => MODALITY_LABEL_ES[r.e.modality]))}
      ${barTable('Por país', sumBy(rows, (r) => countryLabel(r.o.country)))}
      ${barTable('Por antigüedad', sumBy(rows, (r) => r.e.approxAgeYears === null ? 'Sin dato' : r.e.approxAgeYears <= 3 ? '0–3 años' : r.e.approxAgeYears <= 7 ? '4–7 años' : '8+ años'))}
      <h2>Clientes con equipo de 7 años o más (${oldSites.length})</h2>
      ${oldSites.length ? `<p>${oldSites.map(esc).join(' · ')}</p>` : '<p class="empty">Ninguno con este filtro.</p>'}`
  }

  if (req.kind === 'validacion') {
    const pend = rows.filter((r) => r.e.confidence === 'Low' || r.e.evidenceInvalid || r.e.status === 'Unknown' || r.e.brand === null || r.e.approxAgeYears === null)
    const reason = ({ e }: Row): string => {
      const rs: string[] = []
      if (e.evidenceInvalid) rs.push('la cita no aparece en la nota')
      if (e.confidence === 'Low') rs.push('confianza baja')
      if (e.status === 'Unknown') rs.push('estado sin confirmar')
      if (e.brand === null) rs.push('falta la marca')
      if (e.approxAgeYears === null) rs.push('falta la edad')
      return rs.join(', ')
    }
    const body = pend.map((r) => `<tr><td>${esc(r.o.facilityCanonical ?? r.o.facility)}</td><td>${esc(r.o.city ?? '—')}</td><td>${esc(MODALITY_LABEL_ES[r.e.modality])}</td><td class="num">${r.e.quantity}</td><td><span class="b ${confClass(r.e.confidence)}">${esc(CONFIDENCE_LABEL_ES[r.e.confidence])}</span></td><td>${esc(reason(r))}</td><td class="quote">${esc(r.e.evidence || '—')}</td></tr>`).join('')
    return `
      <div class="kpis">
        <div class="kpi"><span>Filas por revisar</span><b>${pend.length}</b></div>
        <div class="kpi"><span>De un total de</span><b>${rows.length}</b></div>
        <div class="kpi"><span>Clientes afectados</span><b>${new Set(pend.map((r) => r.o.facilityCanonical ?? r.o.facility)).size}</b></div>
      </div>
      <h2>Cola de validación</h2>
      ${pend.length ? `<table><thead><tr><th>Cliente</th><th>Ciudad</th><th>Modalidad</th><th class="num">Cant.</th><th>Confianza</th><th>Por qué</th><th>Evidencia</th></tr></thead><tbody>${body}</tbody></table>` : '<p class="empty">Nada pendiente con este filtro.</p>'}`
  }

  if (req.kind === 'cambios') {
    const edited = all.filter((o) => (o.history?.length ?? 0) > 0)
    if (!edited.length) return '<h2>Historial de cambios</h2><p class="empty">Todavía no se ha editado ninguna observación. El historial se llena cuando alguien corrige un registro guardado.</p>'
    const blocks = edited.map((o) => {
      const revs = (o.history ?? []).map((r) => `
        <div class="rev">
          <b>${esc(new Date(r.at).toLocaleString('es-PA'))}</b> · ${esc(r.by)}
          <ul>${r.changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        </div>`).join('')
      return `<h3>${esc(o.facilityCanonical ?? o.facility)} · visita del ${esc(o.createdAt)}</h3>${revs}`
    }).join('')
    return `<h2>Historial de cambios (${edited.length} observaciones editadas)</h2>${blocks}`
  }

  // Ficha de cliente
  const name = req.facility ?? ''
  const mine = all.filter((o) => norm(o.facilityCanonical ?? o.facility) === norm(name))
  if (!mine.length) return `<p class="empty">No hay observaciones para ${esc(name)}.</p>`
  const myRows = flatten(mine)
  const first = mine[0]
  const visits = [...mine].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const units = myRows.reduce((s, r) => s + r.e.quantity, 0)
  const hist = mine.flatMap((o) => (o.history ?? []).map((r) => ({ o, r }))).sort((a, b) => b.r.at.localeCompare(a.r.at))
  return `
    <div class="kpis">
      <div class="kpi"><span>Unidades</span><b>${units}</b></div>
      <div class="kpi"><span>Modalidades</span><b>${new Set(myRows.map((r) => r.e.modality)).size}</b></div>
      <div class="kpi"><span>Visitas</span><b>${mine.length}</b></div>
      <div class="kpi"><span>Última visita</span><b style="font-size:13px">${esc(visits[0].createdAt)}</b></div>
    </div>
    <p class="meta"><b>Ubicación:</b> ${esc([first.city, countryLabel(first.country)].filter(Boolean).join(', ') || '—')}</p>
    <h2>Equipo instalado</h2>
    ${tableOf(myRows, cols.filter((c) => c !== 'site'))}
    <h2>Visitas registradas</h2>
    ${visits.map((o) => `
      <h3>${esc(o.createdAt)} · ${esc(o.observer)} · ${o.source === 'Voice' ? 'dictado' : o.source === 'Seed' ? 'semilla' : 'escrito'}</h3>
      <p class="quote">“${esc(o.rawText)}”</p>
      ${o.followUpAnswer ? `<p><b>Respuesta del técnico:</b> ${esc(o.followUpAnswer)}</p>` : ''}
    `).join('')}
    ${hist.length ? `<h2>Historial de cambios</h2>${hist.map(({ r }) => `<div class="rev"><b>${esc(new Date(r.at).toLocaleString('es-PA'))}</b> · ${esc(r.by)}<ul>${r.changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>`).join('')}` : ''}`
}

export async function buildReportHtml(req: ReportRequest, all: Observation[], logoDataUri: string): Promise<string> {
  const def = REPORT_BY_KIND[req.kind]
  const rows = applyFilter(flatten(all), req.filter)
  const chips = describeFilter(req.filter)
  const now = new Date()
  const title = req.kind === 'cliente' ? `${def.title}: ${req.facility ?? ''}` : def.title

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>
    <div class="head">
      <div class="logo">${logoDataUri ? `<img src="${logoDataUri}" alt="Philips">` : ''}</div>
      <div style="flex:1">
        <h1>${esc(title)}</h1>
        <p class="sub">${esc(def.purpose)} · Generado con Eco, inteligencia de base instalada 100% local</p>
        <div class="meta">
          <b>Solicitado por:</b> ${esc(req.requestedBy || '—')} &nbsp;·&nbsp;
          <b>Generado:</b> ${esc(now.toLocaleString('es-PA'))} &nbsp;·&nbsp;
          <b>Alcance:</b> ${rows.length} filas de equipo sobre ${all.length} observaciones
        </div>
        ${chips.length ? `<div class="chips">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>` : '<div class="chips"><span class="chip">Sin filtros: base completa</span></div>'}
      </div>
    </div>
    ${req.note ? `<div class="note">${esc(req.note)}</div>` : ''}
    ${bodyFor(req, all, rows)}
    <div class="foot">
      Eco · Prototipo del equipo Jajanken para el reto Philips · Hackathon ISD Summit 2026 · No es un producto oficial de Philips.<br>
      Datos sintéticos. Todos los clientes, marcas y equipos son ficticios. Ninguna cifra describe una institución real.<br>
      Generado sin conexión: la extracción, la transcripción y la deduplicación corren dentro de esta computadora con QVAC.
    </div>
  </body></html>`
}

/** Compone el HTML, lo imprime a PDF con Chromium y devuelve los bytes. */
export async function renderReportPdf(req: ReportRequest, all: Observation[], appPath: string): Promise<Buffer> {
  let logo = ''
  const svgPath = join(appPath, 'src', 'renderer', 'src', 'assets', 'philips-logo.svg')
  const altPath = join(appPath, 'resources', 'philips-logo.svg')
  const found = existsSync(svgPath) ? svgPath : existsSync(altPath) ? altPath : null
  if (found) logo = `data:image/svg+xml;base64,${(await readFile(found)).toString('base64')}`

  const html = await buildReportHtml(req, all, logo)
  const dir = join(tmpdir(), 'eco-reports')
  await mkdir(dir, { recursive: true })
  const file = join(dir, `r-${Date.now()}.html`)
  await writeFile(file, html, 'utf8')

  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true, javascript: false } })
  try {
    await win.loadFile(file)
    return await win.webContents.printToPDF({
      pageSize: 'Letter',
      landscape: req.kind === 'inventario' && req.columns.length > 7,
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#5b6f7f;padding:0 14mm;display:flex;justify-content:space-between">' +
        '<span>Eco · Jajanken · reto Philips · datos sintéticos</span>' +
        '<span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>'
    })
  } finally {
    win.destroy()
    await unlink(file).catch(() => undefined)
  }
}
