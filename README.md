# MAM · Medical Asset Management

Entrega del equipo **Jajanken**.

Inteligencia de base instalada con IA **100 % local**. De la voz al dato, sin nube.

Para el **Track 01 de Philips** (Customer Installed Base Intelligence) del ISD
Summit 2026.

**▶ Video de demostración (5 min):** _pendiente de publicar._ El enlace va aquí,
en la primera línea, y abre sin pedir credenciales.

> **Aviso:** MAM · Medical Asset Management · prototipo del equipo Jajanken para el reto Philips · Hackathon ISD
> Summit 2026 · **No es un producto oficial de Philips.** Todos los clientes,
> marcas, modelos e inventarios son **inventados**, con la convención DemoCare.
> Las ciudades sí son ciudades reales de Panamá, porque el filtro geográfico
> tiene que probarse contra un mapa que existe; **ninguna institución real
> aparece en los datos ni en la interfaz** (D12).

---

## Declaración de origen del trabajo

**Declaración obligatoria del reto.** Todo lo que hay en este repositorio se
construyó **durante el hackatón**. No se partió de ninguna base preexistente
propia ni de terceros.

Cómo se hizo, en orden:

1. **Diego Laverde arrancó el proyecto** al abrir el hackatón y construyó una
   primera parte de la aplicación.
2. **Josué Carrillo construyó su parte** en paralelo: el motor de inferencia
   sobre el SDK de QVAC, el banco de mediciones y la extracción con esquema
   forzado.
3. **Las dos partes se unieron** y sobre esa unión se terminó de levantar la
   estructura que hoy está montada: modo Seguimiento, deduplicación, temas,
   verificación automatizada y empaquetado.

El historial de `git log` refleja el trabajo commit por commit, todo dentro de
la ventana del reto.

### Lo que no escribimos nosotros, y va declarado

| Qué | De dónde | Cómo se usa |
|---|---|---|
| **SDK de QVAC** (`@qvac/sdk` 0.19.0) | Tether, Apache-2.0 | Toda la inferencia. Es la pieza que el reto pide usar. |
| **Modelos** Gemma 3n E2B, Whisper Base, EmbeddingGemma 300M | Catálogo de QVAC, Apache-2.0 | Se descargan del catálogo. No están entrenados ni ajustados por nosotros. |
| **Electron y React** | Sus proyectos, MIT | El armazón de escritorio y la interfaz. Viven en `devDependencies` porque el empaquetador los incorpora al compilar, que es como funciona una aplicación de Electron. |
| **Zod** y **@electron-toolkit/utils** | Sus proyectos, MIT | Las dos únicas dependencias de producción además del SDK: validación de esquemas y utilidades de arranque de Electron. |
| **Asistencia de IA** (Claude Code, Codex) | Anthropic, OpenAI | Se usó como asistente de programación durante todo el reto, con revisión humana de cada cambio. Las decisiones de diseño y los criterios de aceptación están en `DECISIONES.md`. |
| **Marca Philips** | Philips | Solo el logotipo en la interfaz, para el contexto del reto. No es un producto oficial de Philips. Ver `LICENSE`. |

**Andamiaje declarado.** El proyecto se arrancó con el generador de
`electron-vite`, que aportó la estructura de tres procesos (principal, preload,
renderer), la configuración de compilación y un ejemplo mínimo. Todo ese ejemplo
se sustituyó: no queda ni una pantalla ni una función suyas. Lo que sobrevive es
la disposición de carpetas y `electron.vite.config.ts`. No se usó ninguna otra
plantilla, tema comprado ni componente de terceros: los gráficos, la barra
lateral y los iconos se dibujan a mano, sin librería de interfaz.

### Lo que quedó fuera por tiempo, no por diseño

Está identificado y acotado, y es por dónde crece el proyecto:

- **Búsqueda sobre documentos** (manuales de servicio, reportes en PDF) con el
  juego RAG del propio SDK, que reutiliza el modelo de embeddings ya empaquetado.
- **Lectura de la placa del equipo por foto** con el motor de OCR del SDK.
- **Dictado en streaming** con detección de fin de turno, en vez de grabar y
  transcribir al soltar.
- **Aplicación móvil.** QVAC corre en Android e iOS, pero exige compilación
  nativa en teléfono físico, que no cabía en la ventana del reto.
- **Sincronización entre equipos.** Hoy cada instalación es una isla, que es
  justo lo que hace posible la promesa de cero red.

---

## Qué es

Un técnico de campo vuelve de visitar un hospital, **dicta o escribe** lo que
vio, y la aplicación lo convierte en registros estructurados de la base
instalada. Después, cualquiera **pregunta en español** por lo ya registrado y
obtiene cifras calculadas sobre esos registros.

**El diferenciador:** cada dato extraído lleva **la cita textual de la nota que
lo justifica**, validada como subcadena antes de guardarse. Un modelo pequeño
falla en silencio y con buena letra; aquí el fallo es auditable en vez de
invisible. Si la cita no aparece en la nota, la fila baja a confianza Baja y se
marca en pantalla.

Dos puertas al abrir: **Registrar equipos** y **Seguimiento y reportes**.

---

## Inferencia: qué es local y qué no

**Toda la inferencia corre en esta computadora**, dentro del proceso principal de
Electron, con el SDK de QVAC de Tether. Verificable en el código: las únicas
llamadas de inferencia del repositorio son `sdk.loadModel`, `sdk.completion`,
`sdk.embed`, `sdk.transcribe` y `sdk.unloadModel`, todas dentro de
`src/main/qvac/`. No hay ninguna otra librería de inferencia en las dependencias,
no se usa la API de voz del navegador y no existe ni una llamada HTTP en el
código de la aplicación.

**La única salida al exterior** es `shell.openExternal('mailto:…')`, que abre el
cliente de correo del usuario cuando este pulsa "Preparar correo". La aplicación
no envía nada por su cuenta y no habla con ningún servidor.

**Matiz honesto sobre los modelos:** los pesos (unos 3,9 GB) los provisiona el
SDK de QVAC. En una máquina nueva, la **primera** puesta en marcha los descarga
por HTTP, o se instalan desde USB con el procedimiento offline. Una vez en disco,
**ni el arranque ni el uso vuelven a tocar la red**.

Esto se comprueba en dos mitades, porque ninguna sola alcanza:

| Qué se comprueba | Cómo | Alcance real |
|---|---|---|
| Que la interfaz no pide nada fuera | `node scripts/e2e-4b.mjs`, leyendo las peticiones reales del renderer | Solo el renderer. La inferencia no vive ahí. |
| Que el código empaquetado no puede pedir nada | `npm run check:sin-red`, sobre `src/main`, `src/shared` y `src/preload` | El proceso donde sí vive la inferencia. Falla si aparece `fetch`, un socket, una dirección externa u otro proveedor de IA. |

La segunda existe porque la primera no ve el proceso principal, que es
justamente el que carga los modelos y ejecuta la inferencia. La comprobación se
prueba a sí misma: metiéndole un `fetch` a propósito, falla y lo nombra.

Nada de lo que el usuario escribe, dicta o guarda sale del equipo en ningún
momento, ni siquiera la primera vez.

---

## Hardware donde se midió

HP ProBook 450 G10 · Windows 11. Todas las cifras de este README salen de esa
máquina.

## Modelos, cuantizaciones y configuración exacta

| Uso | Modelo | Configuración medida |
|---|---|---|
| Extracción | `GEMMA4_2B_MULTIMODAL_Q4_K_M` (3,4 GB) | `ctx_size: 4096`, `temp: 0`, `seed: 42`, `top_k: 1`, `json_schema`, sin caché de contexto |
| Voz a texto | `WHISPER_BASE_Q8_0` (150 MB) | `language: 'es'`, `translate: false`, `no_timestamps: true`, `initial_prompt` con el catálogo de clientes y marcas |
| Deduplicación | `EMBEDDINGGEMMA_300M_Q8_0` (330 MB) | Ranking por similitud con desempate por ciudad. **Nunca umbral** |

Cambiar cualquiera de estos parámetros invalida las cifras de abajo. Está anotado
como regla no negociable en `docs/BLUEPRINT.md`.

## Instalación

```bash
npm ci
npm run dev
npm run build:win
```

`node_modules` **nunca** se copia entre máquinas: se instala con `npm ci`. Una
copia con robocopy dejó 10.000 archivos fuera sin dar un solo error (D19).

**Sin internet.** El SDK de QVAC guarda los pesos en `%USERPROFILE%\.qvac`
(`~/.qvac` fuera de Windows), dentro de `models/` y con el índice en
`registry-corestore/`. Para una máquina sin red, se copia esa carpeta completa
desde una donde la aplicación ya haya arrancado una vez. Los tres archivos que
hacen falta son el de Gemma, el de Whisper Base y el de EmbeddingGemma; el resto
de esa carpeta son modelos de las mediciones y se pueden dejar fuera. Con la
carpeta en su sitio, la aplicación arranca sin tocar la red ni una vez.

Si `npm run dev` dice **"Electron uninstall"**, ver **D22** en `DECISIONES.md`:
con Node 24 en Windows el postinstall de Electron descarga el zip pero no lo
extrae, y hay que hacerlo a mano con `Expand-Archive`.

## Cómo reproducir la verificación

```bash
npm run check                        # tipos + tokens + contraste en los dos temas + sin red
npm run smoke                        # el motor completo, sin Electron
npm run smoke:semaforo               # el estado de los modelos no miente
npm run bench:all                    # reproduce el banco de mediciones
node scripts/e2e-4b.mjs              # 86 comprobaciones contra la app en ejecución
node scripts/check-contrast-vivo.mjs # contraste real, elemento por elemento
```

**Solo las dos últimas** necesitan la aplicación abierta con
`npm run dev -- -- --remote-debugging-port=9222`. Las demás corren solas.

### Todos los comandos

| Comando | Qué hace | Escribe archivos |
|---|---|---|
| `npm run dev` | Electron en desarrollo, con recarga del renderer | no |
| `npm run build:win` | Instalador NSIS en `dist/` | sí |
| `npm run check` | Tipos, tokens, contraste declarado y comprobación de sin red | no |
| `npm run typecheck` | Solo los tipos, de los dos proyectos | no |
| `npm run check:contrast` | Los pares de color declarados, en los dos temas | con `--md`, `docs/contraste.md` |
| `npm run check:tokens` | Que toda variable de color usada exista de verdad | no |
| `npm run check:sin-red` | Ninguna salida a la red en el código empaquetado | no |
| `npm run lint` / `npm run format` | Estilo de código | `format` sí |
| `npm run smoke` | Carga los tres modelos y corre el ciclo, sin Electron | no |
| `npm run smoke:semaforo` | Mata el motor y comprueba que el estado lo refleja | no |
| `npm run smoke:semaforo:vivo` | Lo mismo, con la aplicación abierta | no |
| `npm run bench:extract` · `:asr` · `:embed` · `:query` · `:all` | El banco de mediciones, por partes o entero | sí, `bench/*.json` |
| `npm run e2e:4b` | Las 86 comprobaciones de interfaz | sí, `bench/e2e-4b.json` y capturas |
| `npm run qvac:doctor` | Diagnóstico del SDK y del hardware | no |
| `npm run build:mac` · `:linux` · `:unpack` | Empaquetados que **no** se han probado | sí |

`build:mac` y `build:linux` vienen del andamiaje y se dejan por si sirven: la
entrega es Windows y es lo único verificado.

## Resultados medidos

| Qué | Resultado |
|---|---|
| Extracción, 10 casos oficiales de Philips en español | 8/10 |
| Citas textuales válidas | 100 % en todas las corridas |
| Pregunta en español, Anexo F del blueprint | 10/10 |
| Pregunta en español, intención y agrupación | 5/5 |
| Pregunta en español, consultas de varias condiciones | 5/5 |
| Voz: hospitales reconocidos con vocabulario sembrado | 9/10 |
| Contraste WCAG | 150/150 pares declarados · más de 9.000 textos medidos sobre la app viva en 32 estados, incluidos los de raton encima y presionado, 0 fallos |
| Verificación de la interfaz contra la app real | 86/86 |

Evidencia cruda en `bench/*.json`, capturas en `bench/e2e/`.

## Tiempos reales, arranque en frío

| Proceso | Medido |
|---|---|
| Arranque del worker de QVAC | ~20 s, lo paga el primer modelo que cargue |
| Los tres modelos, en paralelo | 49 a 61 s |
| Interpretar una nota | 14 a 23 s |
| Interpretar una pregunta | 11 a 22 s |
| Instalador | 595 MB · 3,0 GB instalado |
| Deduplicar | 0,1 a 0,5 s |
| Guardar | menos de 0,1 s |

El arranque de marca dura 5 segundos fijos y **no espera a los modelos**:
escribir y dictar funcionan desde el primer segundo, transcribir a los ~24 s e
interpretar cuando el modelo de extracción termina de cargar. Cada pantalla dice
qué puede hacer y qué todavía no.

## Limitaciones conocidas

- **La extracción acierta 8 de 10.** No se esconde: cada fila lleva su cita y la
  interfaz permite corregir antes de guardar.
- **El tipo de respuesta de una consulta falla a veces.** "Qué marcas hay en X"
  se resolvía como lista; ahora lo corrige una regla determinista sobre la frase,
  pero el modelo por sí solo no lo acierta.
- **El español funciona mejor que el inglés** en voz y en extracción. Whisper
  está fijado a español a propósito: sin fijarlo, traducía al inglés.
- **Edades mixtas dentro de una misma modalidad** siguen siendo el caso difícil.
- **El workbook de Philips se carga tal cual, con sus inconsistencias.** Su fila
  3 declara cantidad 3 marcada "Aggregate row" y la fila 4 suma 1 más, así que el
  tablero muestra 4 donde el texto dice tres. Se conserva porque es su dato
  declarado, y el aviso viaja dentro de `data/seed-philips.json`.
- **Sin mapa geográfico.** Decisión tomada (D11): tabla y gráficos.
- **El acceso no valida credenciales**, y la pantalla lo dice con esas palabras.

## Trabajo futuro

Móvil vía Expo, foto de la etiqueta con Gemma multimodal, sincronización entre
técnicos, y el mapa geográfico que el brief plantea como una de las salidas
posibles.

## Licencias

Código propio bajo MIT. Electron y Chromium bajo sus respectivas licencias.
Modelos Gemma, Whisper y EmbeddingGemma bajo Apache-2.0.

## Dónde está todo

| Qué | Dónde |
|---|---|
| Diseño, fuente de verdad | `docs/BLUEPRINT.md` |
| Decisiones con evidencia | `DECISIONES.md` |
| Contraste medido por tema | `docs/contraste.md` |
| Cambios que afectan al guion del video | `docs/GUION-VIDEO-CAMBIOS.md` |
| Mediciones crudas | `bench/` |

## Panel interno

La pestaña de tiempos por proceso está apagada para el usuario: se enciende con
**Ctrl+Alt+T** y queda guardada en ese equipo.
