# FieldLens · Jajanken — Blueprint

> Generado por The Architect el 2026-09-09 · Arquetipo: herramienta interna de escritorio con motor de IA local
> Hackathon ISD Summit 2026 · Track 01 Philips · Entrega: **viernes 2026-09-11 08:00 hora de Panamá**
> Equipo Jajanken: Josué Carrillo (motor, interfaz, README) · Diego Laverde (datos, guion, video, QA)

Este documento es autocontenido. Un agente sin contexto previo debe poder construir el proyecto completo leyendo solo esto y los archivos que referencia dentro del repositorio.

---

## 1. Visión general

### Qué es
FieldLens es una aplicación de escritorio para Windows que convierte lo que un técnico de campo dice después de visitar un hospital en un registro estructurado del equipo médico instalado, y acumula esas observaciones en una base local consultable en español. Toda la inteligencia artificial corre en la laptop: transcripción de voz, extracción de datos, deduplicación de clientes y consulta en lenguaje natural. Ninguna consulta ni dato sale del dispositivo.

Responde al reto Philips "Customer Installed Base Intelligence" del hackathon, cuya rúbrica pondera Technical 35%, Innovation 25%, Impact 20%, Design 10%, Completion 10%.

### Qué NO es
- No es una app móvil. QVAC lo soporta vía Expo pero queda declarado como trabajo futuro.
- No tiene mapa geográfico. Tablero de tabla y gráficos.
- No lee fotos de etiquetas. Gemma es multimodal y lo permitiría, queda como trabajo futuro.
- No sincroniza con ningún servidor.

### Punto de partida
Existen dos bases que se fusionan:
1. **FieldLens v1 de Diego** (`Proyecto/` en el SSD externo, a fusionar en el repo): Electron 39 + Vite 7 + React 19 + TypeScript. Empaqueta, corre offline, tiene instalador de modelos por USB y tres pantallas en español. Usa modelos y configuración que las mediciones descartan.
2. **Banco de mediciones de Josué** (`bench/`, `schema.js`, `data/`): 23 corridas con evidencia JSON sobre qué modelos y qué configuración funcionan en esta clase de hardware.

**Ambas bases son preexistentes y deben declararse en el README.** Omitirlo descalifica según las bases del concurso.

### Objetivos
1. Ciclo completo demostrable en video: dictar → transcribir → extraer → confirmar con evidencia → guardar → tablero se actualiza → preguntar en español y ver el filtro aplicado.
2. Cada dato extraído lleva la cita textual de la nota que lo justifica. Auditable, no solo bonito.
3. Un juez clona el repo, sigue el README y reproduce las cifras del banco en su máquina.

### Métricas de éxito medidas hoy, que el producto debe conservar o superar
| Etapa | Modelo | Resultado medido | Archivo de evidencia |
|---|---|---|---|
| Voz a texto en español | `WHISPER_BASE_Q8_0` con vocabulario sembrado | 9 de 10 hospitales, 17% WER, 1.4 s | `bench/asr_WHISPER_BASE_Q8_0_es+prompt.json` |
| Extracción en español | `GEMMA4_2B_MULTIMODAL_Q4_K_M`, esquema compacto | 8 de 10 casos oficiales, 14 de 14 citas textuales, 12.0 s | `bench/compacto10_GEMMA4_2B_MULTIMODAL_Q4_K_M_es.json` |
| Deduplicación de clientes | `EMBEDDINGGEMMA_300M_Q8_0` por ranking | 12 de 12 variantes, 4 de 4 casos críticos | `bench/embed_EMBEDDINGGEMMA_300M_Q8_0.json` |
| Consulta en español → filtro | mismo Gemma, segundo esquema | **sin medir**, se mide en el bloque 5 antes de conectarla | pendiente |

---

## 2. Stack

| Capa | Tecnología | Por qué |
|---|---|---|
| Aplicación | Electron 39 + electron-vite 5 + React 19 + TypeScript 5.9 | Es lo que ya empaqueta y corre offline en la máquina de Diego. No se cambia. |
| Inferencia | `@qvac/sdk` **0.19.0** (subir desde 0.17.1) | Requisito del hackathon. 0.19 es la versión medida. |
| Voz a texto | `WHISPER_BASE_Q8_0`, catálogo nativo QVAC | 9/10 nombres propios con vocabulario sembrado. Tiny dio 0/10. |
| Extracción | `GEMMA4_2B_MULTIMODAL_Q4_K_M`, catálogo nativo QVAC | Mejor en español de los 5 medidos. Llama 3.2 1B dio 0/9. |
| Deduplicación | `EMBEDDINGGEMMA_300M_Q8_0`, catálogo nativo QVAC | Separó los dos hospitales homónimos del dataset. |
| Captura de audio | Web Audio API en el renderer → WAV PCM 16 kHz mono | Elimina ffmpeg, que hoy se invoca del PATH y no está empaquetado. |
| Almacenamiento | Archivo JSON en `app.getPath('userData')` | Suficiente para menos de 500 observaciones. Es lo que ya hay. |
| Gráficos | Recharts 3 | Ya instalado. |
| Validación | Zod 4 | Ya instalado. Valida la salida del modelo antes de guardar. |
| Empaquetado | electron-builder 26, NSIS | Ya configurado. |
| Gestor de paquetes | npm | Es el del proyecto. |

Todos los modelos son constantes del catálogo de QVAC. Ninguno es externo. No hay APIs remotas. No hay componentes de terceros para inferencia.

---

## 3. Estructura de directorios

El repositorio final es el proyecto Electron de Diego como raíz, con el banco de mediciones y los documentos incorporados.

```
jajanken-hackathon/
  README.md                        # Entregable. Declaración de bases preexistentes. Reproducibilidad.
  DECISIONES.md                    # Qué se decidió y por qué. Si no está aquí, no se decidió.
  LICENSE                          # MIT
  package.json
  electron-builder.yml             # asar:false, extraResources para modelos NO (se instalan por .cmd)
  electron.vite.config.ts
  qvac.config.json                 # loggerLevel error
  docs/
    BLUEPRINT.md                   # Este documento
    GUION-VIDEO.md                 # Guion cronometrado, se escribe en el bloque 1
    briefing.html                  # Puesta al día técnica (ya existe)
  bench/                           # Banco de mediciones. Reproducible con `npm run bench:*`
    *.js                           # Scripts de medición (portados de ~/personal/jajanken)
    *.json                         # Evidencia cruda de cada corrida
  data/
    seed-philips.json              # 20 registros del workbook de Philips convertidos a Observation
    seed-panama.json               # 10 observaciones ficticias de Panamá (ya existe, formato Observation)
    catalog.json                   # Modalidades, marcas, estados, confianzas, clientes conocidos
    Dummy_Installed_Base_Hackathon.xlsx   # Fuente original de Philips, no se modifica
  resources/
    icon.png
    "Instalar modelos QVAC offline.cmd"   # Copia ~/.qvac/models desde USB
  src/
    shared/
      types.ts                     # Observation, Equipment, Catalog, QueryFilter. Único origen de verdad de tipos.
      catalog.ts                   # Constantes MODALITIES, BRANDS, STATUSES, CONFIDENCE y sus índices
    main/
      index.ts                     # Bootstrap de Electron + registro de IPC. Nada de lógica aquí.
      ipc.ts                       # Handlers IPC, cada uno delega a un módulo
      store.ts                     # Leer/escribir observations.json y embeddings.json en userData
      qvac/
        models.ts                  # Carga única de los 3 modelos con SU configuración. Warm-up al arrancar.
        transcribe.ts              # Whisper con language es + initial_prompt del catálogo de clientes
        extract.ts                 # Gemma + esquema compacto + resolver a Observation + validación Zod
        dedup.ts                   # Embeddings por ranking + desempate por ciudad. Nunca umbral.
        query.ts                   # Pregunta en español → QueryFilter con esquema forzado
        prompts.ts                 # Los system prompts, verbatim de este blueprint
    preload/
      index.ts                     # Expone window.api tipado
      index.d.ts
    renderer/
      index.html
      src/
        main.tsx
        App.tsx                    # Solo composición de secciones y estado global
        audio/
          wav-recorder.ts          # Web Audio → Float32 16 kHz mono → WAV bytes
        components/
          Header.tsx               # Logo, título, indicador "100% local"
          Stats.tsx                # 4 métricas
          Capture.tsx              # Textarea + Dictar + Interpretar
          Review.tsx               # Panel de confirmación por equipo, con evidencia resaltada
          EquipmentRow.tsx         # Una fila editable de equipo
          EvidenceHighlight.tsx    # Muestra rawText con la cita marcada
          FollowUp.tsx             # Pregunta sugerida desde missing_fields
          DuplicateAlert.tsx       # Candidatos de deduplicación con ciudad y puntaje
          Dashboard.tsx            # Filtros + QueryBar + tabla + gráficos
          QueryBar.tsx             # Entrada en español → filtro aplicado + chip "interpretado como"
          Charts.tsx               # Barras: equipo por modalidad, por país, por antigüedad
          DataTable.tsx            # Tabla por equipo, no por observación
        assets/
          base.css                 # Tokens (existentes, se conservan)
          main.css
          philips-logo.svg
```

---

## 4. Modelo de datos

### Entidades

**Observation** — una visita, una nota, N equipos.
| Campo | Tipo | Notas |
|---|---|---|
| id | string | `obs-<timestamp>-<random4>` |
| createdAt | string ISO date | Fecha de la observación |
| observer | string | Nombre o código del técnico. Editable. |
| source | `'Voice' \| 'Text' \| 'Seed'` | Cómo entró |
| language | `'es' \| 'en'` | Idioma de rawText |
| rawText | string | La nota tal cual se dictó o escribió. Nunca se modifica después de guardar. |
| facility | string | Nombre del sitio como lo dijo el usuario |
| facilityCanonical | string \| null | Nombre canónico resuelto por deduplicación, null si es cliente nuevo |
| city | string \| null | |
| country | string \| null | |
| equipment | Equipment[] | Mínimo 1 fila |
| missingFields | string[] | Campos que valdría la pena preguntar |
| reviewed | boolean | true cuando el usuario confirmó en pantalla |

**Equipment** — una fila de equipo dentro de una observación.
| Campo | Tipo | Notas |
|---|---|---|
| modality | enum MODALITIES | `MR, CT, Ultrasound, X-Ray, Patient Monitoring, Image Guided Therapy, Other` |
| quantity | integer ≥ 1 | |
| quantityIsEstimate | boolean | true si la nota dijo "unos", "quizás", "como", "varios" |
| brand | enum BRANDS \| null | `NovaMed, Aurelia Health, BluePeak Medical, Orion Imaging, HelixCare, Zenith MedTech`. null = desconocida. **Nunca se adivina.** |
| model | string \| null | |
| approxAgeYears | number \| null | Solo si se dijo un número. Rango → punto medio. |
| ageQualitative | `'new' \| 'recent' \| 'old' \| 'very old' \| null` | Para "nuevo", "viejo" sin número |
| installYearEstimate | integer \| null | **Derivado**: año de createdAt − approxAgeYears. No lo extrae el modelo. |
| confidence | `'High' \| 'Medium' \| 'Low'` | Por fila, no por observación |
| status | `'Confirmed' \| 'Reported' \| 'Estimated' \| 'Unknown'` | Vocabulario de Philips |
| evidence | string | **Cita textual de rawText.** Se valida con `rawText.includes(evidence)` antes de guardar. Si no es substring, la fila se marca `confidence: 'Low'` y se resalta en rojo. |
| notes | string \| null | |

**Catalog** — `data/catalog.json`
```json
{
  "modalities": ["MR","CT","Ultrasound","X-Ray","Patient Monitoring","Image Guided Therapy","Other"],
  "brands": ["NovaMed","Aurelia Health","BluePeak Medical","Orion Imaging","HelixCare","Zenith MedTech"],
  "statuses": ["Confirmed","Reported","Estimated","Unknown"],
  "confidence": ["High","Medium","Low"],
  "customers": [ { "name": "Hospital DemoCare Pacific", "city": "Panama City", "country": "Panama" }, "..." ]
}
```
`customers` se construye al arrancar como la unión de los sitios de `seed-philips.json`, `seed-panama.json` y las observaciones guardadas. Alimenta el `initial_prompt` de Whisper y los vectores canónicos de deduplicación.

**QueryFilter** — lo que produce la pregunta en español.
| Campo | Tipo |
|---|---|
| country | string \| null |
| city | string \| null |
| modality | enum MODALITIES \| null |
| brand | enum BRANDS \| null |
| minAgeYears | number \| null |
| maxAgeYears | number \| null |
| status | enum STATUSES \| null |
| confidence | enum CONFIDENCE \| null |
| textSearch | string \| null |

### Almacenamiento
Dos archivos en `app.getPath('userData')`:
- `observations.json` — `Observation[]`. Se lee al arrancar, se escribe entero en cada guardado.
- `embeddings.json` — `{ [facilityCanonical]: number[] }`. Vectores de los nombres canónicos. Se recalcula solo para nombres nuevos.

Si `observations.json` no existe, se carga la unión de `data/seed-philips.json` y `data/seed-panama.json` y se persiste.

### Conversión de los 20 registros de Philips
`data/Dummy_Installed_Base_Hackathon.xlsx`, hoja "Dummy Installed Base", se agrupa por `Customer / Hospital` + `Visit Date`. Cada grupo es una Observation; cada fila del grupo es un Equipment. `Voice Input Example` → rawText (language en). `Confidence` y `Status` se copian tal cual. `Approx. Age (Years)` → approxAgeYears. `Dummy Brand` → brand. `evidence` para estos registros es el rawText completo, con `notes: "Semilla Philips, evidencia no segmentada"`. Script: `scripts/convert-philips-seed.mjs`, usa la dependencia `xlsx` ya instalada.

---

## 5. Contrato IPC

Reemplaza a "API Design". El renderer nunca toca QVAC ni el disco. Todo pasa por `window.api`.

| Canal | Entrada | Salida | Módulo |
|---|---|---|---|
| `models:status` | — | `{ whisper, gemma, embed }: 'idle'\|'loading'\|'ready'\|'error'` | models.ts |
| `models:warmup` | — | `Promise<void>` | models.ts. Se llama al arrancar. |
| `audio:transcribe` | `{ wav: Uint8Array }` | `{ text: string, ms: number }` | transcribe.ts |
| `obs:extract` | `{ text: string, language: 'es'\|'en' }` | `{ observation: Observation, ms: number, stats }` | extract.ts |
| `obs:dedup` | `{ facility: string, city: string\|null }` | `{ candidates: Array<{ name, city, country, score, sameCity }> }` | dedup.ts |
| `obs:save` | `Observation` | `Observation[]` | store.ts |
| `obs:list` | — | `Observation[]` | store.ts |
| `query:parse` | `{ question: string }` | `{ filter: QueryFilter, ms: number }` | query.ts |
| `bench:last` | — | resumen de `bench/*.json` para mostrar en la pantalla "Acerca de" | — |

Todo handler devuelve errores como `{ error: { code, message } }`, nunca lanza al renderer. El renderer muestra el mensaje en el área de estado.

### Detalle de los módulos críticos

**models.ts** — carga única, configuración exacta medida.
```ts
import * as sdk from '@qvac/sdk';

// Timeout de arranque del worker: 30 s por defecto no alcanza en Windows en frío.
process.env.QVAC_RPC_INIT_TIMEOUT_MS ??= '240000';

export async function loadGemma() {
  return sdk.loadModel({
    modelSrc: sdk.GEMMA4_2B_MULTIMODAL_Q4_K_M,
    modelConfig: { ctx_size: 4096 }          // El default es 1024 y desborda con dictados largos
  });
}

export async function loadWhisper(customerNames: string[], brands: string[]) {
  const hint = `Nota de campo de un técnico de equipo médico. Hospitales: ${customerNames.join(', ')}. Marcas: ${brands.join(', ')}.`;
  return sdk.loadModel({
    modelSrc: sdk.WHISPER_BASE_Q8_0,
    modelConfig: {
      language: 'es',                          // Sin esto, Whisper TRADUCE al inglés
      translate: false,
      no_timestamps: true,
      initial_prompt: hint                     // Lleva nombres propios de 1/10 a 9/10
    }
  });
}

export async function loadEmbed() {
  return sdk.loadModel({ modelSrc: sdk.EMBEDDINGGEMMA_300M_Q8_0 });
}
```
Los tres se cargan en paralelo al arrancar la app. La interfaz muestra el estado de cada uno. Carga en caliente medida: Gemma 24 s, Whisper y Embed menores. **Antes de grabar el video, la app debe llevar abierta al menos un minuto.**

**extract.ts** — esquema compacto, exactamente el medido.
```ts
const COMPACT_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['f', 'eq'],
  properties: {
    f:  { type: 'string' },                       // sitio
    ci: { type: ['string', 'null'] },             // ciudad
    eq: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['m', 'q', 'e', 'b', 'a', 'c', 's', 'ev'],
      properties: {
        m:  { type: 'integer', minimum: 0, maximum: 6 },   // índice en MODALITIES
        q:  { type: 'integer', minimum: 1 },
        e:  { type: 'boolean' },                            // cantidad estimada
        b:  { type: 'integer', minimum: -1, maximum: 5 },   // índice en BRANDS, -1 desconocida
        a:  { type: ['number', 'null'] },                   // edad en años
        c:  { type: 'integer', minimum: 0, maximum: 2 },    // índice en CONFIDENCE
        s:  { type: 'integer', minimum: 0, maximum: 3 },    // índice en STATUSES
        ev: { type: 'string' }                              // cita textual
      } } }
  }
};

const run = sdk.completion({
  modelId: gemmaId,
  history: [{ role: 'system', content: PROMPT_EXTRACT_ES }, { role: 'user', content: text }],
  stream: true,
  responseFormat: { type: 'json_schema', json_schema: { name: 'obs', schema: COMPACT_SCHEMA } },
  generationParams: { temp: 0, seed: 42, top_k: 1, predict: 600 }
  // SIN kvCache. Cada extracción es independiente. Una llave compartida acumula contexto y desborda.
});
```
El system prompt `PROMPT_EXTRACT_ES` es exactamente el de `bench7.js` (variable `SISTEMA`). Se copia verbatim a `prompts.ts`. Cualquier cambio al prompt obliga a volver a correr `npm run bench:extract` y anotar el resultado en `DECISIONES.md`.

El resolver traduce índices a nombres, calcula `installYearEstimate`, valida `evidence` como substring de `rawText`, y valida el resultado con Zod contra el tipo `Observation`. Si Zod falla, el error se muestra y no se guarda nada.

**Por qué compacto y no el esquema de 19 campos.** Medido en español con contexto 4096: compacto 8/10 en 12.0 s, completo 7/10 en 19.2 s. El modelo genera las claves además de los valores; `quantity_is_estimate` cuesta cinco tokens por fila, `e` cuesta uno.

**Por qué evidencia como cita y no como posiciones.** Se probó pedir `[inicio, fin]` de caracter: el modelo devolvió `[0, 10]` para "dos resonadores". Los modelos no cuentan caracteres. La cita textual funciona y resultó más rápida.

**dedup.ts** — ranking, nunca umbral.
```
1. Vectores canónicos: uno por customer del catálogo, cacheados en embeddings.json.
2. Al extraer, se vectoriza `facility` y se calcula coseno contra todos los canónicos.
3. Se ordenan. Se toman los 3 primeros.
4. Si el primero comparte ciudad con la observación → candidato fuerte.
5. Si el primero NO comparte ciudad pero el segundo sí, y la diferencia de puntaje es < 0.08 → se propone el segundo.
6. Si el mejor puntaje < 0.75 → se propone "cliente nuevo".
7. La interfaz muestra los 3 con nombre, ciudad y puntaje. El usuario elige o confirma "nuevo".
```
Razón medida: la similitud entre "Hospital DemoCare North" y "Hospital DemoCare Metro North" es 0.912 y el margen correcto fue 0.05. Cualquier umbral fijo los funde. La ciudad desempata.

**query.ts** — pregunta en español a filtro.
```ts
const QUERY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['country', 'city', 'modality', 'brand', 'minAge', 'maxAge', 'status', 'confidence', 'text'],
  properties: {
    country:    { type: ['string', 'null'] },
    city:       { type: ['string', 'null'] },
    modality:   { type: ['integer', 'null'], minimum: 0, maximum: 6 },
    brand:      { type: ['integer', 'null'], minimum: 0, maximum: 5 },
    minAge:     { type: ['number', 'null'] },
    maxAge:     { type: ['number', 'null'] },
    status:     { type: ['integer', 'null'], minimum: 0, maximum: 3 },
    confidence: { type: ['integer', 'null'], minimum: 0, maximum: 2 },
    text:       { type: ['string', 'null'] }
  }
};
```
Mismos `generationParams`. Prompt en `prompts.ts` con los índices del catálogo y cinco ejemplos. **Se mide contra las 10 consultas del Anexo F antes de conectarla al renderer.** Criterio para conectarla: 7 de 10 o más. Si no llega, la barra de consulta se declara trabajo futuro y el tablero queda con filtros manuales, que ya existen.

---

## 6. Arquitectura del frontend

### Pantalla única, tres zonas, misma disposición que FieldLens v1
| Zona | Componente | Qué ve el usuario |
|---|---|---|
| Cabecera | Header + Stats | Logo, "FieldLens", indicador de modelos cargados, 4 métricas |
| Zona 1 · Captura | Capture | Textarea con la nota, botón Dictar/Detener, botón Interpretar, estado |
| Zona 2 · Revisión | Review → EquipmentRow × N, EvidenceHighlight, FollowUp, DuplicateAlert | Una fila por equipo, cada una editable, con la cita resaltada en el texto original. Pregunta sugerida. Candidatos de duplicado. Botón Confirmar y guardar. |
| Zona 3 · Base instalada | Dashboard → QueryBar, filtros, DataTable, Charts | Barra "Pregunta en español", chip con la interpretación, tabla por equipo, tres gráficos de barras |

### Jerarquía
```
App
├─ Header (estado de modelos)
├─ Stats (observaciones · clientes · equipos 7+ años · filas con baja confianza)
├─ Capture
├─ Review
│   ├─ EvidenceHighlight (rawText con <mark> por cada evidence)
│   ├─ EquipmentRow × N (editable, badge de confianza y estado)
│   ├─ FollowUp (una pregunta, desde missingFields[0])
│   └─ DuplicateAlert (3 candidatos con ciudad y puntaje, o "cliente nuevo")
└─ Dashboard
    ├─ QueryBar (input + chip "Interpretado como: país=Panamá, modalidad=MR, edad≥7")
    ├─ Filtros manuales (país, modalidad) — se conservan de v1
    ├─ DataTable (una fila por Equipment, columnas: sitio, ciudad, país, modalidad, cantidad, marca, edad, confianza, estado)
    └─ Charts (equipos por modalidad · por país · por rango de antigüedad 0-3 / 4-7 / 8+)
```

### Estado
- `observations: Observation[]` en App, cargado con `obs:list` al montar.
- `draft: Observation | null` — el resultado de extracción en revisión.
- `filter: QueryFilter` — aplicado a la tabla y los gráficos. Lo escriben tanto QueryBar como los filtros manuales.
- `modelStatus` — sondeado cada 2 s hasta que los tres estén `ready`.
- Sin librería de estado. `useState` + `useMemo` bastan.

### Estados de espera, obligatorios
La extracción tarda ~12 s. La interfaz **nunca** muestra un spinner genérico:
- Zona 2 muestra un esqueleto de fila que se rellena. Mientras el stream llega, el texto crudo del JSON compacto NO se muestra; se muestra "Leyendo la nota… identificando equipos…".
- Barra de progreso indeterminada con el texto "Gemma 2B · local · sin red".
- Si supera 30 s, se muestra "Está tardando más de lo normal" con botón Cancelar.

### Accesibilidad, no negociable
- Todo control operable por teclado. Foco visible (ya existe `outline` en v1, se conserva).
- Contraste mínimo 4.5:1 en texto. Los tokens de v1 cumplen.
- Cada `input` con `label` asociado. Cada botón con texto, no solo icono.
- La grabación anuncia su estado en un `aria-live="polite"`.
- Los gráficos llevan tabla equivalente accesible (la DataTable ya lo es).

---

## 7. Sistema de diseño

Se conserva el de FieldLens v1. Está en `src/renderer/src/assets/base.css` y `main.css`. Solo se pule.

### Colores
| Rol | Hex | Uso |
|---|---|---|
| Primario | `#0076ce` `--philips-blue` | Botones, acentos, borde inferior de cabecera |
| Primario profundo | `#004b93` `--philips-deep-blue` | Títulos, hover, fondo del logo |
| Cielo | `#eaf6fd` `--philips-sky` | Fondo de cabecera de tabla, badge "100% local" |
| Tinta | `#162b3d` `--ink` | Texto principal |
| Apagado | `#5b6f7f` `--muted` | Texto secundario, etiquetas |
| Línea | `#d8e5ed` `--line` | Bordes |
| Fondo | `#f5f9fc` | Página |
| Superficie | `#ffffff` | Tarjetas y secciones |
| Alerta | `#f5a623` sobre `#fff8e5` | `aside` de pregunta y duplicado (existe en v1) |
| **Nuevo** Confianza alta | `#1c6b47` sobre `#dcede3` | Badge High |
| **Nuevo** Confianza media | `#8a5a0c` sobre `#f5e8d2` | Badge Medium |
| **Nuevo** Confianza baja / evidencia inválida | `#9e362b` sobre `#f5e1de` | Badge Low, fila con cita que no es substring |
| **Nuevo** Marca de evidencia | `#fff3b0` | Fondo del `<mark>` en EvidenceHighlight |

### Tipografía
Arial / Helvetica, la del sistema, ya definida en v1. No se agregan fuentes: la app corre offline y cargar Google Fonts violaría el espíritu del reto. Escala: h1 36px/700, h2 19px/700, cuerpo 14px, etiquetas 12px/700, tabla 13px.

### Componentes
- Radio 4px controles, 8px tarjetas. Sombra `0 2px 8px rgb(0 75 147 / 6%)`. Ya existe.
- Badges: `border-radius: 3px`, `font-size: 11px`, mayúsculas, `letter-spacing: .06em`.
- Densidad: la actual de v1. Es una herramienta de trabajo, no una landing.

### Uso del logo de Philips
Philips es el patrocinador del track y su brief pide un prototipo para Philips. El logo ya está en `assets/philips-logo.svg` y se conserva en la cabecera. **Obligatorio:** pie de página fijo con el texto "Prototipo del equipo Jajanken para el reto Philips · Hackathon ISD Summit 2026 · No es un producto oficial de Philips". Evita que la app se lea como producto de la marca.

---

## 8. Privacidad y ejecución local

Reemplaza a "Autenticación". No hay usuarios ni sesiones. Hay una sola garantía que vender y demostrar.

### Garantía
Ninguna consulta, audio, texto ni dato derivado sale de la máquina. Los tres modelos corren en proceso local vía QVAC. El almacenamiento es un archivo en el perfil del usuario.

### Cómo se demuestra en el video
1. Se muestra el WiFi apagado en la barra de Windows.
2. Se ejecuta el ciclo completo.
3. Se muestra el Monitor de recursos de Windows con la pestaña Red del proceso FieldLens en cero.

### Cómo se demuestra en el README
Sección "Verificación de ejecución local" con los tres pasos anteriores y con la instrucción para el juez: `netstat -b` durante el uso, o el propio Monitor de recursos.

### Datos
Solo sintéticos. Los 20 de Philips son ficticios por declaración de Philips. Los 10 de Panamá son ficticios por declaración nuestra, con aviso dentro del archivo y en la interfaz (sección "Acerca de"). Ningún nombre corresponde a una institución real.

---

## 9. Orden de construcción

Hora de referencia: Panamá. Hoy es miércoles 9 de septiembre, 14:40. Entrega viernes 11, 08:00. **Quedan 41 horas.** Reservadas 6 horas intocables al final para video y README, más 4 de colchón.

Cada bloque tiene dueño, entregable y verificación. Un bloque no se da por cerrado sin su verificación.

### Bloque 0 · Descalificación · mié 15:00–16:00 · Josué + Diego
Sin esto, nada de lo demás cuenta.
1. **Cerrado, lo lleva Diego.** El acceso del repo `pixeltabletop/jajanken-hackathon` para el jurado queda a cargo de Diego. No es tarea de Josué ni del agente constructor.
2. Josué sube `~/personal/jajanken` al repo como rama `motor`, con `git remote add origin`. Diego sube `Proyecto/` como rama `app`. Se crea `main` vacío con README.
3. Josué escribe a la organización: confirmación de inscripción del equipo Jajanken en Track 01, regla de un track por equipo frente al texto de Track 05, y a quién dar acceso al repo.
4. README inicial en `main` con la sección **"Bases preexistentes"** escrita: FieldLens v1 de Diego Laverde y banco de mediciones de Josué Carrillo, ambos del 9 de septiembre, ambos del equipo. Aunque sea del propio equipo, se declara.
5. **Verificación:** Diego hace un cambio de una línea en `main`, Josué lo baja, cambia otra línea, la sube, Diego la ve. Si esto falla, se resuelve antes de seguir.

### Bloque 1 · Voz real y guion · mié 16:00–18:00 · Diego graba, Josué mide
1. Diego graba las 10 notas de `data/seed-panama.json` con su micrófono, en su laptop, en un lugar con ruido normal de casa. WAV 16 kHz mono si puede, si no, lo que salga y Josué convierte. Las sube a `bench/audio-real/`.
2. Josué corre `bench_asr.js` con `WHISPER_BASE_Q8_0 es+prompt` sobre ese audio.
3. **Decisión de la voz, 18:00:** si hospitales ≥ 7/10 y números ≥ 15/19 → voz vive. Si no → voz se declara trabajo futuro, el botón Dictar se oculta, y el bloque 7 desaparece. Se anota en `DECISIONES.md`.
4. Diego escribe `docs/GUION-VIDEO.md` con el esqueleto del Anexo B, cronometrado con reloj, leyendo en voz alta. Meta: 4:30. Cada pantalla que el guion no muestra, no se construye.
5. **Verificación:** número de hospitales reconocidos con voz real anotado en `DECISIONES.md`. Guion con tiempos por escena.

### Bloque 2 · Motor en el proceso principal · mié 18:00–23:00 · Josué
1. `npm install @qvac/sdk@0.19.0` en la rama `app`. Verificar que `npm run dev` sigue arrancando.
2. Crear `src/shared/types.ts` y `src/shared/catalog.ts` con las entidades de la Sección 4.
3. Crear `src/main/qvac/models.ts`, `prompts.ts`, `extract.ts`, `transcribe.ts`, `dedup.ts` portando la lógica de `bench7.js`, `bench_asr.js`, `bench_embed.js`. Sin Electron: cada módulo exporta funciones puras que reciben `modelId`.
4. Script `scripts/smoke-engine.mjs` que, **sin abrir Electron**, carga los tres modelos y corre una extracción, una transcripción sobre `bench/audio/es_01.wav` y una deduplicación. Imprime tiempos.
5. `src/main/ipc.ts` con los handlers de la Sección 5. `src/main/index.ts` queda en bootstrap.
6. **Verificación:** `node scripts/smoke-engine.mjs` termina sin error y la extracción de la nota 1 de Panamá devuelve 2 equipos con `evidence` válida. Tiempos anotados.

### Bloque 3 · Datos y almacén · jue 08:00–11:00 · Josué construye, Diego revisa datos
1. `scripts/convert-philips-seed.mjs` → `data/seed-philips.json`. Diego valida a ojo contra el xlsx que los 20 registros están.
2. `data/catalog.json` con customers unidos.
3. `src/main/store.ts`: cargar, sembrar si vacío, guardar, cachear embeddings.
4. `embeddings.json` precalculado para los 23 clientes semilla en el primer arranque.
5. **Verificación:** `obs:list` devuelve 23 observaciones. `obs:dedup` con "DemoCare Metro North en Quito" devuelve Hospital DemoCare Metro North primero.

### Bloque 4 · Renderer · jue 11:00–15:00 · Josué
1. Refactor de `App.tsx` en los componentes de la Sección 3. Una responsabilidad por archivo, máximo 200 líneas.
2. `Review` con `EquipmentRow` × N y `EvidenceHighlight`. Edición inline de cada campo. Badge de confianza por fila.
3. `DataTable` por equipo. `Charts` con tres gráficos.
4. Estados de espera de la Sección 6.
5. Si la voz vive: `audio/wav-recorder.ts` con Web Audio API, `AudioContext({ sampleRate: 16000 })`, `ScriptProcessorNode` o `AudioWorklet`, acumula Float32, al detener empaqueta WAV PCM 16-bit mono y lo manda por `audio:transcribe`. Se elimina `ffmpeg` y el webm.
6. **Verificación:** ciclo completo en pantalla con la nota 1 de Panamá tecleada: extraer, ver 2 filas con citas resaltadas, guardar, ver la tabla crecer. Si la voz vive: lo mismo dictando.

### Bloque 5 · Pregunta en español · jue 15:00–17:00 · Josué
1. `src/main/qvac/query.ts` con `QUERY_SCHEMA` y prompt.
2. `bench/bench_query.js` con las 10 consultas del Anexo F. Correr. Anotar.
3. **Puerta:** ≥ 7/10 → conectar `QueryBar`. < 7/10 → una iteración de prompt de 30 minutos máximo, volver a medir. Si sigue por debajo, declarar trabajo futuro.
4. `QueryBar` con chip "Interpretado como" mostrando el filtro en palabras. El usuario ve qué entendió el modelo antes de confiar en la tabla.
5. **Verificación:** "hospitales en Panamá con resonadores de más de siete años" filtra la tabla a las filas correctas y el chip lo dice en palabras.

### Bloque 6 · Deduplicación y seguimiento en pantalla · jue 17:00–19:00 · Josué
1. `DuplicateAlert` con los 3 candidatos, ciudad, puntaje, botón "Es este" / "Es nuevo".
2. `FollowUp` con la pregunta desde `missingFields[0]`, texto en español por campo.
3. `facilityCanonical` se fija al elegir. Stats cuenta clientes por canónico.
4. **Verificación:** dictar o teclear "Estoy en DemoCare Pacific" propone Hospital DemoCare Pacific, Panama City. Teclear "Hospital Nuevo Sol, Colón" propone "cliente nuevo".

### Bloque 7 · Empaquetado y perfil limpio · jue 19:00–21:00 · Josué construye, Diego prueba
1. `npm run build:win`. Instalar en un usuario de Windows **nuevo** de la laptop de Diego, sin `.qvac` previo.
2. Correr "Instalar modelos QVAC offline.cmd" con los tres modelos actuales (Gemma 3.4 GB, Whisper Base ~150 MB, EmbeddingGemma ~330 MB). Actualizar el .cmd y la carpeta `Modelos QVAC`.
3. Abrir la app, esperar carga, correr el ciclo completo con WiFi apagado.
4. **Verificación:** funciona en el usuario limpio sin internet. Captura de pantalla del Monitor de recursos con red en cero, guardada en `docs/evidencia-offline.png`.

### Bloque 8 · Video y README · jue 21:00 – vie 03:00 · Diego graba y edita, Josué escribe
Seis horas. **No se toca código después de las 21:00 salvo bloqueo total de la demo.**
1. App precargada un minuto antes de grabar. Grabación con OBS o la grabadora de Windows, 1080p, micrófono de Diego.
2. Se sigue `GUION-VIDEO.md`. Se graba por escenas. Máximo 5:00, meta 4:30.
3. Josué escribe README completo (Anexo C): qué es, bases preexistentes, hardware, instalación, modelos y cuantizaciones, cómo reproducir el banco, verificación offline, limitaciones, trabajo futuro, licencias.
4. `npm run bench:all` una vez desde el repo limpio para confirmar que los scripts corren desde su ubicación final.
5. Video subido a YouTube como "no listado" o Drive con enlace público. Enlace en el README, primera línea.
6. **Verificación:** una tercera persona, con otra cuenta de GitHub, abre el repo y el video sin credenciales.

### Bloque 9 · Colchón y entrega · vie 03:00–07:00
1. Revisión final del README por Diego con ojos frescos.
2. Etiqueta `git tag entrega-v1`. Push.
3. Formulario de entrega de la organización, si existe, antes de las 07:00. **No a las 07:59.**
4. **Verificación:** enlace del repo y del video abren desde un teléfono sin sesión.

### Qué se corta primero si el tiempo no alcanza, en este orden
1. Gráficos: quedan tabla y stats.
2. Pregunta en español: quedan filtros manuales.
3. Deduplicación en pantalla: queda la detección exacta de v1.
4. Voz: queda texto.
Nunca se corta: evidencia resaltada, filas por equipo, README con declaración, video.

---

## 10. Entorno

### Requisitos
- Windows 10 o superior, x64.
- Node.js ≥ 22.17. Ambas laptops tienen 24.x.
- Vulkan 1.4 presente en `C:\Windows\System32\vulkan-1.dll`. Ambas laptops lo tienen.
- RAM ≥ 8 GB. Ambas tienen 15.6.
- Disco ≥ 6 GB libres para modelos.
- Micrófono, si la voz vive.

### Variables de entorno
| Variable | Valor | Para qué |
|---|---|---|
| `QVAC_RPC_INIT_TIMEOUT_MS` | `240000` | El default de 30 s no alcanza en Windows en frío. Se fija en código, no hace falta exportarla. |
| `QVAC_CONFIG_PATH` | `./qvac.config.json` | Logger en `error` para no ensuciar la consola. |

No hay claves de API. No hay secretos. No hay `.env`.

### Arranque
```bash
git clone <repo>
cd jajanken-hackathon
npm install
# Modelos: o se descargan solos al primer arranque con internet, o se copian con el .cmd desde USB
npm run dev
```

---

## 11. Dependencias

### Producción
| Paquete | Versión | Uso |
|---|---|---|
| `@qvac/sdk` | 0.19.0 | Inferencia local. Trae Bare runtime y addons. |
| `react`, `react-dom` | 19.2 | Interfaz |
| `recharts` | 3.10 | Gráficos |
| `zod` | 4.5 | Validación de la salida del modelo |
| `xlsx` | 0.18 | Solo el script de conversión de la semilla |
| `@electron-toolkit/preload`, `@electron-toolkit/utils` | actuales | Ya en v1 |

### Desarrollo
Las de v1: electron 39, electron-vite 5, electron-builder 26, typescript 5.9, vite 7, eslint 9, prettier 3.

### Se elimina
- Dependencia implícita de `ffmpeg` en el PATH. Sustituida por captura WAV en el renderer.

---

## 12. Empaquetado y entrega al jurado

### Qué recibe el jurado
1. **Repositorio** accesible. Rama `main`, etiqueta `entrega-v1`.
2. **Video** ≤ 5 min, enlace sin credenciales, primera línea del README.
3. Dentro del repo: `bench/` reproducible, `docs/`, `data/`, instalador NSIS en Releases del repo de GitHub (el .exe pesa ~210 MB; **no se commitea**, se sube a Releases).

### Instalador
- `npm run build:win` produce `dist/philips-installed-base-1.0.0-setup.exe`. Renombrar `productName` a `FieldLens` en `electron-builder.yml`. Un solo ejecutable, no dos.
- Los modelos NO van dentro del instalador. Se descargan al primer arranque, o se instalan con el .cmd desde la carpeta `Modelos QVAC` que Diego lleva en USB al evento el viernes.
- `asar: false` se conserva porque los addons nativos de QVAC lo requieren.

### Perfil limpio
La prueba del Bloque 7 en un usuario de Windows nuevo es la única evidencia de que un juez puede instalarlo. Sin esa prueba no se entrega.

---

## 13. Estrategia de pruebas

No hay tiempo para suites. Hay tres capas que sí se hacen.

### Banco de mediciones, reproducible
`package.json` añade:
```json
"bench:extract": "node bench/bench7.js GEMMA4_2B_MULTIMODAL_Q4_K_M es nocache",
"bench:asr":     "node bench/bench_asr.js WHISPER_BASE_Q8_0 es+prompt",
"bench:embed":   "node bench/bench_embed.js EMBEDDINGGEMMA_300M_Q8_0",
"bench:query":   "node bench/bench_query.js",
"bench:all":     "npm run bench:extract && npm run bench:asr && npm run bench:embed && npm run bench:query"
```
Cada script escribe su JSON en `bench/`. El README explica cómo correrlo y qué números esperar con qué hardware.

### Humo del motor sin Electron
`scripts/smoke-engine.mjs`. Se corre después de cada cambio en `src/main/qvac/`.

### Ciclo manual guionado
Los 10 casos de `data/seed-panama.json` tecleados uno a uno en la app, con checklist en `docs/GUION-VIDEO.md`: filas correctas, citas resaltadas, duplicado propuesto, tabla actualizada. Diego lo corre en el Bloque 7.

### Prueba de evidencia, automática en la app
Cada `evidence` se valida como substring de `rawText` antes de guardar. Es la única prueba que corre en producción, y es la que sostiene la narrativa.

---

## 14. Skills durante el build

Skills instaladas en el entorno de Josué que aplican.

| Skill | Cuándo | Para qué |
|---|---|---|
| `superpowers:systematic-debugging` | Cualquier fallo del SDK en los bloques 2 a 7 | Antes de tocar código. Los tres errores de configuración de esta semana se habrían encontrado más rápido así. |
| `superpowers:verification-before-completion` | Al cerrar cada bloque | Nadie declara un bloque cerrado sin correr su verificación. |
| `checkpoint` | Al final de cada bloque | Guardar el estado en Contexto-IA para poder limpiar contexto y retomar. |
| `sincronizar-contexto` | Bloque 9 | Cerrar el proyecto en la bitácora. |
| `codex:codex-rescue` | Si un bloque del renderer se atasca más de 45 min | Segunda opinión de implementación. |
| `aprende` | Después de la entrega | Hay al menos cuatro lecciones de QVAC que van a Contexto-IA. |

No se usan skills de diseño. El sistema visual ya está definido en la Sección 7.

---

## 15. CLAUDE.md para el repositorio

```markdown
# FieldLens · Jajanken

App de escritorio Windows que convierte notas de campo de técnicos en registros
estructurados de equipo médico, con IA 100% local vía QVAC. Hackathon ISD Summit
2026, Track 01 Philips. Entrega viernes 2026-09-11 08:00 Panamá.

Leer `docs/BLUEPRINT.md` antes de tocar nada. Es la fuente de verdad del diseño.
Leer `DECISIONES.md` para saber qué ya se decidió. Si no está ahí, no se decidió.

## Comandos
- `npm run dev` — Electron en desarrollo con recarga
- `npm run build:win` — instalador NSIS en dist/
- `npm run typecheck` — TypeScript node + web
- `node scripts/smoke-engine.mjs` — carga los 3 modelos y corre 1 extracción, 1 transcripción, 1 dedup, sin Electron
- `npm run bench:all` — reproduce el banco de mediciones, escribe bench/*.json

## Stack
Electron 39 + electron-vite 5 + React 19 + TypeScript 5.9 + @qvac/sdk 0.19 + Recharts 3 + Zod 4. Sin backend. Sin red.

## Modelos, exactos
- Extracción: `GEMMA4_2B_MULTIMODAL_Q4_K_M`, `modelConfig: { ctx_size: 4096 }`
- Voz: `WHISPER_BASE_Q8_0`, `modelConfig: { language: 'es', translate: false, no_timestamps: true, initial_prompt: <catálogo> }`
- Embeddings: `EMBEDDINGGEMMA_300M_Q8_0`
- Generación siempre: `{ temp: 0, seed: 42, top_k: 1 }`. Siempre `responseFormat: json_schema`. Nunca `json_object`.
- `process.env.QVAC_RPC_INIT_TIMEOUT_MS = '240000'` antes de cargar.

## Arquitectura
- `src/shared/` — tipos y catálogo, únicos, importados por main y renderer.
- `src/main/qvac/` — un módulo por capacidad, funciones puras que reciben modelId. Sin Electron dentro.
- `src/main/ipc.ts` — handlers, delegan. `index.ts` solo bootstrap.
- `src/main/store.ts` — único acceso a disco.
- `src/renderer/` — React. Nunca importa @qvac/sdk. Todo por window.api.
- Flujo: renderer → IPC → qvac/* → resolver → Zod → store → renderer.

## Reglas de código
1. Un componente por archivo, máximo 200 líneas. App.tsx solo compone.
2. Tipos en `src/shared/types.ts`. No duplicar `Observation` en main y renderer como hacía v1.
3. Toda salida del modelo pasa por Zod antes de tocar el estado.
4. `evidence` se valida como substring de `rawText`. Si falla, `confidence: 'Low'` y se resalta.
5. Sin `kvCache` en extracciones. Cada nota es independiente.
6. Sin `Number(x) || fallback`. Un cero legítimo no es falsy para nosotros. Usar `??`.
7. Nunca inventar confianza por defecto. Si el modelo no la da, la fila es `Low`.
8. Sin dependencias del PATH del sistema. Si hace falta un binario, se empaqueta o no se usa.
9. Cambiar un prompt obliga a correr `npm run bench:extract` o `bench:query` y anotar en DECISIONES.md.
10. Español en la interfaz y en `evidence`. Inglés en los valores de catálogo (MR, CT, High, Reported).

## Diseño
Tokens en `src/renderer/src/assets/base.css`. Primario #0076ce, profundo #004b93,
cielo #eaf6fd, tinta #162b3d, apagado #5b6f7f, línea #d8e5ed. Arial. Radio 4/8 px.
Badges de confianza: High #1c6b47/#dcede3, Medium #8a5a0c/#f5e8d2, Low #9e362b/#f5e1de.
Pie fijo: "Prototipo del equipo Jajanken para el reto Philips · No es un producto oficial de Philips".

## Reglas no negociables
1. Cero llamadas de red para inferencia. Cero. Descalifica.
2. README declara bases preexistentes: FieldLens v1 (Diego) y bench/ (Josué). Omitirlo descalifica.
3. Solo datos sintéticos. Los 10 sitios de Panamá son ficticios y se dice en la app.
4. No se toca código después del jueves 21:00 salvo que la demo no arranque.
5. Ningún bloque se cierra sin su verificación del BLUEPRINT.
```

---

## 16. Reglas no negociables

1. **Inferencia local o nada.** Ninguna llamada a API de IA. Es la regla del hackathon y no admite matices.
2. **Declarar las bases preexistentes en el README.** Las dos. Aunque sean del propio equipo.
3. **Repositorio y video accesibles sin credenciales** antes de las 07:00 del viernes, verificado desde una cuenta ajena.
4. **Datos sintéticos únicamente.** Ningún nombre de institución real con inventario inventado.
5. **`json_schema`, `temp: 0`, `seed: 42`, `ctx_size: 4096`, `language: 'es'`.** Son las cinco configuraciones que las mediciones demostraron. No se cambian sin volver a medir.
6. **Evidencia por fila, validada como substring.** Es el diferenciador. Se corta cualquier otra cosa antes.
7. **Una `Observation` tiene N `Equipment`.** El modelo plano de v1 no puede representar el primer caso oficial de Philips.
8. **Nunca inventar un valor por defecto que parezca dato.** Ni confianza 0.65, ni marca, ni edad.
9. **La caché de contexto no se usa en extracciones.** Acumula y desborda.
10. **Después del jueves 21:00 solo se graba y se escribe.**

---

## Anexo A · Lecciones de QVAC medidas esta semana

Cada una tumbó una prueba antes de arreglarse. Van en el README como "Notas para quien construya sobre QVAC en Windows".

| # | Síntoma | Causa | Arreglo |
|---|---|---|---|
| 1 | `RPC_INIT_TIMEOUT` al cargar el primer modelo | El worker tarda más de 30 s en arrancar en Windows en frío | `QVAC_RPC_INIT_TIMEOUT_MS=240000` |
| 2 | Whisper devuelve inglés desde audio en español | Sin `language`, autodetecta y traduce | `modelConfig.language: 'es'`, `translate: false` |
| 3 | Whisper destroza nombres propios (0/10) | Vocabulario desconocido | `initial_prompt` con la lista de clientes y marcas → 9/10 |
| 4 | Modelo divaga 874 tokens y no entrega JSON | Sin restricción de salida | `responseFormat: json_schema`. TTFT de 11.7 s a 0.5 s |
| 5 | Mismo prompt, respuestas distintas cada vez | Muestreo aleatorio por defecto | `temp: 0, seed: 42, top_k: 1` |
| 6 | `CONTEXT_OVERFLOW` a la sexta extracción | `ctx_size` default 1024 + `kvCache` compartido acumulando | `ctx_size: 4096`, sin kvCache entre notas |
| 7 | Modelo inventa cantidad 1 donde debía ser 0 | Esquema con `minimum: 1` obliga a emitir algo | Las negaciones se resuelven por prompt, no por esquema. Regla explícita "si no lo vio, no crees fila" |
| 8 | Posiciones de caracter de la cita son basura | Los modelos no cuentan caracteres | Cita textual, validada con `includes` |
| 9 | 600M produce JSON válido y datos inventados | Modelo demasiado pequeño | Piso 1.7B–2B. La forma válida no es señal de verdad |
| 10 | Traducir ES→EN antes de extraer empeora | Traductor genérico destroza vocabulario médico ("ecógrafos" → "sludders") | Extraer directo en español con Gemma |

---

## Anexo B · Esqueleto del guion de video (meta 4:30)

| Escena | Tiempo | Qué se ve | Qué se dice |
|---|---|---|---|
| 1 | 0:00–0:25 | Barra de Windows, WiFi apagado. App abierta, modelos en verde. | El problema en una frase: lo que el técnico ve en el hospital se queda en su cabeza. |
| 2 | 0:25–1:15 | Diego dicta una nota de Panamá. Transcripción aparece. | Todo esto corre en esta laptop. Nombres del hospital reconocidos porque la app conoce su cartera. |
| 3 | 1:15–2:15 | Interpretar. Espera con progreso. Dos filas aparecen con las citas resaltadas en el texto. | El sistema no inventa. Cada dato apunta a las palabras exactas que lo justifican. La marca desconocida queda desconocida. |
| 4 | 2:15–2:45 | Alerta de duplicado con tres candidatos y ciudad. Se elige. Guardar. | Dos técnicos, dos formas de decir el mismo hospital, un solo registro. |
| 5 | 2:45–3:45 | Tablero. Se escribe "hospitales en Panamá con tomógrafos de más de diez años". Chip muestra la interpretación. Tabla y gráfico filtran. | Preguntarle a la base en español, sin SQL, sin nube. |
| 6 | 3:45–4:15 | Monitor de recursos, red en cero. Carpeta bench/ con los JSON. | Esto es lo que medimos y cómo lo reproduce cualquiera. Ocho de diez en español, y el sistema sabe cuáles son los dos. |
| 7 | 4:15–4:30 | Pantalla de límites y trabajo futuro. Logo. | Móvil y foto de etiqueta quedan para después. Gracias. |

---

## Anexo C · Esqueleto del README

```
# FieldLens — Inteligencia de base instalada, 100% local
[Video de demostración](enlace)  ·  Equipo Jajanken  ·  Track 01 Philips  ·  ISD Summit 2026

## Qué es
## Bases preexistentes  ← OBLIGATORIO, primera sección después de Qué es
   - FieldLens v1, Diego Laverde, 2026-09-09: app Electron con captura, extracción y tabla.
   - Banco de mediciones QVAC, Josué Carrillo, 2026-09-09: bench/ con 23 corridas.
   - Datos: workbook sintético de Philips (referencia/), 10 observaciones ficticias propias (data/seed-panama.json).
## Hardware donde se midió y se grabó
## Modelos, cuantizaciones y configuración exacta
## Instalación (con internet / sin internet con USB)
## Verificación de ejecución local
## Cómo reproducir el banco de mediciones y qué esperar
## Resultados medidos (tabla de la Sección 1)
## Limitaciones conocidas (8/10, caso de edades mixtas, 12 s por nota, español mejor que inglés en Whisper Base)
## Trabajo futuro (móvil vía Expo, foto de etiqueta con Gemma multimodal, sincronización)
## Notas para construir sobre QVAC en Windows (Anexo A)
## Licencias (MIT propio; Electron, Chromium, modelos Apache-2.0)
## Aviso: prototipo del equipo Jajanken para el reto Philips. No es un producto oficial de Philips.
```

---

## Anexo D · Datos de Panamá: solo sitios ficticios

Decisión cerrada (D12): los 10 sitios de `data/seed-panama.json` son ficticios, con nombres de la convención DemoCare de Philips, ubicados en nueve ciudades reales de Panamá. **No se usa ninguna institución real en ningún dato ni en la interfaz.** El brief de Philips pide clientes ficticios, y atribuir inventario inventado a una institución real, aunque lleve nota, viola ese guardarraíl frente al mismo jurado que lo escribió. El archivo lleva el aviso dentro y la app lo muestra en "Acerca de".

---

## Anexo E · Ejemplo de Observation, formato final

```json
{
  "id": "pa-01",
  "createdAt": "2026-09-01",
  "observer": "Técnico de campo PA-01",
  "source": "Voice",
  "language": "es",
  "rawText": "Estoy en el Hospital DemoCare Bella Vista, en Ciudad de Panamá. Tienen dos resonadores NovaMed de unos seis años y un tomógrafo Aurelia Health que se ve nuevo, como de tres años.",
  "facility": "Hospital DemoCare Bella Vista",
  "facilityCanonical": "Hospital DemoCare Bella Vista",
  "city": "Ciudad de Panamá",
  "country": "Panamá",
  "equipment": [
    { "modality": "MR", "quantity": 2, "quantityIsEstimate": false, "brand": "NovaMed", "model": null,
      "approxAgeYears": 6, "ageQualitative": null, "installYearEstimate": 2020,
      "confidence": "High", "status": "Reported",
      "evidence": "dos resonadores NovaMed de unos seis años", "notes": null },
    { "modality": "CT", "quantity": 1, "quantityIsEstimate": false, "brand": "Aurelia Health", "model": null,
      "approxAgeYears": 3, "ageQualitative": "new", "installYearEstimate": 2023,
      "confidence": "Medium", "status": "Estimated",
      "evidence": "un tomógrafo Aurelia Health que se ve nuevo, como de tres años", "notes": null }
  ],
  "missingFields": ["model"],
  "reviewed": true
}
```
Nota: `data/seed-panama.json` usa `snake_case` por venir del banco. El script de carga del Bloque 3 lo normaliza a `camelCase` y añade `facilityCanonical`, `installYearEstimate` y `reviewed: true`.

---

## Anexo F · Diez consultas para medir la pregunta en español

Cada una con el `QueryFilter` esperado. Se puntúa igual que la extracción: correcto si todos los campos no nulos coinciden y ningún campo inventado.

| # | Pregunta | Filtro esperado |
|---|---|---|
| 1 | hospitales en Panamá con resonadores | country=Panamá, modality=MR |
| 2 | tomógrafos de más de diez años | modality=CT, minAge=10 |
| 3 | equipos Aurelia Health en Brasil | brand=Aurelia Health, country=Brazil |
| 4 | todo lo que hay en Colón | city=Colón |
| 5 | ecógrafos nuevos, de menos de tres años | modality=Ultrasound, maxAge=3 |
| 6 | registros con confianza baja | confidence=Low |
| 7 | equipos estimados, no confirmados | status=Estimated |
| 8 | resonadores viejos en México | modality=MR, country=Mexico, minAge=8 |
| 9 | qué tiene el DemoCare Chiriquí | text=DemoCare Chiriquí |
| 10 | monitores de paciente | modality=Patient Monitoring |

Nota en la 8: "viejos" sin número. El criterio de aceptación admite minAge entre 7 y 10. Se anota en el bench como rango aceptado.

---

## Anexo G · Criterios del interruptor de la voz

Se evalúa a las 18:00 del miércoles con el audio real de Diego.

| Métrica | Vive | Muere |
|---|---|---|
| Hospitales reconocidos | ≥ 7 de 10 | < 7 |
| Números correctos | ≥ 15 de 19 | < 15 |
| Tiempo por nota | ≤ 3 s | > 3 s |

Si muere: botón Dictar se oculta, README dice "captura por voz validada solo con audio sintético, trabajo futuro con voz real", el video muestra entrada por texto. No es un fracaso, es una declaración honesta que la rúbrica premia frente a una promesa rota en cámara.

---

*Fin del blueprint. Siguiente paso: Bloque 0, ahora.*
