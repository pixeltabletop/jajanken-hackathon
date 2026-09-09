# DECISIONES

Si no está aquí, no se decidió. Cada entrada: fecha, decisión, por qué, evidencia.
Cambiar una decisión exige una entrada nueva que la reemplace, no editar la vieja.

## 2026-09-09

**D01 · Track 01 Philips, un solo equipo.** La organización dijo de palabra "un track por equipo". El texto publicado de Track 05 dice lo contrario. Pendiente confirmar por escrito (Bloque 0). Si resulta acumulable, se evalúa Caja de Ahorros como segunda entrega solo si el Track 01 está cerrado el jueves 15:00.

**D02 · Adaptar FieldLens v1, no reemplazar.** Su renderer ya tiene las tres zonas, stats, duplicados y pregunta de seguimiento en español. Lo roto es el modelo de datos (un equipo por observación) y los modelos elegidos. Se reescribe `src/main/` como motor modular y se abre `Observation.equipment[]`. Evidencia: lectura de `App.tsx` y `main/index.ts` de v1.

**D03 · Modelo de extracción: `GEMMA4_2B_MULTIMODAL_Q4_K_M`.** 8/10 casos oficiales en español con esquema compacto y ctx 4096. Alternativas medidas: Qwen3 1.7B 4/10 es, Llama 3.2 1B 0/9, Qwen3 600M inventa, MedPsy se traba, traducir ES→EN 5/10. Evidencia: `bench/compacto10_GEMMA4_2B_MULTIMODAL_Q4_K_M_es.json`, `bench/philips10_*.json`, `bench/es_traducido_*.json`.

**D04 · Esquema compacto, no el de 19 campos.** Claves de una letra, catálogos como índices, cita textual. 8/10 en 12.0 s frente a 7/10 en 19.2 s. Mi primera medición del compacto dio 5/10 por caché envenenada y ctx 1024; la limpia lo confirmó mejor. Evidencia: `bench/ctx4096.log`.

**D05 · Evidencia como cita textual validada con `includes`, nunca posiciones.** Posiciones dieron `[0,10]` para "dos resonadores". Citas: 100% textuales en todas las corridas (16/16, 15/15, 17/17, 14/14). Evidencia: `bench/latencia2_*.json` vs `latencia3_*.json`.

**D06 · Voz a texto: `WHISPER_BASE_Q8_0` con `language: 'es'` e `initial_prompt` del catálogo.** 9/10 hospitales, 17% WER, 1.4 s. Tiny 0/10, Base sin vocabulario 1/10, Small 9/10 pero 4.2 s. Evidencia: `bench/asr_*.json`. **Sujeto al interruptor de las 18:00 con audio real de Diego.**

**D07 · Deduplicación: `EMBEDDINGGEMMA_300M_Q8_0`, ranking + desempate por ciudad, nunca umbral.** DemoCare North vs DemoCare Metro North: similitud 0.912, margen correcto 0.05. Un umbral los funde. Evidencia: `bench/embed_EMBEDDINGGEMMA_300M_Q8_0.json`.

**D08 · `ctx_size: 4096` en Gemma. Sin `kvCache` entre extracciones.** Default 1024 desbordó a la sexta nota con caché compartida. Evidencia: `bench/compacto10.log` (traza CONTEXT_OVERFLOW).

**D09 · Generación siempre `temp: 0, seed: 42, top_k: 1`, siempre `json_schema`.** Sin esto la misma nota da respuestas distintas. Evidencia: `bench/determinism_*.json`.

**D10 · Español en interfaz y evidencia, inglés en valores de catálogo.** Decisión de Josué. El dataset de Philips es en inglés y se conserva tal cual como semilla declarada.

**D11 · Sin mapa geográfico.** Decisión de Josué. Tablero = stats + tabla por equipo + tres gráficos de barras.

**D12 · Datos de Panamá: 10 sitios ficticios DemoCare en ciudades reales. Ninguna institución real.** Josué pidió primero instituciones reales con casos hipotéticos; el arquitecto recomendó ficticios porque el brief de Philips pide clientes ficticios. Josué lo confirmó el 9 de sep 15:30 y la lista de instituciones reales se eliminó del blueprint. Evidencia: `data/seed-panama.json`, 23/23 citas validadas.

**D16 · El acceso del repositorio para el jurado lo gestiona Diego.** Cerrado el 9 de sep 15:30 por Josué. Sale de la lista del constructor.

**D17 · Repo final = proyecto Electron de Diego como raíz.** `Proyecto/` se copia al repo de Josué (sin `dist/` ni `out/`), el banco pasa a `bench/`, `schema.js` queda en raíz para el banco, la app usa `src/shared/`. `package.json` de Diego manda, con `@qvac/sdk` subido a 0.19.0 y `name: fieldlens`.

**D18 · Motor en TypeScript con especificadores `.ts` explícitos.** Node 24 quita tipos al vuelo y así `scripts/smoke-engine.mjs` importa los módulos reales sin compilar. Requiere `allowImportingTsExtensions: true` en `tsconfig.node.json` y `tsconfig.web.json` (compatible porque el typecheck es `--noEmit` y el bundle lo hace esbuild). Sintaxis solo borrable: sin `enum`, sin propiedades de parámetro, `import type` para tipos.

**D13 · Captura de audio con Web Audio API a WAV en el renderer.** Elimina `ffmpeg`, que v1 invoca del PATH sin empaquetar y muere en máquina limpia.

**D14 · Congelación de código: jueves 10 de septiembre, 21:00.** Después solo video y README, salvo que la demo no arranque.

**D15 · Orden de recorte si falta tiempo:** gráficos → pregunta en español → dedup en pantalla → voz. Nunca se corta: evidencia resaltada, filas por equipo, README con declaración, video.

**D19 · `node_modules` nunca se copia entre máquinas, se instala con `npm ci`.** La copia con robocopy desde el SSD de Diego dejó 24,645 archivos de 34,695 sin ningún error visible (`/R:1 /W:1 /NFL` se salta lo que falla al leer). Síntomas: `tsc` no encontraba `electron-vite` con la carpeta presente, y el worker de QVAC moría al arrancar por falta de `llm-splitter` reportando un "timeout" engañoso. Regla: tras cualquier copia, comparar conteo recursivo de archivos; ante duda, `npm ci`. Aplica también a la laptop de Diego cuando baje el repo: `npm ci`, nunca copiar `node_modules`.

## Pendientes de decisión

- Voz vive o muere (18:00 hoy, Anexo G del blueprint).
- Pregunta en español se conecta o no (Bloque 5, puerta 7/10).
