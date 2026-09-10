// Guía de qué entiende la pregunta en español, equivalente a la guía de qué
// contar en la nota. Existe para que nadie escriba a ciegas: el modelo entiende
// un conjunto acotado de cosas, y decirlo por adelantado evita la consulta que
// no entra en parámetros y la sensación de que la aplicación falló.

import { useState, type JSX } from 'react'

interface Fila {
  que: string
  como: string
  ejemplo: string
}

const ENTIENDE: Fila[] = [
  { que: 'Lugar', como: 'País, ciudad u hospital. Puedes nombrar varios en la misma frase.', ejemplo: 'en Panamá, en San Francisco' },
  { que: 'Modalidad', como: 'Resonancia, tomografía, ecografía, rayos X, monitoreo, terapia guiada.', ejemplo: 'los ecógrafos' },
  { que: 'Marca', como: 'Cualquiera de las seis del catálogo.', ejemplo: 'equipos Orion Imaging' },
  { que: 'Edad', como: 'Con número manda el número. Sin número, "nuevos" es hasta 3 años y "viejos" 8 o más.', ejemplo: 'de más de siete años' },
  { que: 'Estatus', como: 'Confirmado, reportado, estimado o desconocido. Admite varios con "o".', ejemplo: 'reportados o estimados' },
  { que: 'Confianza', como: 'Alta, media o baja. Admite varias con "o".', ejemplo: 'confianza baja o media' },
  { que: 'Qué quieres', como: '"cuántos" da una cifra · "cuáles" o "dame" enumera · "cuál es el estatus de" o "qué marcas hay" desglosa.', ejemplo: 'cuántos hay' }
]

const NO_ENTIENDE = [
  'Comparar dos periodos o dos países entre sí ("cuál tiene más que…").',
  'Fechas de visita ("lo registrado la semana pasada").',
  'Preguntas de opinión o de recomendación ("cuál debería renovar primero").',
  'Cualquier dato que no esté en la base: precios, contratos, contactos.'
]

export function QueryGuide({ onUseExample }: { onUseExample: (q: string) => void }): JSX.Element {
  const [open, setOpen] = useState(false)
  const ejemplo = 'equipos de Panamá, en San Francisco, con confianza baja o media'

  return (
    <div className={`guide${open ? ' open' : ''}`}>
      <button type="button" className="guide-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="guide-chev" aria-hidden="true" />
        Cómo pedirlo
        <span className="muted">{open ? 'ocultar' : 'qué entiende y qué no'}</span>
      </button>

      {open && (
        <div className="guide-body">
          <p className="guide-foot">
            Puedes combinar todo lo de esta tabla en una sola frase. La aplicación te muestra qué
            entendió antes de darte cifras, y cada parte se puede quitar con un clic.
          </p>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Qué entiende la pregunta en español</caption>
              <thead>
                <tr>
                  <th scope="col">Puedes pedir</th>
                  <th scope="col">Cómo se dice</th>
                  <th scope="col">Ejemplo</th>
                </tr>
              </thead>
              <tbody>
                {ENTIENDE.map((f) => (
                  <tr key={f.que}>
                    <td><b>{f.que}</b></td>
                    <td>{f.como}</td>
                    <td className="muted">{f.ejemplo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="guide-foot">
            <b>Todavía no entiende:</b>
          </p>
          <ul className="guide-list">
            {NO_ENTIENDE.map((n) => <li key={n}><span>{n}</span></li>)}
          </ul>

          <p className="guide-foot">
            Una consulta completa se ve así:{' '}
            <button type="button" className="linkish" onClick={() => onUseExample(ejemplo)}>
              {ejemplo}
            </button>
          </p>
          <p className="guide-foot muted">
            Si algo no entra en parámetros no se inventa nada: la pantalla dice qué entendió y, si
            no hay filas, lo declara y ofrece quitar la condición más restrictiva.
          </p>
        </div>
      )}
    </div>
  )
}
