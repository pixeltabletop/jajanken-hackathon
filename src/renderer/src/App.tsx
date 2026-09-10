import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react'
import './assets/components.css'
import { DEFAULT_COLUMNS, type ColumnKey } from '../../shared/columns.ts'
import type { TimingTable } from '../../shared/timings.ts'
import type { TranscriptFix } from '../../shared/transcript.ts'
import type { DedupResult, ModelStatus, Observation, QueryFilter } from '../../shared/types.ts'
import { DEFAULT_THEME, isThemeId, type ThemeId } from './assets/themes.ts'
import { WavRecorder } from './audio/wav-recorder.ts'
import { Access } from './components/Access.tsx'
import { Capture } from './components/Capture.tsx'
import { Dashboard } from './components/Dashboard.tsx'
import { FollowUpMode } from './components/FollowUpMode.tsx'
import { Footer } from './components/Footer.tsx'
import { GuideSection } from './components/GuideSection.tsx'
import { Home } from './components/Home.tsx'
import { prefersReducedMotion } from './components/LogoMotion.tsx'
import { ModeFlash } from './components/ModeFlash.tsx'
import { ReportsSection } from './components/ReportsSection.tsx'
import { Review } from './components/Review.tsx'
import {
  IconoBase,
  IconoColumnas,
  IconoDictar,
  IconoExportar,
  IconoFiltro,
  IconoGrafica,
  IconoGuia,
  Sidebar,
  type AccionLateral
} from './components/Sidebar.tsx'
import { Splash } from './components/Splash.tsx'
import { Stats } from './components/Stats.tsx'
import { TopBar } from './components/TopBar.tsx'
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

const MODE_SUB: Record<Mode, string | null> = {
  home: null,
  capture: 'Dicta o escribe la nota de la visita. Cada dato guarda la cita que lo justifica.',
  follow: 'Pregunta en español por lo ya registrado, o filtra a mano.'
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
  /** Acceso: hoy no valida nada, solo recoge el nombre. Ver Access.tsx. */
  const [entered, setEntered] = useState(false)
  const [mode, setMode] = useState<Mode>('home')
  /** Registrar abre sin lista. La tabla solo aparece si se pide. */
  const [showBase, setShowBase] = useState(false)
  /** Contador que dispara el destello de marca al entrar a un modo. */
  const [flash, setFlash] = useState(0)
  /**
   * Barra lateral ancha o estrecha. Se recuerda en el navegador porque es una
   * comodidad de cada persona en su máquina, no un dato que deba viajar. Si el
   * almacenamiento no está disponible, ancha, que es lo que enseña más.
   */
  const [latAbierta, setLatAbierta] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mam:lateral') !== 'estrecha'
    } catch {
      return true
    }
  })
  const [refrescando, setRefrescando] = useState(false)
  const theme = useThemeId()

  const recorder = useRef(new WavRecorder())
  /** A dónde va el texto transcrito: la nota de campo o la pregunta. */
  const dictado = useRef<'nota' | 'pregunta'>('nota')
  const [question, setQuestion] = useState('')
  const textFromVoice = useRef(false)
  const cancelled = useRef(false)

  const hasApi = typeof window !== 'undefined' && !!window.api
  const allReady = !!status && status.gemma.state === 'ready' && status.whisper.state === 'ready' && status.embed.state === 'ready'
  // La pregunta en español solo necesita a Gemma. Guardar un cliente nuevo
  // recarga Whisper, y eso no tiene por qué bloquear el modo Seguimiento.
  const gemmaReady = status?.gemma.state === 'ready'
  const whisperReady = status?.whisper.state === 'ready'

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
        // El tema arranca SIEMPRE en blanco. El oscuro es una eleccion, no una
        // pregunta: quien lo quiera lo cambia con el sol del pie de la barra.
        else setTheme(DEFAULT_THEME)
      })
      .catch(() => setTheme(DEFAULT_THEME))
    refreshTimings()
    refreshCities()
  }, [hasApi, refreshTimings, refreshCities])

  // Estado de modelos: cada 2 s hasta que los tres estén listos, luego cada 6 s.
  // Con los tres verdes el sondeo no es cosmético: es lo que destapa un worker
  // muerto. Cada segundo de más aquí es un segundo de semáforo mintiendo.
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
    const id = setInterval(tick, allReady ? 6000 : 2000)
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
    // Cada cambio de pantalla lleva su cruce con la marca. Josué lo pidió así:
    // "cada vez que cambias de una pestaña a otra, siempre aparezca el logo de
    // carga, así sea por un poco, para que se vea más fluido".
    setFlash((n) => n + 1)
    transitionTo(
      () => {
        setMode(next)
        if (next === 'capture') setShowBase(false)
      },
      next === 'home' ? 'door-capture' : next === 'follow' ? 'q-input' : 'note'
    )
    announce(`Modo ${MODE_LABEL[next]}`)
  }, [])

  /**
   * Cerrar sesión devuelve a la pantalla de acceso. No borra nada: los registros
   * son del equipo, no del usuario. Si hay un borrador sin guardar, pregunta,
   * igual que al volver al inicio.
   */
  const logout = useCallback((): void => {
    if (mode === 'capture' && hasUnsaved) {
      const ok = window.confirm(
        'Tienes una observación sin guardar. Si cierras sesión se descarta.\n\n¿Cerrar sesión de todos modos?'
      )
      if (!ok) return
    }
    resetDraft(); setText(''); setFixes([]); textFromVoice.current = false
    setQuestion('')
    transitionTo(() => { setMode('home'); setShowBase(false); setEntered(false) }, 'acc-user')
    announce('Sesión cerrada')
  }, [mode, hasUnsaved])

  /** Precarga al enfocar una tarjeta: al hacer clic ya está listo. */
  const prepare = useCallback((m: 'capture' | 'follow'): void => {
    if (m === 'follow') refreshList()
    else refreshCities()
  }, [refreshList, refreshCities])

  const plegarLateral = useCallback((): void => {
    setLatAbierta((v) => {
      const siguiente = !v
      try {
        localStorage.setItem('mam:lateral', siguiente ? 'ancha' : 'estrecha')
      } catch {
        // Ventana privada o almacenamiento bloqueado: se pliega igual, solo que
        // no se recuerda. Nada de esto justifica romper la barra.
      }
      return siguiente
    })
  }, [])

  /**
   * Cambia de sección desde la barra lateral, preguntando antes si hay una
   * observación a medio escribir. Antes solo el inicio protegía ese trabajo;
   * con la barra se puede saltar de una puerta a la otra sin pasar por ahí, así
   * que la guarda tiene que vivir en el único sitio por el que se navega.
   */
  const navegar = useCallback((next: Mode): void => {
    if (next === mode) return
    if (mode === 'capture' && hasUnsaved) {
      const ok = window.confirm(
        'Tienes una observación sin guardar. Si cambias de sección se descarta.\n\n¿Cambiar de todos modos?'
      )
      if (!ok) return
      resetDraft(); setText(''); setFixes([]); textFromVoice.current = false
    }
    go(next)
  }, [mode, hasUnsaved, go])

  /**
   * Lleva la vista a un control que ya está en pantalla y, si hace falta, lo
   * pulsa. Las acciones de la barra no duplican lógica: apuntan al mismo botón
   * que ya existe dentro del panel, que es el que sabe qué hacer.
   *
   * Se reintenta un poco porque el panel puede estar montándose todavía cuando
   * la acción viene de "abre la base y llévame a los filtros".
   */
  const activar = useCallback((selector: string, pulsar = false): void => {
    let intentos = 0
    const buscar = (): void => {
      const el = document.querySelector<HTMLElement>(selector)
      if (!el) {
        if (intentos++ < 12) setTimeout(buscar, 40)
        return
      }
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
      if (pulsar) el.click()
      else el.focus({ preventScroll: true })
    }
    buscar()
  }, [])

  const refrescar = useCallback((): void => {
    setRefrescando(true)
    refreshList(); refreshCities(); refreshTimings()
    // El refresco es casi instantáneo: lee del disco local. El retardo existe
    // para que el giro del icono se vea, no para esperar a nada.
    setTimeout(() => setRefrescando(false), 450)
  }, [refreshList, refreshCities, refreshTimings])

  /**
   * Las acciones puntuales de la sección en la que estás. Solo las relevantes:
   * una barra lateral con todo dentro es un menú, y un menú no es una barra.
   */
  function construirAcciones(): AccionLateral[] {
    const abrirBase = (): void => { if (!showBase) transitionTo(() => setShowBase(true)) }

    if (mode === 'capture') {
      return [
        {
          id: 'dictar',
          label: recording ? 'Detener el dictado' : 'Dictar la nota',
          icono: <IconoDictar />,
          activa: recording,
          disabled: !VOICE_ENABLED || busy || transcribing,
          nota: VOICE_ENABLED ? undefined : 'el dictado está apagado',
          onClick: () => { if (recording) onStop(); else void onRecord('nota') }
        },
        {
          id: 'base',
          label: showBase ? 'Ocultar la base' : 'Ver la base registrada',
          icono: <IconoBase />,
          activa: showBase,
          onClick: () => transitionTo(() => setShowBase((v) => !v))
        },
        { id: 'filtros', label: 'Filtros', icono: <IconoFiltro />, onClick: () => { abrirBase(); activar('.filterbar input[type="search"]') } },
        { id: 'columnas', label: 'Columnas', icono: <IconoColumnas />, onClick: () => { abrirBase(); activar('.filterbar button[aria-expanded]', true) } },
        { id: 'graficas', label: 'Gráficas', icono: <IconoGrafica />, onClick: () => { abrirBase(); activar('.charts') } }
      ]
    }

    if (mode === 'follow') {
      return [
        {
          id: 'dictar',
          label: recording ? 'Detener el dictado' : 'Dictar la pregunta',
          icono: <IconoDictar />,
          activa: recording,
          disabled: !VOICE_ENABLED || transcribing,
          nota: VOICE_ENABLED ? undefined : 'el dictado está apagado',
          onClick: () => { if (recording) onStop(); else void onRecord('pregunta') }
        },
        { id: 'guia', label: 'Cómo pedirlo', icono: <IconoGuia />, onClick: () => activar('.guide-toggle', true) },
        { id: 'resultado', label: 'Resultado', icono: <IconoBase />, onClick: () => activar('#tab-result', true) },
        { id: 'graficas', label: 'Gráficas', icono: <IconoGrafica />, onClick: () => activar('#tab-charts', true) },
        { id: 'exportar', label: 'Exportar', icono: <IconoExportar />, onClick: () => activar('.exportbar') }
      ]
    }

    return []
  }

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

  async function onRecord(destino: 'nota' | 'pregunta' = 'nota'): Promise<void> {
    dictado.current = destino
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
      refreshTimings()
      if (dictado.current === 'pregunta') {
        // La pregunta dictada se queda en el cuadro para poder corregirla antes
        // de lanzarla: transcribir no es entender, y una palabra mal oída
        // cambiaría el filtro entero.
        setQuestion(t.text)
        setMessage('Pregunta transcrita. Revísala y pulsa Preguntar.')
        return
      }
      setText(t.text); setFixes(t.fixes); textFromVoice.current = true
      setMessage(t.fixes.length
        ? `Transcrito y corregidos ${t.fixes.length} términos. Revisa el texto y pulsa Interpretar.`
        : 'Transcrito. Revisa el texto y pulsa Interpretar.')
    } catch (e) { setRecording(false); fail(e) } finally { setTranscribing(false); setBusy(false) }
  }

  if (!hasApi) {
    return (
      <main className="fuera">
        <section>
          <p className="empty">
            Esta interfaz solo funciona dentro de la aplicación MAM, porque los modelos
            corren en el proceso principal de Electron. Ábrela con <code>npm run dev</code> o
            desde el instalador.
          </p>
        </section>
      </main>
    )
  }

  if (!booting && !entered) {
    return (
      <Access
        initialName={operator}
        observations={observations.length}
        status={status}
        onEnter={(n) => {
          onOperator(n)
          setFlash((f) => f + 1)
          transitionTo(() => setEntered(true), 'door-capture')
        }}
      />
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

  // Armazón de dos columnas: la barra lateral manda y el área de trabajo obedece.
  // Todo lo global —navegación, tema, motor, sesión— vive a la izquierda; a la
  // derecha solo está lo que hayas elegido. La franja de arriba es delgada a
  // propósito: dice dónde estás y nada más.
  return (
    <div className={`shell mode-${mode}${latAbierta ? '' : ' lat-estrecha'}`}>
      <span id="mode-live" className="sr-only" aria-live="polite" />

      <Sidebar
        abierta={latAbierta}
        onPlegar={plegarLateral}
        modo={mode}
        onIr={navegar}
        onPreparar={prepare}
        acciones={construirAcciones()}
        theme={theme}
        onTheme={onTheme}
        status={status}
        timings={timings}
        operator={operator}
        onCambiarUsuario={logout}
        onLogout={logout}
      />

      {/* El cruce vive DENTRO del area de trabajo, no sobre la ventana entera.
          La barra lateral es el menu: no cambia, asi que no tiene por que
          cargar ni difuminarse. Josue: "la transicion debe ser nada mas en el
          recuadro del lado derecho". */}
      <main className="workspace">
        <ModeFlash show={flash} theme={theme} />
        <TopBar
          titulo={MODE_LABEL[mode]}
          sub={MODE_SUB[mode]}
          observaciones={observations.length}
          onRefrescar={refrescar}
          refrescando={refrescando}
        />

        <div className="workspace-body">
          {mode === 'home' ? (
            <div key="home" className="mode-enter">
              <Home
                rows={rows} total={observations.length}
                onPrepare={prepare} onPick={navegar}
                modelsReady={allReady} gemmaReady={!!gemmaReady} operator={operator}
                theme={theme}
              />
            </div>
          ) : mode === 'follow' ? (
            <div key="follow" className="mode-enter">
              <FollowUpMode
                observations={observations}
                columns={columns} onColumns={setColumns}
                modelsReady={gemmaReady} timings={timings}
                operator={operator} onOperator={onOperator}
                theme={theme} question={question} onQuestion={setQuestion}
                voiceEnabled={VOICE_ENABLED} recording={recording} transcribing={transcribing}
                seconds={seconds} onRecord={() => void onRecord('pregunta')} onStop={onStop}
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
                  voiceEnabled={VOICE_ENABLED} modelsReady={gemmaReady} whisperReady={whisperReady} timings={timings}
                  onRecord={() => void onRecord('nota')} onStop={onStop} onExtract={onExtract} message={message}
                  theme={theme}
                />
                <Review
                  draft={draft} editing={editingId !== null} extracting={busy && !draft && !recording && !transcribing}
                  extractMs={extractMs} warnings={warnings} timings={timings}
                  dedup={dedup} dedupLoading={dedupLoading} chosenCustomer={chosen} onChooseCustomer={setChosen}
                  citiesByCountry={cities}
                  onChange={setDraft} onSave={onSave} onDiscard={onDiscard} onCancelWait={onCancelWait}
                  theme={theme}
                />
              </div>

              {/* Registrar abre sin lista: la pantalla deja de competir consigo
                  misma por la atención, y la consulta vive detrás de la otra puerta.
                  El mismo interruptor está en la barra lateral. */}
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
        </div>

        <Footer />
      </main>
    </div>
  )
}
