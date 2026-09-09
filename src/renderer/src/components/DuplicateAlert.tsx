import type { JSX } from 'react'
import type { DedupResult } from '../../../shared/types.ts'
import { countryLabel, pct } from '../lib/labels.ts'

interface Props {
  result: DedupResult | null
  loading: boolean
  chosen: string | null // nombre canónico elegido; null = cliente nuevo
  facility: string
  onChoose: (name: string | null) => void
}

// Ranking más desempate por ciudad, nunca umbral: los dos hospitales homónimos
// del dataset tienen similitud 0.912 entre sí. El usuario siempre ve los tres
// candidatos y decide.
export function DuplicateAlert({ result, loading, chosen, facility, onChoose }: Props): JSX.Element | null {
  if (loading) return <aside className="dup" role="status">Buscando este cliente en la base local…</aside>
  if (!result) return null
  if (result.candidates.length === 0) return null
  return (
    <aside className="dup" role="region" aria-label="Posibles coincidencias de cliente">
      <b>¿Es alguno de estos clientes?</b> <span className="muted">{result.reason}</span>
      <div className="dup-list">
        {result.candidates.map((c) => (
          <div key={c.name} className={`dup-item${chosen === c.name ? ' chosen' : ''}`}>
            <div>
              {c.name}
              <small>{[c.city, countryLabel(c.country)].filter(Boolean).join(', ')}{c.sameCity ? ' · misma ciudad' : ''}</small>
            </div>
            <span className="dup-score" aria-label="similitud">{pct(c.score)}</span>
            <button type="button" className={chosen === c.name ? 'small' : 'ghost small'} onClick={() => onChoose(c.name)}>
              {chosen === c.name ? 'Elegido' : 'Es este'}
            </button>
          </div>
        ))}
        <div className={`dup-item${chosen === null ? ' chosen' : ''}`}>
          <div>Cliente nuevo<small>Se registra como “{facility}”</small></div>
          <span />
          <button type="button" className={chosen === null ? 'small' : 'ghost small'} onClick={() => onChoose(null)}>
            {chosen === null ? 'Elegido' : 'Es nuevo'}
          </button>
        </div>
      </div>
    </aside>
  )
}
