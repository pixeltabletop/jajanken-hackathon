// Mide el contraste de cada par declarado con la fórmula de luminancia relativa
// de WCAG 2.1, en los tres temas. Sale con código distinto de cero si alguno
// queda por debajo de su umbral.
//
//   node scripts/check-contrast.mjs            imprime la tabla y el veredicto
//
// Existe para que un ajuste de última hora no rompa la legibilidad en silencio.
// Umbrales: 4.5 texto normal · 3.0 texto grande y bordes/rellenos de estado.

import { THEMES } from '../src/renderer/src/assets/themes.ts'

const AA = 4.5
const AA_LARGE = 3

function channel(v) {
  const c = v / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function luminance(hex) {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/**
 * Mezcla dos colores con una opacidad. Un botón deshabilitado no es un token:
 * es el color de encendido a 55 % sobre su fondo, y así es como hay que medirlo.
 */
export function mix(fgHex, bgHex, alpha) {
  const hex = (h) => {
    const n = h.replace('#', '')
    const f = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
    return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16))
  }
  const [r1, g1, b1] = hex(fgHex)
  const [r2, g2, b2] = hex(bgHex)
  const c = (a, b) => Math.round(a * alpha + b * (1 - alpha))
  return '#' + [c(r1, r2), c(g1, g2), c(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function ratio(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

// Cada par: [elemento, estado, token de fondo, token de texto, umbral].
// Los tokens se resuelven contra el tema en curso. Un valor con '#' es literal,
// y una función recibe los tokens del tema y devuelve el color ya mezclado.
const PAIRS = [
  // Barra lateral. Su fondo es --page-top, distinto del de las tarjetas, asi que
  // ningun par declarado para --surface cubre lo que se pinta encima.
  // Elegido y presionado: el fondo se mueve dentro de la misma familia y el
  // texto conserva su token, asi que hay que medir CADA texto contra el fondo
  // nuevo, no solo contra la superficie normal.
  ['Tarjeta elegida · titulo', 'grande', 'surfaceHover', 'primaryDeep', AA_LARGE],
  ['Tarjeta elegida · descripcion', 'normal', 'surfaceHover', 'ink', AA],
  ['Tarjeta elegida · vinetas', 'normal', 'surfaceHover', 'muted', AA],
  ['Tarjeta elegida · antetitulo', 'normal', 'surfaceHover', 'muted', AA],
  ['Tarjeta elegida · entrar', 'normal', 'surfaceHover', 'primaryDeep', AA],
  ['Tarjeta normal · entrar', 'normal', 'surface', 'primaryDeep', AA],
  ['Tarjeta elegida · borde', 'relleno', 'surfaceHover', 'primary', AA_LARGE],
  // La barra va INVERTIDA respecto al panel, con sus propios tokens. Todo lo que
  // se pinta dentro se mide contra --rail-bg, nunca contra la superficie del
  // panel: ese fue el error que dejaba texto ilegible al cambiar de tema.
  ['Barra lateral · texto de una fila', 'normal', 'railBg', 'railInk', AA],
  ['Barra lateral · titulo de grupo', 'normal', 'railBg', 'railMuted', AA],
  ['Barra lateral · semaforo, texto', 'normal', 'railBg', 'railMuted', AA],
  ['Barra lateral · icono', 'relleno', 'railBg', 'railAccent', AA_LARGE],
  ['Barra lateral · nombre del producto', 'grande', 'railBg', 'railInk', AA_LARGE],
  ['Barra lateral · borde derecho', 'relleno', 'railBg', 'railLine', AA_LARGE],
  ['Barra lateral · separadores', 'relleno', 'railBg', 'railLine', AA_LARGE],
  ['Barra lateral · fila al pasar el cursor', 'normal', 'railHover', 'railInk', AA],
  ['Barra lateral · icono al pasar el cursor', 'relleno', 'railHover', 'railAccent', AA_LARGE],
  ['Barra lateral · seccion actual', 'normal', 'railOnBg', 'railOnInk', AA],
  ['Barra lateral · texto tenue dentro del riel', 'normal', 'railBg', 'railMuted', AA],
  ['Barra lateral · seccion actual contra la barra', 'relleno', 'railBg', 'railOnBg', AA_LARGE],
  ['Barra lateral · punto de accion encendida', 'relleno', 'railBg', 'railAccent', AA_LARGE],
  ['Barra lateral · contorno de accion encendida', 'relleno', 'railBg', 'railAccent', AA_LARGE],
  ['Barra lateral · fila deshabilitada', 'normal', 'railBg', 'railMuted', AA],
  ['Barra lateral · avatar de sesion', 'normal', 'railAvatarBg', 'railAvatarInk', AA],
  ['Barra lateral · avatar contra la barra', 'relleno', 'railBg', 'railAvatarBg', AA_LARGE],
  ['Franja superior · titulo de seccion', 'grande', 'pageTop', 'primaryDeep', AA_LARGE],
  ['Franja superior · subtitulo', 'normal', 'pageTop', 'muted', AA],
  ['Texto de página', 'normal', 'page', 'ink', AA],
  ['Texto de tarjeta', 'normal', 'surface', 'ink', AA],
  ['Texto secundario', 'normal', 'surface', 'muted', AA],
  ['Texto secundario sobre página', 'normal', 'page', 'muted', AA],
  ['Texto secundario sobre superficie sutil', 'normal', 'surface2', 'muted', AA],
  ['Encabezado de sección', 'grande', 'surface', 'primaryDeep', AA_LARGE],
  ['Encabezado de tabla', 'normal', 'sky', 'onSky', AA],
  ['Etiqueta de filtro activo (chip)', 'normal', 'sky', 'onSky', AA],
  ['Botón principal', 'normal', 'primary', 'onPrimary', AA],
  ['Botón principal', 'hover', 'primaryDeep', 'onPrimary', AA],
  ['Botón principal contra la página', 'relleno', 'page', 'primary', AA_LARGE],
  ['Botón secundario', 'normal', 'surface', 'primaryDeep', AA],
  ['Borde de campo', 'relleno', 'surface', 'fieldLine', AA_LARGE],
  ['Anillo de foco', 'foco', 'surface', 'focus', AA_LARGE],
  ['Anillo de foco sobre página', 'foco', 'page', 'focus', AA_LARGE],
  ['Anillo de foco sobre selección', 'foco+elegido', 'sky', 'focus', AA_LARGE],
  ['Fila de tabla', 'hover', 'surfaceHover', 'ink', AA],
  ['Fila de tabla', 'elegida', 'sky', 'ink', AA],
  ['Fila de tabla elegida, texto secundario', 'elegida', 'sky', 'muted', AA],
  ['Opción de desplegable', 'normal', 'surface', 'ink', AA],
  ['Candidato de duplicado', 'elegido', 'sky', 'ink', AA],
  ['Tarjeta del selector', 'normal', 'surface', 'ink', AA],
  ['Tarjeta del selector', 'hover', 'surfaceHover', 'ink', AA],
  ['Tarjeta del selector', 'elegida', 'sky', 'onSky', AA],
  ['Badge de confianza alta', 'normal', 'okBg', 'ok', AA],
  ['Badge de confianza media', 'normal', 'warnBg', 'warn', AA],
  ['Badge de confianza baja', 'normal', 'badBg', 'bad', AA],
  ['Aviso ámbar', 'normal', 'alertBg', 'alertInk', AA],
  ['Aviso ámbar, borde', 'relleno', 'alertBg', 'alert', AA_LARGE],
  ['Resaltado de evidencia', 'resaltado', 'mark', 'markInk', AA],
  ['Texto seleccionado con el ratón', 'selección', 'mark', 'markInk', AA],
  ['Borde del resaltado, dentro', 'relleno', 'mark', 'markEdge', AA_LARGE],
  ['Borde del resaltado sobre el texto de la nota', 'relleno', 'sky', 'markEdge', AA_LARGE],
  ['Borde del resaltado sobre la tarjeta', 'relleno', 'surface', 'markEdge', AA_LARGE],
  ['Barra de gráfico elegida', 'elegida', 'surface', 'barOn', AA_LARGE],
  ['Barra de gráfico atenuada', 'no elegida', 'surface', 'barOff', AA_LARGE],
  ['Rejilla del gráfico', 'relleno', 'surface', 'grid', 1.2],
  ['Línea divisoria', 'relleno', 'surface', 'line', 1.2],
  ['Texto deshabilitado', 'deshabilitado', 'surface', 'muted', AA_LARGE],
  // Estados en los que algo queda elegido. Que no se comuniquen solo con color
  // es una regla del bloque; que además se sigan leyendo, se mide aquí.
  ['Chip de columna elegida', 'elegida', 'sky', 'onSky', AA],
  ['Tarjeta de reporte elegida', 'elegida', 'sky', 'onSky', AA],
  ['Tarjeta de reporte elegida, descripción', 'elegida', 'sky', 'muted', AA],
  ['Candidato de duplicado, borde', 'elegido', 'surface', 'primary', AA_LARGE],
  ['Pestaña activa', 'elegida', 'surface', 'primaryDeep', AA_LARGE],
  ['Botón fantasma activado', 'elegido', 'sky', 'onSky', AA],
  ['Fila abierta de la tabla', 'abierta', 'sky', 'ink', AA],
  // Deshabilitado con tokens propios, no con opacidad: a 55 % daba 1.59:1.
  ['Botón deshabilitado', 'deshabilitado', 'surface2', 'muted', AA],
  ['Botón deshabilitado, borde', 'deshabilitado', 'surface2', 'line', 1.2],
  ['Botón deshabilitado contra uno activo', 'deshabilitado', 'surface2', 'primary', AA_LARGE]
]

const rows = []
for (const theme of THEMES) {
  for (const [element, state, bgKey, fgKey, min] of PAIRS) {
    const bg = typeof bgKey === 'function' ? bgKey(theme.tokens) : bgKey.startsWith('#') ? bgKey : theme.tokens[bgKey]
    const fg = typeof fgKey === 'function' ? fgKey(theme.tokens) : fgKey.startsWith('#') ? fgKey : theme.tokens[fgKey]
    if (!bg || !fg) throw new Error(`Token inexistente en ${theme.id}: ${bgKey} / ${fgKey}`)
    const r = ratio(bg, fg)
    rows.push({ theme: theme.label, themeId: theme.id, element, state, bg, fg, min, r, ok: r + 0.005 >= min })
  }
}

const failed = rows.filter((r) => !r.ok)

for (const theme of THEMES) {
  const mine = rows.filter((r) => r.themeId === theme.id)
  const bad = mine.filter((r) => !r.ok)
  console.log(`${bad.length ? 'FALLA' : 'OK   '} ${theme.label} · ${mine.length - bad.length}/${mine.length} pares`)
  for (const r of bad) {
    console.log(`      ${r.element} (${r.state}): ${r.fg} sobre ${r.bg} = ${r.r.toFixed(2)}:1, necesita ${r.min}`)
  }
}


console.log(`\n${failed.length ? `CONTRASTE: ${failed.length} pares por debajo del umbral` : 'CONTRASTE OK'} · ${rows.length - failed.length}/${rows.length}`)
process.exit(failed.length ? 1 : 0)
