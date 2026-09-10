// Barra lateral plegable. Es la navegación y lo global de la aplicación.
//
// El patrón es el de las herramientas de hoy: una columna a la izquierda que se
// ensancha o se estrecha, y todo el resto de la ventana para lo que se elija.
// Ancha muestra icono y nombre de la acción; estrecha deja solo el icono, que
// sigue siendo pulsable y sigue diciendo qué es al pasar el cursor.
//
// Tres bloques, de arriba abajo:
//
//   · Marca y el control de plegado.
//   · Navegación: las dos puertas. Están siempre, así que ya no hace falta
//     volver al inicio para cambiar de una a otra.
//   · Acciones de la sección en la que estás. Solo las puntuales, no todas.
//   · Pie: semáforo del motor, tema y la sesión.
//
// El plegado se recuerda en el navegador, que es una comodidad de cada persona
// en su máquina y no un dato que deba viajar a ninguna parte.

import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { fmt, type TimingTable } from '../../../shared/timings.ts'
import type { ModelKey, ModelStatus } from '../../../shared/types.ts'
import type { ThemeId } from '../assets/themes.ts'
import { LogoMark } from './LogoMotion.tsx'

export type Modo = 'home' | 'capture' | 'follow'

export interface AccionLateral {
  id: string
  label: string
  icono: ReactNode
  onClick: () => void
  /** Marca la acción como encendida, no como página actual. */
  activa?: boolean
  disabled?: boolean
  /** Se añade al título emergente cuando hace falta explicar por qué no se puede. */
  nota?: string
}

interface Props {
  abierta: boolean
  onPlegar: () => void
  modo: Modo
  onIr: (m: Modo) => void
  onPreparar: (m: 'capture' | 'follow') => void
  acciones: AccionLateral[]
  theme: ThemeId
  onTheme: (t: ThemeId) => void
  status: ModelStatus | null
  timings: TimingTable
  operator: string
  onCambiarUsuario: () => void
  onLogout: () => void
}

// ------------------------------------------------------------------ iconos
// SVG en línea: ninguna dependencia y heredan el color del tema por currentColor.

const svg = (d: ReactNode, relleno = false): JSX.Element => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill={relleno ? 'currentColor' : 'none'}
    stroke={relleno ? 'none' : 'currentColor'}
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {d}
  </svg>
)

export const IconoInicio = (): JSX.Element => svg(<><path d="M3.5 10.2 12 3.6l8.5 6.6" /><path d="M5.6 9v10.4h12.8V9" /></>)
export const IconoRegistrar = (): JSX.Element => svg(<><path d="M8 4.4H6.4a2 2 0 0 0-2 2v12.8a2 2 0 0 0 2 2h11.2a2 2 0 0 0 2-2V6.4a2 2 0 0 0-2-2H16" /><rect x="8" y="2.6" width="8" height="3.6" rx="1.2" /><path d="M12 10.6v6M9 13.6h6" /></>)
export const IconoReportes = (): JSX.Element => svg(<><circle cx="10.6" cy="10.6" r="6.4" /><path d="m15.4 15.4 5 5" /></>)
export const IconoBase = (): JSX.Element => svg(<><rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2" /><path d="M3.4 9.6h17.2M9.2 9.6v10" /></>)
export const IconoFiltro = (): JSX.Element => svg(<path d="M3.6 5.2h16.8l-6.5 7.6v5.6l-3.8 2.2v-7.8Z" />)
export const IconoGrafica = (): JSX.Element => svg(<><path d="M4 19.6V4.4" /><path d="M4 19.6h16" /><path d="M8 16.4v-5M12.4 16.4V7.6M16.8 16.4v-7" /></>)
export const IconoColumnas = (): JSX.Element => svg(<><rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2" /><path d="M9.2 4.4v15.2M14.8 4.4v15.2" /></>)
export const IconoGuia = (): JSX.Element => svg(<><circle cx="12" cy="12" r="8.6" /><path d="M9.7 9.6a2.4 2.4 0 1 1 3.2 2.3c-.6.3-.9.8-.9 1.5v.3" /><path d="M12 17.1h.01" /></>)
export const IconoExportar = (): JSX.Element => svg(<><path d="M12 15.4V3.8" /><path d="m8.2 7.4 3.8-3.6 3.8 3.6" /><path d="M4.6 14.6v3.6a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-3.6" /></>)
export const IconoDictar = (): JSX.Element => svg(<><rect x="9" y="2.8" width="6" height="10.4" rx="3" /><path d="M5.2 11.2a6.8 6.8 0 0 0 13.6 0M12 18v3.2" /></>)

const Plegar = ({ abierta }: { abierta: boolean }): JSX.Element => svg(
  <>
    <rect x="3.4" y="4.4" width="17.2" height="15.2" rx="2" />
    <path d="M9.4 4.4v15.2" />
    <path d={abierta ? 'm15.6 9.6-2.4 2.4 2.4 2.4' : 'm13.2 9.6 2.4 2.4-2.4 2.4'} />
  </>
)

const Sol = (): JSX.Element => svg(
  <>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.4v2.2M12 19.4v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.4 12h2.2M19.4 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </>
)

const Luna = (): JSX.Element => svg(<path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a6.8 6.8 0 0 0 11.1 11.1Z" />)

/** Flecha saliendo. Cerrar sesion es salir, y se lee sin leer. */
const Salir = (): JSX.Element => svg(<><path d="M14.4 4.6H6.8a2 2 0 0 0-2 2v10.8a2 2 0 0 0 2 2h7.6" /><path d="M18.4 12H10" /><path d="m15.4 8.8 3.2 3.2-3.2 3.2" /></>)

// ------------------------------------------------------------------ semáforo

const NOMBRE: Record<ModelKey, string> = { whisper: 'Voz', embed: 'Deduplicación', gemma: 'Extracción' }
const ESTADO = { idle: 'en espera', loading: 'cargando', ready: 'listo', error: 'error' } as const
const CLAVES: ModelKey[] = ['whisper', 'embed', 'gemma']

/**
 * El semáforo del motor, en el pie de la barra.
 *
 * Aquí es donde tiene sentido: es estado de la aplicación entera, no de la
 * pantalla en la que estés, y en el pie no compite con el contenido. Estrecha
 * quedan solo los tres puntos; ancha, los puntos y cuántos faltan.
 */
function Semaforo({ status, timings, abierta }: { status: ModelStatus | null; timings: TimingTable; abierta: boolean }): JSX.Element {
  const listos = CLAVES.filter((k) => status?.[k].state === 'ready').length
  const detalle = CLAVES.map((k) => {
    const s = status?.[k]
    const est = s?.state ?? 'idle'
    return `${NOMBRE[k]}: ${est === 'ready' && s?.ms ? fmt(s.ms) : ESTADO[est]}`
  }).join(' · ')

  return (
    <div
      className="lat-semaforo"
      title={`Motor local · ${listos} de 3 listos · ${detalle}`}
      role="img"
      aria-label={`Motor local, ${listos} de 3 modelos listos. ${detalle}`}
    >
      <span className="dots">
        {CLAVES.map((k) => (
          <span key={k} className={`dot ${status?.[k].state ?? 'idle'}`} />
        ))}
      </span>
      {abierta && (
        <span className="lat-semaforo-txt">
          {listos === 3 ? 'Motor local listo' : `Motor local · ${listos}/3`}
          {listos === 3 && timings['load:all'] && (
            <span className="muted"> · {fmt(timings['load:all'].avgMs)}</span>
          )}
        </span>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ botón

function Fila({
  icono, label, onClick, actual = false, activa = false, disabled = false, nota, abierta, id
}: {
  icono: ReactNode
  label: string
  onClick: () => void
  actual?: boolean
  activa?: boolean
  disabled?: boolean
  nota?: string
  abierta: boolean
  id?: string
}): JSX.Element {
  // Estrecha, el nombre sigue existiendo para quien no ve el icono: va en
  // aria-label y en el título emergente. Plegar no puede costar accesibilidad.
  const titulo = nota ? `${label} · ${nota}` : label
  return (
    <button
      id={id}
      type="button"
      className={`lat-item${actual ? ' actual' : ''}${activa ? ' encendida' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      aria-label={label}
      aria-current={actual ? 'page' : undefined}
      aria-pressed={activa ? true : undefined}
    >
      <span className="lat-ico" aria-hidden="true">{icono}</span>
      {abierta && <span className="lat-txt">{label}</span>}
    </button>
  )
}

// ------------------------------------------------------------------ barra

const PUERTAS = [
  { id: 'capture' as const, label: 'Registrar equipos', icono: <IconoRegistrar /> },
  { id: 'follow' as const, label: 'Seguimiento y reportes', icono: <IconoReportes /> }
]

export function Sidebar({
  abierta, onPlegar, modo, onIr, onPreparar, acciones,
  theme, onTheme, status, timings, operator, onCambiarUsuario, onLogout
}: Props): JSX.Element {
  const [menu, setMenu] = useState(false)
  const caja = useRef<HTMLDivElement>(null)
  const claro = theme === 'blanco'

  useEffect(() => {
    if (!menu) return
    const fuera = (e: MouseEvent): void => {
      if (caja.current && !caja.current.contains(e.target as Node)) setMenu(false)
    }
    const esc = (e: KeyboardEvent): void => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('click', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('click', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [menu])

  return (
    <nav className={`lateral${abierta ? '' : ' estrecha'}`} aria-label="Navegación de la aplicación">
      <div className="lat-marca">
        <button
          type="button"
          className="lat-logo"
          onClick={() => onIr('home')}
          title="MAM · Medical Asset Management · ir al inicio"
          aria-label="MAM, Medical Asset Management. Ir al inicio"
        >
          {/* La barra es oscura en los DOS temas, asi que aqui siempre entra la
              pieza monocroma clara. En el panel entra la que toque por tema, y
              ahi esta el juego con las dos tonalidades del mismo logo. */}
          <LogoMark size="inline" theme="negro" label="" />
          {abierta && <span className="lat-nombre">MAM</span>}
        </button>
        <button
          type="button"
          className="icon-btn lat-plegar"
          onClick={onPlegar}
          aria-expanded={abierta}
          aria-label={abierta ? 'Estrechar la barra lateral' : 'Ensanchar la barra lateral'}
          title={abierta ? 'Estrechar la barra' : 'Ensanchar la barra'}
        >
          <Plegar abierta={abierta} />
        </button>
      </div>

      <div className="lat-grupo">
        {abierta && <p className="lat-titulo">Ir a</p>}
        <Fila
          id="nav-home"
          icono={<IconoInicio />}
          label="Inicio"
          onClick={() => onIr('home')}
          actual={modo === 'home'}
          abierta={abierta}
        />
        {PUERTAS.map((p) => (
          <div key={p.id} onMouseEnter={() => onPreparar(p.id)} onFocus={() => onPreparar(p.id)}>
            <Fila
              id={`nav-${p.id}`}
              icono={p.icono}
              label={p.label}
              onClick={() => onIr(p.id)}
              actual={modo === p.id}
              abierta={abierta}
            />
          </div>
        ))}
      </div>

      {acciones.length > 0 && (
        <div className="lat-grupo lat-acciones">
          {abierta && <p className="lat-titulo">En esta sección</p>}
          {acciones.map((a) => (
            <Fila
              key={a.id}
              id={`acc-${a.id}`}
              icono={a.icono}
              label={a.label}
              onClick={a.onClick}
              activa={a.activa}
              disabled={a.disabled}
              nota={a.nota}
              abierta={abierta}
            />
          ))}
        </div>
      )}

      <div className="lat-pie">
        <Semaforo status={status} timings={timings} abierta={abierta} />

        <Fila
          id="lat-tema"
          icono={claro ? <Sol /> : <Luna />}
          label={claro ? 'Tema claro' : 'Tema oscuro'}
          nota={claro ? 'cambiar a oscuro' : 'cambiar a claro'}
          onClick={() => onTheme(claro ? 'negro' : 'blanco')}
          abierta={abierta}
        />

        {/* Quien eres: informacion, y de paso el sitio para cambiar de usuario.
            Cerrar sesion NO vive aqui dentro: Josue no lo encontraba, y tenia
            razon, porque estaba escondido detras de un avatar que no parece un
            menu. Ahora es una fila propia, siempre a la vista. */}
        <div className="lat-usuario" ref={caja}>
          <button
            type="button"
            id="lat-quien"
            className="lat-item lat-quien"
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((o) => !o)}
            title={`${operator} · cambiar de usuario`}
            aria-label={`Sesión de ${operator}. Cambiar de usuario`}
          >
            <span className="lat-avatar" aria-hidden="true">{iniciales(operator)}</span>
            {abierta && <span className="lat-txt lat-nombre-usuario">{operator}</span>}
          </button>
          {menu && (
            <div className="menu-list lat-menu" role="menu">
              <span className="menu-quien">{operator}</span>
              <button type="button" role="menuitem" onClick={() => { setMenu(false); onCambiarUsuario() }}>
                Cambiar de usuario
              </button>
            </div>
          )}
        </div>

        <Fila
          id="lat-salir"
          icono={<Salir />}
          label="Cerrar sesión"
          onClick={onLogout}
          abierta={abierta}
        />
      </div>
    </nav>
  )
}

/** Dos letras para el avatar. Sin foto: no hay perfiles ni datos de nadie. */
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '··'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}
