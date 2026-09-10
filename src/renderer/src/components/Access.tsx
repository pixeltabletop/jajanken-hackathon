// Pantalla de acceso.
//
// HONESTA A PROPÓSITO: en esta versión no hay autenticación. El campo de
// contraseña está deshabilitado y lo dice en pantalla, para que quede claro que
// la casilla es el sitio que ocupará el día que la haya, no un control que
// valide algo hoy. No se guarda ninguna contraseña, no se envía nada a ningún
// sitio y no hay usuarios ni sesión.
//
// Lo que sí es real es el nombre: alimenta el campo "Observador" de cada
// registro y el "Solicitado por" de los reportes, que hasta ahora había que
// escribir a mano en dos sitios distintos.

import { useState, type JSX } from 'react'
import { LogoMark } from './LogoMotion.tsx'

interface Props {
  /** Nombre guardado en settings.json, si ya entró alguna vez. */
  initialName: string
  onEnter: (name: string) => void
  observations: number
}

export function Access({ initialName, onEnter, observations }: Props): JSX.Element {
  const [name, setName] = useState(initialName)
  const limpio = name.trim()

  function submit(e: React.FormEvent): void {
    e.preventDefault()
    onEnter(limpio || 'Técnico de campo')
  }

  return (
    <section className="access" aria-labelledby="acc-h">
      <form className="access-card" onSubmit={submit}>
        <LogoMark size="mark" label="Eco" />
        <h1 id="acc-h">Eco</h1>
        <p className="access-sub">Inteligencia de base instalada · 100 % local, sin nube</p>

        <label className="access-field" htmlFor="acc-user">
          Tu nombre
          <input
            id="acc-user"
            type="text"
            value={name}
            autoFocus
            placeholder="Como quieres que aparezca en los registros"
            onChange={(e) => setName(e.target.value)}
          />
          <span className="access-hint muted">
            Queda como observador de cada registro y como solicitante de cada reporte.
          </span>
        </label>

        <label className="access-field" htmlFor="acc-pass">
          Contraseña
          <input id="acc-pass" type="password" disabled placeholder="—" autoComplete="off" />
          <span className="access-hint muted">
            Deshabilitada. Esta versión no valida credenciales todavía.
          </span>
        </label>

        <button type="submit" className="primary access-go">Entrar</button>

        <p className="access-modo" role="note">
          <b>Modo prueba.</b> No hay usuarios ni sesión: cualquiera que abra la aplicación entra.
          La casilla de contraseña está para enseñar dónde irá el control de acceso cuando exista,
          no para pedirlo hoy. Nada de lo que escribas aquí sale de esta computadora.
        </p>
        <p className="access-base muted">{observations} observaciones guardadas en este equipo</p>
      </form>

      <footer className="access-legal">
        <b>Prototipo del equipo Jajanken para el reto Philips</b> · Hackathon ISD Summit 2026 ·
        No es un producto oficial de Philips. Datos sintéticos.
      </footer>
    </section>
  )
}
