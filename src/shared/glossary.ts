// Textos de ayuda. Un solo origen para los globos "?" y para la guía completa,
// así la explicación de un campo no puede divergir entre los dos sitios.

export interface GlossaryEntry {
  term: string
  short: string
  long?: string
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  observaciones: {
    term: 'Observaciones',
    short: 'Visitas registradas. Una observación es una visita a un cliente: un texto dictado o escrito, con todos los equipos que se vieron en esa visita.',
    long: 'Si un técnico visita el mismo hospital dos veces, son dos observaciones. Cada una guarda la nota original completa, que nunca se modifica después de confirmar.'
  },
  clientes: {
    term: 'Clientes',
    short: 'Sitios distintos con al menos un equipo registrado. Se cuentan por nombre canónico, no por cómo se dijo en la nota.',
    long: 'Si dos técnicos escriben "DemoCare Pacific" y "Hospital DemoCare Pacific", el sistema propone unirlos y cuentan como un solo cliente.'
  },
  equipos7: {
    term: 'Equipos de 7+ años',
    short: 'Suma de unidades cuya edad estimada es de siete años o más. Es el indicador de oportunidad de renovación.',
    long: 'Solo cuenta cuando hay una edad en años. Un equipo descrito como "viejo" sin número no entra aquí, porque no se inventa una cifra.'
  },
  bajaConfianza: {
    term: 'Filas con baja confianza',
    short: 'Filas de equipo marcadas como confianza Baja, o cuya cita no aparece literal en la nota. Son las que conviene revisar primero.',
    long: 'Este número es una función, no un defecto: el sistema señala lo que no puede sostener con evidencia en vez de esconderlo.'
  },
  evidencia: {
    term: 'Evidencia',
    short: 'La cita textual de la nota que justifica una fila de equipo. Se resalta en amarillo sobre el texto original.',
    long: 'Antes de guardar, el sistema comprueba que la cita exista palabra por palabra en la nota. Si no aparece, la fila se marca en rojo y baja a confianza Baja automáticamente. Es el control que permite auditar una alucinación del modelo.'
  },
  confianza: {
    term: 'Confianza',
    short: 'Qué tan seguro está el sistema del dato de esa fila. Alta, Media o Baja.',
    long: 'Alta: la nota lo dice de forma clara y directa, con número o nombre explícito. Media: la nota lo dice con matiz o aproximación, por ejemplo "unos seis" o "parece nuevo". Baja: apenas está sostenido por el texto, o la cita no se pudo verificar. Se puede corregir a mano en cualquier momento.'
  },
  estado: {
    term: 'Estado',
    short: 'De dónde viene el dato, con el vocabulario de Philips: Confirmado, Reportado, Estimado o Desconocido.',
    long: 'Confirmado: el técnico lo vio y lo contó directamente. Reportado: lo afirma con naturalidad pero sin conteo explícito, o se lo dijo el personal del hospital. Estimado: es un cálculo aproximado, suyo o del personal. Desconocido: el dato está apenas insinuado y no debe usarse para decidir.'
  },
  cantidadAprox: {
    term: 'Cantidad aproximada',
    short: 'La cifra viene con duda en la nota: "unos seis", "quizás ocho", "varios".',
    long: 'En la tabla estas cantidades llevan el signo ~ delante. Sirve para no sumar como exacto lo que el técnico dijo con reservas.'
  },
  marcaDesconocida: {
    term: 'Marca desconocida',
    short: 'El técnico no vio la marca. El sistema nunca la adivina.',
    long: 'Es una regla dura tomada del propio brief de Philips: si no se conoce, se guarda como desconocida. Un modelo pequeño rellenaría el hueco con la marca más frecuente, y eso corrompe la base en silencio.'
  },
  clienteNuevo: {
    term: 'Cliente nuevo o existente',
    short: 'Al guardar, el sistema busca si ese sitio ya existe en la base y propone los tres candidatos más parecidos.',
    long: 'La comparación es por parecido de nombre más desempate por ciudad, nunca por un umbral fijo. En esta base hay dos clientes distintos llamados DemoCare North y DemoCare Metro North, con 91% de parecido entre sí: un umbral los fundiría en uno solo. La decisión final siempre es del técnico.'
  },
  edad: {
    term: 'Edad',
    short: 'Años aproximados del equipo. Si la nota solo dice "nuevo" o "viejo", se guarda esa palabra en gris en vez de un número.',
    long: 'De la edad se deriva el año estimado de instalación restándola a la fecha de la visita. Ese año no lo extrae el modelo, se calcula.'
  },
  local: {
    term: '100% local, sin nube',
    short: 'Los tres modelos de inteligencia artificial corren dentro de esta computadora. Ninguna consulta, audio ni dato sale del dispositivo.',
    long: 'Transcripción con Whisper Base, extracción con Gemma 2B y deduplicación con EmbeddingGemma 300M, todos vía QVAC de Tether. La aplicación funciona con el WiFi apagado.'
  },
  tiempos: {
    term: 'Tiempos de proceso',
    short: 'Promedios medidos en esta computadora, no estimaciones. Se actualizan con cada uso.',
    long: 'La primera carga de los modelos es la más lenta porque se leen desde disco a memoria. Después quedan cargados mientras la aplicación esté abierta.'
  }
}

/** Preguntas guía para el técnico, derivadas de la lógica de agente de Philips. */
export const FIELD_PROMPTS: Array<{ q: string; hint: string; required: boolean }> = [
  { q: '¿En qué cliente estás?', hint: 'Nombre del hospital o clínica, como lo conozcas', required: true },
  { q: '¿En qué ciudad?', hint: 'Ayuda a no confundir clientes con nombres parecidos', required: true },
  { q: '¿Qué equipos viste?', hint: 'Resonancia, tomografía, ecografía, rayos X, monitoreo', required: true },
  { q: '¿Cuántos de cada uno?', hint: 'Si no estás seguro, dilo: "unos seis", "quizás ocho"', required: true },
  { q: '¿De qué marca?', hint: 'Si no la viste, no pasa nada. Dilo y queda como desconocida', required: false },
  { q: '¿Qué edad tienen?', hint: 'En años si puedes. Si no, "nuevo", "viejo", "muy viejo"', required: false },
  { q: '¿Algo más que valga la pena?', hint: 'Lo que notaste y no cabe en un campo', required: false }
]

export const EXAMPLE_NOTE =
  'Estoy en el Hospital DemoCare Bella Vista, en Ciudad de Panamá. Tienen dos resonadores NovaMed de unos seis años y un tomógrafo Aurelia Health que se ve nuevo, como de tres años.'
