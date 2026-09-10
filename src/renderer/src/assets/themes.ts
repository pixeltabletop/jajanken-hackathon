// Registro único de temas. Cada entrada trae sus tokens de color.
//
// Son DOS a propósito: claro y oscuro. La variante azul se retiró el 2026-09-09
// por decisión de Josué. Tres temas no aportaban nada que no aportaran dos, y el
// tema es un factor estético: no puede costarle rendimiento a la aplicación ni
// multiplicar por tres lo que hay que medir en cada cambio de color. Ningún componente ni hoja de estilo puede escribir un
// color a mano: si aparece uno, sube aquí. Esa es la condición para que cambiar
// de tema no sea una cacería por todo el código.
//
// Los valores se miden con scripts/check-contrast.mjs, que importa este archivo.
// Cambiar un token obliga a correr `npm run check:contrast` antes de commitear.

export type ThemeId = 'blanco' | 'negro'

/** Nombre de cada token, sin el prefijo `--`. */
export interface ThemeTokens {
  /** Fondo de página. */
  page: string
  /** Franja superior del degradado del body. */
  pageTop: string
  /** Fondo de tarjetas y secciones. */
  surface: string
  /** Fondo sutil dentro de una tarjeta (filas de equipo, barra de filtros). */
  surface2: string
  /** Fondo de fila de tabla al pasar el cursor. */
  surfaceHover: string
  ink: string
  muted: string
  line: string
  /** Borde de campos de formulario. */
  fieldLine: string
  primary: string
  primaryDeep: string
  /** Texto sobre un relleno primario. */
  onPrimary: string
  sky: string
  /** Texto sobre el fondo `sky`. */
  onSky: string
  /** Anillo de foco. Se mide a 3:1 contra las superficies que toca. */
  focus: string
  /** Líneas de rejilla de los gráficos. */
  grid: string
  /** Color de la sombra de las tarjetas, en rgb() sin alfa. */
  shadowRgb: string
  ok: string
  okBg: string
  warn: string
  warnBg: string
  bad: string
  badBg: string
  /** Resaltado de evidencia. Mismo par en los tres temas: es el diferenciador. */
  mark: string
  markInk: string
  markEdge: string
  /** Avisos ámbar. */
  alert: string
  alertBg: string
  alertInk: string
  /** Relleno de la barra seleccionada en un gráfico. */
  barOn: string
  /** Relleno de las barras no seleccionadas cuando hay una selección. */
  barOff: string
  /**
   * Fondo propio de la pieza de logo de este tema, medido del archivo. El vídeo
   * es opaco, así que el recuadro solo desaparece si la caja lleva ese color.
   */
  logoBg: string

  /* La barra lateral va INVERTIDA respecto al panel: barra oscura con panel
     claro, barra clara con panel oscuro. Es un juego con las dos tonalidades
     del mismo logo, y obliga a que la barra tenga sus propios colores: si
     reutilizara los del panel, al invertirla el texto quedaria del color
     equivocado sobre el fondo equivocado, que es exactamente el fallo que
     llevamos toda la semana persiguiendo. */
  railBg: string
  railInk: string
  railMuted: string
  railLine: string
  railHover: string
  /** Iconos y nombre del producto dentro de la barra. */
  railAccent: string
  /** Seccion actual: relleno y texto. */
  railOnBg: string
  railOnInk: string
  /** Avatar de la sesion. */
  railAvatarBg: string
  railAvatarInk: string
}

export interface Theme {
  id: ThemeId
  /** Nombre visible, en español. */
  label: string
  /** Una línea para el paso de elección. */
  hint: string
  tokens: ThemeTokens
}

// El resaltado de evidencia lleva su propio fondo, así que el par amarillo/tinta
// se conserva idéntico en los tres temas y se lee siempre. D24.
const MARK = { mark: '#ffe98a', markInk: '#1c1a12', markEdge: '#a37d00' }

export const THEMES: Theme[] = [
  {
    id: 'blanco',
    label: 'Blanco clásico',
    hint: 'El de siempre. Fondo claro, azul Philips.',
    tokens: {
      page: '#f5f9fc',
      pageTop: '#ffffff',
      surface: '#ffffff',
      surface2: '#fbfdff',
      surfaceHover: '#f0f7fc',
      ink: '#162b3d',
      muted: '#5b6f7f',
      line: '#d8e5ed',
      fieldLine: '#6e8ca1',
      primary: '#0076ce',
      primaryDeep: '#004b93',
      onPrimary: '#ffffff',
      sky: '#eaf6fd',
      onSky: '#004b93',
      focus: '#0076ce',
      grid: '#dde8f0',
      shadowRgb: '0 75 147',
      ok: '#1c6b47',
      okBg: '#dcede3',
      warn: '#7a4f0a',
      warnBg: '#f7ebd6',
      bad: '#9e362b',
      badBg: '#f8e4e1',
      ...MARK,
      alert: '#8a5a0c',
      alertBg: '#fff8e5',
      alertInk: '#4a3a10',
      barOn: '#004b93',
      barOff: '#6693b6',
      logoBg: '#f4f8fb',
      // Panel claro, barra azul profundo.
      railBg: '#00294d',
      railInk: '#eef6fc',
      railMuted: '#a9c8de',
      railLine: '#5d87a8',
      railHover: '#073a63',
      railAccent: '#8fd0f5',
      railOnBg: '#0076ce',
      railOnInk: '#ffffff',
      railAvatarBg: '#8fd0f5',
      railAvatarInk: '#00294d'
    }
  },
  {
    id: 'negro',
    label: 'Negro',
    hint: 'Máximo contraste. Fondo negro, texto claro.',
    tokens: {
      page: '#000000',
      pageTop: '#0a0b0d',
      surface: '#141619',
      surface2: '#1b1e22',
      surfaceHover: '#23272c',
      ink: '#f4f6f8',
      muted: '#adb9c4',
      line: '#343a41',
      fieldLine: '#6b7681',
      primary: '#4fb3f0',
      primaryDeep: '#9ad4f8',
      onPrimary: '#04121d',
      sky: '#12222e',
      onSky: '#cfe6f5',
      focus: '#7ecbff',
      grid: '#2a3037',
      shadowRgb: '0 0 0',
      ok: '#6fd3a5',
      okBg: '#0c3a2b',
      warn: '#ecbc74',
      warnBg: '#3d2c0f',
      bad: '#f2a094',
      badBg: '#4a1d17',
      ...MARK,
      alert: '#ecbc74',
      alertBg: '#33270e',
      alertInk: '#f6e6c8',
      barOn: '#9ad4f8',
      barOff: '#5c8fb0',
      logoBg: '#000000',
      // Panel negro, barra azul profundo. NO clara: una barra blanca dentro de
      // un tema llamado oscuro se contradice a si misma, y Josue lo corrigio
      // despues de verla. El juego se mantiene igual, con la barra separada del
      // panel por el tono, solo que el salto va de negro a azul en vez de a
      // blanco.
      railBg: '#08243d',
      railInk: '#eaf4fb',
      railMuted: '#a3c3da',
      railLine: '#5787ab',
      railHover: '#0f3557',
      railAccent: '#7ec8f2',
      railOnBg: '#1276c6',
      railOnInk: '#ffffff',
      railAvatarBg: '#7ec8f2',
      railAvatarInk: '#08243d'
    }
  }
]

export const DEFAULT_THEME: ThemeId = 'blanco'

export const THEME_BY_ID: Record<ThemeId, Theme> = Object.fromEntries(
  THEMES.map((t) => [t.id, t])
) as Record<ThemeId, Theme>

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && THEMES.some((t) => t.id === v)
}

/**
 * camelCase → --kebab-case, el nombre real de la propiedad personalizada.
 *
 * El dígito cuenta como separador. Sin eso, `surface2` salía como `--surface2`
 * mientras TODAS las hojas de estilo escribían `var(--surface-2)`, así que esa
 * variable no existió nunca y cada sitio que la usaba se quedaba sin fondo, en
 * silencio y en los dos temas. El medidor de contraste no lo vio porque lee los
 * tokens del objeto, no lo que llega al navegador. Ver `check-tokens.mjs`.
 */
export function cssVarName(key: keyof ThemeTokens): string {
  return `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/([a-z])(\d)/g, '$1-$2')}`
}

/** Escribe los tokens del tema en :root. Se aplica al instante, sin reiniciar. */
export function applyTheme(id: ThemeId): void {
  const theme = THEME_BY_ID[id] ?? THEME_BY_ID[DEFAULT_THEME]
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.tokens)) {
    root.style.setProperty(cssVarName(key as keyof ThemeTokens), value)
  }
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.id === 'blanco' ? 'light' : 'dark'
}
