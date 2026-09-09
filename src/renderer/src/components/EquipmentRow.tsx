import type { JSX } from 'react'
import type { Equipment } from '../../../shared/types.ts'
import {
  BRANDS,
  CONFIDENCE,
  CONFIDENCE_LABEL_ES,
  MODALITIES,
  MODALITY_LABEL_ES,
  STATUSES,
  STATUS_LABEL_ES
} from '../../../shared/catalog.ts'

interface Props {
  index: number
  eq: Equipment
  onChange: (patch: Partial<Equipment>) => void
  onRemove: () => void
}

const badgeClass = (c: Equipment['confidence']): string => `badge ${c.toLowerCase()}`

export function EquipmentRow({ index, eq, onChange, onRemove }: Props): JSX.Element {
  const id = (f: string): string => `eq-${index}-${f}`
  const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v))
  return (
    <div className={`eq-row${eq.evidenceInvalid ? ' invalid' : ''}`}>
      <div className="eq-row-top">
        <strong>Equipo {index + 1} · {MODALITY_LABEL_ES[eq.modality]}</strong>
        <span>
          <span className={badgeClass(eq.confidence)}>{CONFIDENCE_LABEL_ES[eq.confidence]}</span>{' '}
          <span className="badge neutral">{STATUS_LABEL_ES[eq.status]}</span>{' '}
          <button type="button" className="danger small" onClick={onRemove} aria-label={`Quitar equipo ${index + 1}`}>Quitar</button>
        </span>
      </div>
      <div className="eq-grid">
        <label htmlFor={id('m')}>Modalidad
          <select id={id('m')} value={eq.modality} onChange={(e) => onChange({ modality: e.target.value as Equipment['modality'] })}>
            {MODALITIES.map((m) => <option key={m} value={m}>{MODALITY_LABEL_ES[m]}</option>)}
          </select>
        </label>
        <label htmlFor={id('q')}>Cantidad
          <input id={id('q')} type="number" min={1} value={eq.quantity} onChange={(e) => onChange({ quantity: Math.max(1, Number(e.target.value) || 1) })} />
        </label>
        <label className="check" htmlFor={id('e')}>
          <input id={id('e')} type="checkbox" checked={eq.quantityIsEstimate} onChange={(e) => onChange({ quantityIsEstimate: e.target.checked })} />
          Cantidad aproximada
        </label>
        <label htmlFor={id('b')}>Marca
          <select id={id('b')} value={eq.brand ?? ''} onChange={(e) => onChange({ brand: (e.target.value || null) as Equipment['brand'] })}>
            <option value="">Desconocida</option>
            {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label htmlFor={id('mo')}>Modelo
          <input id={id('mo')} value={eq.model ?? ''} placeholder="No visible" onChange={(e) => onChange({ model: e.target.value.trim() || null })} />
        </label>
        <label htmlFor={id('a')}>Edad aprox. (años)
          <input id={id('a')} type="number" min={0} value={eq.approxAgeYears ?? ''} placeholder={eq.ageQualitative ?? '—'} onChange={(e) => {
            const a = numOrNull(e.target.value)
            onChange({ approxAgeYears: a, installYearEstimate: a === null ? null : new Date().getFullYear() - a })
          }} />
        </label>
        <label htmlFor={id('c')}>Confianza
          <select id={id('c')} value={eq.confidence} onChange={(e) => onChange({ confidence: e.target.value as Equipment['confidence'] })}>
            {CONFIDENCE.map((c) => <option key={c} value={c}>{CONFIDENCE_LABEL_ES[c]}</option>)}
          </select>
        </label>
        <label htmlFor={id('s')}>Estado
          <select id={id('s')} value={eq.status} onChange={(e) => onChange({ status: e.target.value as Equipment['status'] })}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL_ES[s]}</option>)}
          </select>
        </label>
      </div>
      <p className="eq-quote">
        Evidencia: <q>{eq.evidence || '—'}</q>
        {eq.evidenceInvalid && <strong> · esta cita no aparece en la nota</strong>}
      </p>
    </div>
  )
}
