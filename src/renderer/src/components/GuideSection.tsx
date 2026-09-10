import { useEffect, useState, type JSX } from 'react'
import { GLOSSARY } from '../../../shared/glossary.ts'
import { internalPanelOn, toggleInternalPanel } from '../lib/flags.ts'
import { TIMING_HINT, TIMING_LABEL, fmt, type TimingKey, type TimingTable } from '../../../shared/timings.ts'

const GLOSSARY_ORDER: Array<keyof typeof GLOSSARY> = [
  'observaciones', 'clientes', 'equipos7', 'bajaConfianza',
  'evidencia', 'confianza', 'estado', 'cantidadAprox',
  'marcaDesconocida', 'clienteNuevo', 'edad', 'local'
]

const TIMING_ORDER: TimingKey[] = ['load:all', 'load:gemma', 'load:whisper', 'load:embed', 'transcribe', 'extract', 'dedup', 'save']

export function GuideSection({ timings }: { timings: TimingTable }): JSX.Element {
  const [tab, setTab] = useState<'glosario' | 'tiempos'>('glosario')
  const [open, setOpen] = useState(false)
  // Los tiempos son un panel interno, no parte del producto. Ctrl+Alt+T.
  const [internal, setInternal] = useState(internalPanelOn)
  const measured = TIMING_ORDER.filter((k) => timings[k])

  useEffect(() => {
    const key = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault()
        const next = toggleInternalPanel()
        setInternal(next)
        if (!next) setTab('glosario')
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  return (
    <section className="guide-section" aria-labelledby="guide-h">
      <div className="filters">
        <h2 id="guide-h">Guía{internal && ' y tiempos'}</h2>
        <button type="button" className="ghost small" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? 'Ocultar' : 'Abrir la guía de campos'}
        </button>
      </div>

      {!open && (
        <p className="empty">
          Qué significa cada campo del registro y qué se espera que contenga.
          {internal && measured.length > 0 && <> Panel interno de tiempos activo.</>}
        </p>
      )}

      {open && (
        <>
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'glosario'} className={tab === 'glosario' ? 'on' : ''} onClick={() => setTab('glosario')}>Qué significa cada campo</button>
            {internal && (
              <button type="button" role="tab" aria-selected={tab === 'tiempos'} className={tab === 'tiempos' ? 'on' : ''} onClick={() => setTab('tiempos')}>Cuánto tarda cada proceso · interno</button>
            )}
          </div>

          {tab === 'glosario' && (
            <dl className="glossary" role="tabpanel">
              {GLOSSARY_ORDER.map((k) => (
                <div key={k} className="glossary-item">
                  <dt>{GLOSSARY[k].term}</dt>
                  <dd>
                    {GLOSSARY[k].short}
                    {GLOSSARY[k].long && <span className="glossary-long">{GLOSSARY[k].long}</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {tab === 'tiempos' && (
            <div role="tabpanel">
              <p className="muted">
                Medido en esta computadora, no estimado. Los promedios se actualizan con cada uso y se conservan entre sesiones.
              </p>
              {measured.length === 0 ? (
                <p className="empty">Todavía no hay mediciones. Aparecerán al abrir la app y dictar la primera nota.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Proceso</th>
                        <th scope="col" className="num">Promedio</th>
                        <th scope="col" className="num">Más rápido</th>
                        <th scope="col" className="num">Más lento</th>
                        <th scope="col" className="num">Veces</th>
                        <th scope="col">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {measured.map((k) => {
                        const t = timings[k]!
                        return (
                          <tr key={k}>
                            <td>{TIMING_LABEL[k]}</td>
                            <td className="num"><b>{fmt(t.avgMs)}</b></td>
                            <td className="num">{fmt(t.minMs)}</td>
                            <td className="num">{fmt(t.maxMs)}</td>
                            <td className="num">{t.count}</td>
                            <td className="muted">{TIMING_HINT[k]}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="muted" style={{ marginTop: 12 }}>
                Los modelos quedan cargados mientras la aplicación esté abierta: solo el primer arranque paga la carga completa.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  )
}
