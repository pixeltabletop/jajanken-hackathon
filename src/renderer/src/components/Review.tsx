import { useEffect, useState, type JSX } from 'react'
import type { DedupResult, Equipment, Observation } from '../../../shared/types.ts'
import { COUNTRY_ES } from '../lib/labels.ts'
import { DuplicateAlert } from './DuplicateAlert.tsx'
import { EquipmentRow } from './EquipmentRow.tsx'
import { EvidenceHighlight } from './EvidenceHighlight.tsx'
import { FollowUp } from './FollowUp.tsx'

interface Props {
  draft: Observation | null
  extracting: boolean
  extractMs: number | null
  warnings: string[]
  dedup: DedupResult | null
  dedupLoading: boolean
  chosenCustomer: string | null
  onChooseCustomer: (name: string | null) => void
  onChange: (next: Observation) => void
  onSave: () => void
  onDiscard: () => void
  onCancelWait: () => void
}

function Waiting({ onCancel }: { onCancel: () => void }): JSX.Element {
  const [s, setS] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setS((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])
  const phase = s < 4 ? 'Leyendo la nota…' : s < 12 ? 'Identificando equipos…' : 'Buscando la evidencia de cada fila…'
  return (
    <div className="wait" role="status" aria-live="polite">
      <p>{phase} <span className="muted">Gemma 2B · local · sin red · {s} s</span></p>
      <div className="progress" aria-hidden="true" />
      <div className="skeleton" aria-hidden="true" />
      <div className="skeleton" aria-hidden="true" />
      {s >= 30 && (
        <p className="slow">Está tardando más de lo normal. <button type="button" className="ghost small" onClick={onCancel}>Cancelar</button></p>
      )}
    </div>
  )
}

export function Review(p: Props): JSX.Element {
  const d = p.draft
  const patchEq = (i: number, patch: Partial<Equipment>): void => {
    if (!d) return
    const equipment = d.equipment.map((e, j) => (j === i ? { ...e, ...patch } : e))
    p.onChange({ ...d, equipment })
  }
  const removeEq = (i: number): void => {
    if (!d) return
    p.onChange({ ...d, equipment: d.equipment.filter((_, j) => j !== i) })
  }
  const addEq = (): void => {
    if (!d) return
    const blank: Equipment = {
      modality: 'Other', quantity: 1, quantityIsEstimate: false, brand: null, model: null,
      approxAgeYears: null, ageQualitative: null, installYearEstimate: null,
      confidence: 'Low', status: 'Unknown', evidence: '', evidenceInvalid: true, notes: 'Añadido a mano por el técnico'
    }
    p.onChange({ ...d, equipment: [...d.equipment, blank] })
  }

  return (
    <section aria-labelledby="rev-h">
      <h2 id="rev-h">2 · Resultado para confirmar</h2>

      {p.extracting && !d && <Waiting onCancel={p.onCancelWait} />}

      {!p.extracting && !d && <p className="empty">El resultado local aparecerá aquí, con cada dato apuntando a la frase de la nota que lo justifica.</p>}

      {d && (
        <>
          <EvidenceHighlight rawText={d.rawText} quotes={d.equipment.map((e) => ({ text: e.evidence, invalid: e.evidenceInvalid }))} />

          <div className="review-head">
            <label htmlFor="rv-f">Cliente / sitio
              <input id="rv-f" value={d.facility} onChange={(e) => p.onChange({ ...d, facility: e.target.value })} />
            </label>
            <label htmlFor="rv-c">Ciudad
              <input id="rv-c" value={d.city ?? ''} placeholder="—" onChange={(e) => p.onChange({ ...d, city: e.target.value.trim() || null })} />
            </label>
            <label htmlFor="rv-p">País
              <select id="rv-p" value={d.country ?? ''} onChange={(e) => p.onChange({ ...d, country: e.target.value || null })}>
                <option value="">—</option>
                {Object.entries(COUNTRY_ES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>

          <div className="eq-list">
            {d.equipment.map((eq, i) => (
              <EquipmentRow key={i} index={i} eq={eq} onChange={(patch) => patchEq(i, patch)} onRemove={() => removeEq(i)} />
            ))}
          </div>
          <div>
            <button type="button" className="ghost small" onClick={addEq}>+ Añadir equipo que el modelo no vio</button>
          </div>

          <FollowUp missingFields={d.missingFields} />
          <DuplicateAlert result={p.dedup} loading={p.dedupLoading} chosen={p.chosenCustomer} facility={d.facility} onChoose={p.onChooseCustomer} />

          {p.warnings.length > 0 && (
            <aside role="note"><b>Avisos del extractor:</b> {p.warnings.join(' · ')}</aside>
          )}

          <p className="muted">
            {p.extractMs !== null && `Extraído en ${(p.extractMs / 1000).toFixed(1)} s. `}
            {d.equipment.length} equipo{d.equipment.length !== 1 ? 's' : ''} · idioma {d.language === 'es' ? 'español' : 'inglés'} · fuente {d.source === 'Voice' ? 'voz' : 'texto'}
          </p>
          <div>
            <button type="button" onClick={p.onSave} disabled={d.equipment.length === 0 || p.dedupLoading}>Confirmar y guardar localmente</button>
            <button type="button" className="ghost" onClick={p.onDiscard}>Descartar</button>
          </div>
        </>
      )}
    </section>
  )
}
