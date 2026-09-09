import { useId, type JSX } from 'react'
import { COUNTRY_ES } from '../lib/labels.ts'

// País cerrado, ciudad abierta. El país sale de una lista fija porque inventar
// países corrompe los agregados del tablero. La ciudad se elige de las ya
// registradas en ese país o se escribe libre; al guardar, la ciudad nueva pasa
// a estar disponible para el siguiente técnico sin tocar código.

interface Props {
  country: string | null
  city: string | null
  citiesByCountry: Record<string, string[]>
  onCountry: (c: string | null) => void
  onCity: (c: string | null) => void
}

export function LocationFields({ country, city, citiesByCountry, onCountry, onCity }: Props): JSX.Element {
  const listId = useId()
  const cities = country ? (citiesByCountry[country] ?? []) : [...new Set(Object.values(citiesByCountry).flat())].sort()
  const isNew = !!city && !cities.some((c) => c.toLowerCase() === city.toLowerCase())

  return (
    <>
      <label htmlFor="rv-p">País
        <select
          id="rv-p"
          value={country ?? ''}
          onChange={(e) => {
            const next = e.target.value || null
            onCountry(next)
            // Si la ciudad no pertenece al país nuevo, se limpia en vez de quedar inconsistente.
            if (next && city && !(citiesByCountry[next] ?? []).some((c) => c.toLowerCase() === city.toLowerCase())) onCity(null)
          }}
        >
          <option value="">Selecciona un país</option>
          {Object.entries(COUNTRY_ES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>

      <label htmlFor="rv-c">
        Ciudad {isNew && <span className="tag-new">nueva</span>}
        <input
          id="rv-c"
          list={listId}
          value={city ?? ''}
          placeholder={country ? (cities.length ? 'Elige o escribe una' : 'Escribe la ciudad') : 'Elige el país primero'}
          autoComplete="off"
          onChange={(e) => onCity(e.target.value.trim() || null)}
        />
        <datalist id={listId}>
          {cities.map((c) => <option key={c} value={c} />)}
        </datalist>
      </label>
    </>
  )
}
