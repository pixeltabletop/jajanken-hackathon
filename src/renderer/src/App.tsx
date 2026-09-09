import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import './assets/components.css'
import type { DedupResult, ModelStatus, Observation, QueryFilter } from '../../shared/types.ts'
import { WavRecorder } from './audio/wav-recorder.ts'
import { Capture } from './components/Capture.tsx'
import { Dashboard } from './components/Dashboard.tsx'
import { Footer } from './components/Footer.tsx'
import { Header } from './components/Header.tsx'
import { Review } from './components/Review.tsx'
import { Stats } from './components/Stats.tsx'
import { call } from './lib/api.ts'
import { applyFilter, EMPTY_FILTER, flatten } from './lib/filter.ts'
import { VOICE_ENABLED } from './lib/flags.ts'
import { detectLanguage } from './lib/labels.ts'

const MSG_LOADING = 'Cargando los modelos locales… la primera vez tarda hasta un minuto.'
const MSG_READY = 'Listo · QVAC local · sin nube'

export default function App(): JSX.Element {
  const [observations, setObservations] = useState<Observation[]>([])
  const [status, setStatus] = useState<ModelStatus | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Observation | null>(null)
  const [extractMs, setExtractMs] = useState<number | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [dedup, setDedup] = useState<DedupResult | null>(null)
  const [dedupLoading, setDedupLoading] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [message, setMessage] = useState(MSG_LOADING)
  const [filter, setFilter] = useState<QueryFilter>(EMPTY_FILTER)

  const recorder = useRef(new WavRecorder())
  const textFromVoice = useRef(false)
  const cancelled = useRef(false)

  const hasApi = typeof window !== 'undefined' && !!window.api
  const allReady = !!status && status.gemma.state === 'ready' && status.whisper.state === 'ready' && status.embed.state === 'ready'

  // Observaciones al montar.
  useEffect(() => {
    if (!hasApi) return
    call(window.api.list()).then(setObservations).catch((e: Error) => setMessage(e.message))
  }, [hasApi])

  // Estado de modelos: cada 2 s hasta que los tres estén listos, luego cada 15 s.
  useEffect(() => {
    if (!hasApi) return
    let alive = true
    const tick = async (): Promise<void> => {
      try {
        const s = await call(window.api.modelsStatus())
        if (alive) setStatus(s)
      } catch { /* el siguiente tick reintenta */ }
    }
    void tick()
    const id = setInterval(tick, allReady ? 15000 : 2000)
    return () => { alive = false; clearInterval(id) }
  }, [hasApi, allReady])

  useEffect(() => {
    if (allReady) setMessage((m) => (m === MSG_LOADING ? MSG_READY : m))
  }, [allReady])

  // Cronómetro de grabación.
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setSeconds(recorder.current.seconds), 250)
    return () => clearInterval(id)
  }, [recording])

  const rows = useMemo(() => applyFilter(flatten(observations), filter), [observations, filter])

  const onText = useCallback((t: string) => { textFromVoice.current = false; setText(t) }, [])

  const fail = (e: unknown): void => setMessage(e instanceof Error ? e.message : String(e))

  async function onExtract(): Promise<void> {
    if (!text.trim()) return
    cancelled.current = false
    setBusy(true); setDraft(null); setDedup(null); setChosen(null); setWarnings([])
    setMessage('Interpretando la nota con Gemma 2B, en esta laptop…')
    try {
      const r = await call(window.api.extract(text, detectLanguage(text), textFromVoice.current ? 'Voice' : 'Text'))
      if (cancelled.current) return
      setDraft(r.observation); setExtractMs(r.ms); setWarnings(r.warnings)
      setMessage(`Extraído en ${(r.ms / 1000).toFixed(1)} s. Revisa cada fila y confirma.`)
      setDedupLoading(true)
      try {
        const d = await call(window.api.dedup(r.observation.facility, r.observation.city))
        if (cancelled.current) return
        setDedup(d); setChosen(d.suggestion)
      } catch (e) { fail(e) } finally { setDedupLoading(false) }
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  function onCancelWait(): void {
    cancelled.current = true
    setBusy(false)
    setMessage('Cancelado en pantalla. El modelo termina en segundo plano y el resultado se descarta.')
  }

  async function onSave(): Promise<void> {
    if (!draft) return
    const canonical = chosen ?? draft.facility
    const match = dedup?.candidates.find((c) => c.name === canonical)
    const obs: Observation = {
      ...draft,
      facilityCanonical: canonical,
      city: draft.city ?? match?.city ?? null,
      country: draft.country ?? match?.country ?? null,
      reviewed: true
    }
    setBusy(true)
    try {
      const all = await call(window.api.save(obs))
      setObservations(all); setDraft(null); setDedup(null); setChosen(null); setText('')
      textFromVoice.current = false
      setMessage(`Guardado en esta laptop. ${obs.equipment.length} equipo${obs.equipment.length !== 1 ? 's' : ''} en ${canonical}.`)
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  function onDiscard(): void {
    setDraft(null); setDedup(null); setChosen(null)
    setMessage('Resultado descartado. La nota sigue en el cuadro por si quieres editarla.')
  }

  async function onRecord(): Promise<void> {
    try {
      await recorder.current.start()
      setRecording(true); setSeconds(0)
      setMessage('Grabando… habla con naturalidad y pulsa Detener al terminar.')
    } catch (e) {
      setMessage(e instanceof Error && /denied|permission/i.test(e.message) ? 'Debes permitir el acceso al micrófono.' : `No se pudo iniciar el micrófono: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function onStop(): Promise<void> {
    setBusy(true)
    try {
      const wav = await recorder.current.stop()
      setRecording(false)
      setMessage(`Whisper está transcribiendo ${seconds.toFixed(0)} s de audio, localmente…`)
      const t = await call(window.api.transcribe(wav))
      setText(t.text); textFromVoice.current = true
      setMessage(`Transcrito en ${(t.ms / 1000).toFixed(1)} s. Corrige el texto si hace falta y pulsa Interpretar.`)
    } catch (e) { setRecording(false); fail(e) } finally { setBusy(false) }
  }

  if (!hasApi) {
    return (
      <main>
        <Header status={null} />
        <section><p className="empty">Esta interfaz solo funciona dentro de la aplicación FieldLens, porque los modelos corren en el proceso principal de Electron. Ábrela con <code>npm run dev</code> o desde el instalador.</p></section>
      </main>
    )
  }

  return (
    <main>
      <Header status={status} />
      <Stats rows={rows} total={observations.length} />
      <div className="grid">
        <Capture
          text={text} onText={onText} busy={busy} recording={recording} seconds={seconds}
          voiceEnabled={VOICE_ENABLED} modelsReady={allReady}
          onRecord={onRecord} onStop={onStop} onExtract={onExtract} message={message}
        />
        <Review
          draft={draft} extracting={busy && !draft && !recording} extractMs={extractMs} warnings={warnings}
          dedup={dedup} dedupLoading={dedupLoading} chosenCustomer={chosen} onChooseCustomer={setChosen}
          onChange={setDraft} onSave={onSave} onDiscard={onDiscard} onCancelWait={onCancelWait}
        />
      </div>
      <Dashboard observations={observations} filter={filter} onFilter={setFilter} />
      <Footer />
    </main>
  )
}
