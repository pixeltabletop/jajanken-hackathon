import type { JSX } from 'react'
import type { DedupResult, Equipment, Observation } from '../../../shared/types.ts'
import { fmt, type TimingTable } from '../../../shared/timings.ts'
import { DuplicateAlert } from './DuplicateAlert.tsx'
import { EquipmentRow } from './EquipmentRow.tsx'
import { EvidenceHighlight } from './EvidenceHighlight.tsx'
import { FollowUp } from './FollowUp.tsx'
import { HistoryPanel } from './HistoryPanel.tsx'
import { HelpTip } from './HelpTip.tsx'
import { LocationFields } from './LocationFields.tsx'
import { Progress } from './Progress.tsx'

interface Props {
  draft: Observation | null
  editing: boolean
  extracting: boolean
  extractMs: number | null
  warnings: string[]
  dedup: DedupResult | null
  dedupLoading: boolean
  chosenCustomer: string | null
  citiesByCountry: Record<string, string[]>
  timings: TimingTable
  onChooseCustomer: (name: string | null) => void
  onChange: (next: Observation) => void
  onSave: () => void
  onDiscard: () => void
  onCancelWait: () => void
}

export function Review(p: Props): JSX.Element {
  const d = p.draft
  const patchEq = (i: number, patch: Partial<Equipment>): void => {
    if (!d) return
    p.onChange({ ...d, equipment: d.equipment.map((e, j) => (j === i ? { ...e, ...patch } : e)) })
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
      <h2 id="rev-h">
        2 · {p.editing ? 'Editar registro guardado' : 'Resultado para confirmar'}
        <HelpTip termKey="evidencia" />
      </h2>

      {p.extracting && !d && (
        <Progress
          expectedMs={p.timings.extract?.avgMs ?? null}
          phases={[
            { label: 'Leyendo la nota', until: 0.18 },
            { label: 'Identificando equipos y cantidades', until: 0.62 },
            { label: 'Buscando la cita que justifica cada fila', until: 0.9 },
            { label: 'Comprobando la evidencia contra el texto', until: 1 }
          ]}
          note="Gemma 2B · en esta computadora · sin red"
          onCancel={p.onCancelWait}
        />
      )}

      {!p.extracting && !d && (
        <p className="empty">
          El resultado local aparecerá aquí, con cada dato apuntando a la frase de la nota que lo justifica.
          También puedes abrir cualquier registro de la tabla de abajo para corregirlo.
        </p>
      )}

      {d && (
        <>
          {p.editing && (
            <div className="edit-banner" role="note">
              Editando una observación ya guardada del <b>{d.createdAt}</b>. Los cambios reemplazan el registro anterior.
            </div>
          )}

          <EvidenceHighlight rawText={d.rawText} quotes={d.equipment.map((e) => ({ text: e.evidence, invalid: e.evidenceInvalid }))} />

          <div className="review-head">
            <label htmlFor="rv-f">Cliente / sitio
              <input id="rv-f" value={d.facility} onChange={(e) => p.onChange({ ...d, facility: e.target.value })} />
            </label>
            <LocationFields
              country={d.country}
              city={d.city}
              citiesByCountry={p.citiesByCountry}
              onCountry={(country) => p.onChange({ ...d, country })}
              onCity={(city) => p.onChange({ ...d, city })}
            />
            <label htmlFor="rv-o">Observador
              <input id="rv-o" value={d.observer} onChange={(e) => p.onChange({ ...d, observer: e.target.value })} />
            </label>
            <label htmlFor="rv-d">Fecha de visita
              <input id="rv-d" type="date" value={d.createdAt.slice(0, 10)} onChange={(e) => {
                const createdAt = e.target.value || d.createdAt
                const year = Number(createdAt.slice(0, 4))
                p.onChange({ ...d, createdAt, equipment: d.equipment.map((e2) => ({ ...e2, installYearEstimate: e2.approxAgeYears !== null ? year - e2.approxAgeYears : null })) })
              }} />
            </label>
          </div>

          <div className="eq-list">
            {d.equipment.map((eq, i) => (
              <EquipmentRow key={i} index={i} eq={eq} onChange={(patch) => patchEq(i, patch)} onRemove={() => removeEq(i)} />
            ))}
          </div>
          <div className="actions">
            <button type="button" className="ghost small" onClick={addEq}>+ Añadir un equipo que falte</button>
          </div>

          <FollowUp missingFields={d.missingFields} />
          {d.missingFields.length > 0 && (
            <label className="followup-answer" htmlFor="rv-fa">Respuesta del técnico a esa pregunta
              <input id="rv-fa" value={d.followUpAnswer ?? ''} placeholder="Lo que contestó, tal cual" onChange={(e) => p.onChange({ ...d, followUpAnswer: e.target.value.trim() || null })} />
            </label>
          )}
          <DuplicateAlert result={p.dedup} loading={p.dedupLoading} chosen={p.chosenCustomer} facility={d.facility} onChoose={p.onChooseCustomer} />

          {p.editing && <HistoryPanel obs={d} />}

          {p.warnings.length > 0 && <aside role="note"><b>Avisos del extractor:</b> {p.warnings.join(' · ')}</aside>}

          <p className="muted">
            {p.extractMs !== null && !p.editing && `Interpretado en ${fmt(p.extractMs)}. `}
            {d.equipment.length} equipo{d.equipment.length !== 1 ? 's' : ''} · idioma {d.language === 'es' ? 'español' : 'inglés'} · fuente {d.source === 'Voice' ? 'voz' : d.source === 'Seed' ? 'semilla' : 'texto'}
          </p>
          <div className="actions">
            <button type="button" className="primary" onClick={p.onSave} disabled={d.equipment.length === 0 || p.dedupLoading}>
              {p.editing ? 'Guardar cambios' : 'Confirmar y guardar localmente'}
            </button>
            <button type="button" className="ghost" onClick={p.onDiscard}>{p.editing ? 'Cancelar edición' : 'Descartar'}</button>
          </div>
        </>
      )}
    </section>
  )
}
