import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import './assets/components.css'
import { DEFAULT_COLUMNS, type ColumnKey } from '../../shared/columns.ts'
import type { TimingTable } from '../../shared/timings.ts'
import type { TranscriptFix } from '../../shared/transcript.ts'
import type { DedupResult, ModelStatus, Observation, QueryFilter } from '../../shared/types.ts'
import { DEFAULT_THEME, isThemeId, type ThemeId } from './assets/themes.ts'
import { WavRecorder } from './audio/wav-recorder.ts'
import { Capture } from './components/Capture.tsx'
import { Dashboard } from './components/Dashboard.tsx'
import { FollowUpMode } from './components/FollowUpMode.tsx'
import { Footer } from './components/Footer.tsx'
import { GuideSection } from './components/GuideSection.tsx'
import { Header } from './components/Header.tsx'
import { Home } from './components/Home.tsx'
import { ReportsSection } from './components/ReportsSection.tsx'
import { Review } from './components/Review.tsx'
import { Splash } from './components/Splash.tsx'
import { Stats } from './components/Stats.tsx'
import { ThemeFirstRun } from './components/ThemePicker.tsx'
import { call } from './lib/api.ts'
import { applyFilter, EMPTY_FILTER, flatten } from './lib/filter.ts'
import { VOICE_ENABLED } from './lib/flags.ts'
import { detectLanguage } from './lib/labels.ts'
import { setTheme, useThemeId } from './lib/theme.ts'
import { announce, transitionTo } from './lib/transition.ts'

const MSG_LOADING = 'Cargando los modelos locales… la primera vez tarda hasta un minuto.'
const MSG_READY = 'Listo. Dicta o escribe una observación de campo.'

type Mode = 'home' | 'capture' | 'follow'

const MODE_LABEL: Record<Mode, string> = {
  home: 'Inicio',
  capture: 'Registrar equipos',
  follow: 'Seguimiento y reportes'
}

export default function App(): JSX.Element {
  const [observations, setObservations] = useState<Observation[]>([])
  const [status, setStatus] = useState<ModelStatus | null>(null)
  const [timings, setTimings] = useState<TimingTable>({})
  const [cities, setCities] = useState<Record<string, string[]>>({})
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [draft, setDraft] = useState<Observation | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [extractMs, setExtractMs] = useState<number | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [fixes, setFixes] = useState<TranscriptFix[]>([])
  const [dedup, setDedup] = useState<DedupResult | null>(null)
  const [dedupLoading, setDedupLoading] = useState(false)
  const [chosen, setChosen] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [message, setMessage] = useState(MSG_LOADING)
  const [filter, setFilter] = useState<QueryFilter>(EMPTY_FILTER)
  const [columns, setColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS)
  const [operator, setOperator] = useState('Técnico de campo')

  // Bloque 4B: arranque de marca, elección de tema y dos puertas.
  const [booting, setBooting] = useState(true)
  const [askTheme, setAskTheme] = useState(false)
  const [mode, setMode] = useState<Mode>('home')
  /** Registrar abre sin lista. La tabla solo aparece si se pide. */
  const [showBase, setShowBase] = useState(false)
  const theme = useThemeId()

  const recorder = useRef(new WavRecorder())
  const textFromVoice = useRef(false)
  const cancelled = useRef(false)

  const hasApi = typeof window !== 'undefined' && !!window.api
  const allReady = !!status && status.gemma.state === 'ready' && status.whisper.state === 'ready' && status.embed.state === 'ready'
  // La pregunta en español solo necesita a Gemma. Guardar un cliente nuevo
  // recarga Whisper, y eso no tiene por qué bloquear el modo Seguimiento.
  const gemmaReady = status?.gemma.state === 'ready'

  const refreshTimings = useCallback(() => {
    if (!hasApi) return
    call(window.api.timings()).then(setTimings).catch(() => undefined)
  }, [hasApi])

  const refreshCities = useCallback(() => {
    if (!hasApi) return
    call(window.api.cities()).then(setCities).catch(() => undefined)
  }, [hasApi])

  const refreshList = useCallback(() => {
    if (!hasApi) return
    call(window.api.list()).then(setObservations).catch(() => undefined)
  }, [hasApi])

  useEffect(() => {
    if (!hasApi) return
    call(window.api.list()).then(setObservations).catch((e: Error) => setMessage(e.message))
    call(window.api.settingsGet())
      .then((s) => {
        setOperator(s.operator)
        if (isThemeId(s.theme)) setTheme(s.theme)
        else { setTheme(DEFAULT_THEME); setAskTheme(true) }
      })
      .catch(() => setTheme(DEFAULT_THEME))
    refreshTimings()
    refreshCities()
  }, [hasApi, refreshTimings, refreshCities])

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
    if (!allReady) return
    setMessage((m) => (m === MSG_LOADING ? MSG_READY : m))
    refreshTimings()
  }, [allReady, refreshTimings])

  // Cronómetro y nivel del micrófono mientras se graba.
  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => {
      setSeconds(recorder.current.seconds)
      setLevel(recorder.current.level)
    }, 80)
    return () => clearInterval(id)
  }, [recording])

  const rows = useMemo(() => applyFilter(flatten(observations), filter), [observations, filter])

  const onText = useCallback((t: string) => { textFromVoice.current = false; setFixes([]); setText(t) }, [])

  const onOperator = useCallback((o: string) => {
    setOperator(o)
    if (hasApi) void call(window.api.settingsSet({ operator: o })).catch(() => undefined)
  }, [hasApi])

  const onTheme = useCallback((t: ThemeId) => {
    setTheme(t)
    if (hasApi) void call(window.api.settingsSet({ theme: t })).catch(() => undefined)
  }, [hasApi])

  const fail = (e: unknown): void => setMessage(e instanceof Error ? e.message : String(e))

  function resetDraft(): void {
    setDraft(null); setDedup(null); setChosen(null); setEditingId(null); setWarnings([])
  }

  // --- navegación entre las dos puertas -------------------------------------

  const hasUnsaved = draft !== null || text.trim().length > 0

  const go = useCallback((next: Mode): void => {
    transitionTo(
      () => {
        setMode(next)
        if (next === 'capture') setShowBase(false)
      },
      next === 'home' ? 'door-capture' : next === 'follow' ? 'q-input' : 'note'
    )
    announce(`Modo ${MODE_LABEL[next]}`)
  }, [])

  const goHome = useCallback((): void => {
    if (mode === 'capture' && hasUnsaved) {
      const ok = window.confirm(
        'Tienes una observación sin guardar. Si vuelves al inicio se descarta.\n\n¿Volver al inicio de todos modos?'
      )
      if (!ok) return
      resetDraft(); setText(''); setFixes([]); textFromVoice.current = false
    }
    go('home')
  }, [mode, hasUnsaved, go])

  /** Precarga al enfocar una tarjeta: al hacer clic ya está listo. */
  const prepare = useCallback((m: 'capture' | 'follow'): void => {
    if (m === 'follow') refreshList()
    else refreshCities()
  }, [refreshList, refreshCities])

  // --- ciclo de registro ----------------------------------------------------

  async function onExtract(): Promise<void> {
    if (!text.trim()) return
    cancelled.current = false
    setBusy(true); resetDraft()
    setMessage('Interpretando la nota con Gemma 2B, en esta computadora…')
    try {
      const r = await call(window.api.extract(text, detectLanguage(text), textFromVoice.current ? 'Voice' : 'Text'))
      if (cancelled.current) return
      setDraft(r.observation); setExtractMs(r.ms); setWarnings(r.warnings)
      refreshTimings()
      setMessage('Revisa cada fila y confirma. Cada dato apunta a las palabras que lo justifican.')
      setDedupLoading(true)
      try {
        const d = await call(window.api.dedup(r.observation.facility, r.observation.city))
        if (cancelled.current) return
        setDedup(d); setChosen(d.suggestion)
      } catch (e) { fail(e) } finally { setDedupLoading(false); refreshTimings() }
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  function onCancelWait(): void {
    cancelled.current = true
    setBusy(false)
    setMessage('Dejaste de esperar. El modelo termina en segundo plano y el resultado se descarta.')
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
    const wasEditing = editingId !== null
    setBusy(true)
    try {
      const all = await call(window.api.save(obs))
      setObservations(all)
      resetDraft()
      if (!wasEditing) { setText(''); textFromVoice.current = false; setFixes([]) }
      refreshCities(); refreshTimings()
      setMessage(wasEditing
        ? `Cambios guardados en ${canonical}.`
        : `Guardado en esta computadora. ${obs.equipment.length} equipo${obs.equipment.length !== 1 ? 's' : ''} en ${canonical}.`)
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  function onDiscard(): void {
    const wasEditing = editingId !== null
    resetDraft()
    setMessage(wasEditing ? 'Edición cancelada. El registro quedó como estaba.' : 'Resultado descartado. La nota sigue en el cuadro por si quieres editarla.')
  }

  function onEdit(o: Observation): void {
    setDraft(o)
    setEditingId(o.id)
    setChosen(o.facilityCanonical ?? o.facility)
    setDedup(null)
    setWarnings([])
    setExtractMs(null)
    setMessage(`Editando la observación de ${o.facilityCanonical ?? o.facility}. Corrige lo que haga falta y guarda.`)
    document.getElementById('rev-h')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function onRecord(): Promise<void> {
    try {
      await recorder.current.start()
      setRecording(true); setSeconds(0); setLevel(0); setFixes([])
      setMessage('Grabando. Habla con naturalidad y pulsa Detener al terminar.')
    } catch (e) {
      setMessage(e instanceof Error && /denied|permission/i.test(e.message)
        ? 'Debes permitir el acceso al micrófono para dictar.'
        : `No se pudo iniciar el micrófono: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  async function onStop(): Promise<void> {
    const dur = recorder.current.seconds
    setBusy(true); setTranscribing(true)
    try {
      const wav = await recorder.current.stop()
      setRecording(false)
      setMessage(`Transcribiendo ${dur.toFixed(0)} s de audio, localmente…`)
      const t = await call(window.api.transcribe(wav))
      setText(t.text); setFixes(t.fixes); textFromVoice.current = true
      refreshTimings()
      setMessage(t.fixes.length
        ? `Transcrito y corregidos ${t.fixes.length} términos. Revisa el texto y pulsa Interpretar.`
        : 'Transcrito. Revisa el texto y pulsa Interpretar.')
    } catch (e) { setRecording(false); fail(e) } finally { setTranscribing(false); setBusy(false) }
  }

  if (!hasApi) {
    return (
      <main>
        <Header status={null} timings={{}} theme={theme} onTheme={onTheme} onHome={null} modeLabel={null} />
        <section><p className="empty">Esta interfaz solo funciona dentro de la aplicación Eco, porque los modelos corren en el proceso principal de Electron. Ábrela con <code>npm run dev</code> o desde el instalador.</p></section>
      </main>
    )
  }

  if (booting) {
    return (
      <Splash
        theme={theme} status={status} timings={timings}
        observations={observations.length}
        onDone={() => setBooting(false)}
      />
    )
  }

  return (
    <main className={`mode-${mode}`}>
      <span id="mode-live" className="sr-only" aria-live="polite" />
      <Header
        status={status} timings={timings} theme={theme} onTheme={onTheme}
        onHome={mode === 'home' ? null : goHome}
        modeLabel={mode === 'home' ? null : MODE_LABEL[mode]}
      />

      {askTheme ? (
        <ThemeFirstRun
          value={theme}
          onChange={onTheme}
          onDone={() => { onTheme(theme); setAskTheme(false) }}
        />
      ) : mode === 'home' ? (
        <div key="home" className="mode-enter">
          <Home
            rows={rows} total={observations.length}
            onPrepare={prepare} onPick={go} modelsReady={allReady}
          />
        </div>
      ) : mode === 'follow' ? (
        <div key="follow" className="mode-enter">
          <FollowUpMode
            observations={observations}
            columns={columns} onColumns={setColumns}
            modelsReady={gemmaReady} timings={timings}
            operator={operator} onOperator={onOperator}
            theme={theme}
          />
          <GuideSection timings={timings} />
        </div>
      ) : (
        <div key="capture" className="mode-enter">
          <Stats rows={rows} total={observations.length} />
          <div className="grid">
            <Capture
              text={text} onText={onText} busy={busy} transcribing={transcribing} recording={recording}
              seconds={seconds} level={level} fixes={fixes}
              voiceEnabled={VOICE_ENABLED} modelsReady={allReady} timings={timings}
              onRecord={onRecord} onStop={onStop} onExtract={onExtract} message={message}
            />
            <Review
              draft={draft} editing={editingId !== null} extracting={busy && !draft && !recording && !transcribing}
              extractMs={extractMs} warnings={warnings} timings={timings}
              dedup={dedup} dedupLoading={dedupLoading} chosenCustomer={chosen} onChooseCustomer={setChosen}
              citiesByCountry={cities}
              onChange={setDraft} onSave={onSave} onDiscard={onDiscard} onCancelWait={onCancelWait}
            />
          </div>

          {/* Registrar abre sin lista: la pantalla deja de competir consigo
              misma por la atención, y la consulta vive detrás de la otra puerta. */}
          <div className="base-toggle">
            <button
              type="button"
              className={`ghost${showBase ? ' on' : ''}`}
              aria-expanded={showBase}
              onClick={() => transitionTo(() => setShowBase((v) => !v))}
            >
              {showBase ? 'Ocultar la base registrada' : `Ver la base registrada (${observations.length} observaciones)`}
            </button>
            <span className="muted">
              Para consultar y reportar, la puerta es <b>Seguimiento y reportes</b>.
            </span>
          </div>

          {showBase && (
            <div className="mode-enter">
              <Dashboard
                observations={observations} filter={filter} onFilter={setFilter}
                columns={columns} onColumns={setColumns}
                onEdit={onEdit} editingId={editingId}
              />
              <ReportsSection
                observations={observations} filter={filter} columns={columns}
                operator={operator} onOperator={onOperator} rowsShown={rows.length}
              />
            </div>
          )}

          <GuideSection timings={timings} />
        </div>
      )}
      <Footer />
    </main>
  )
}
