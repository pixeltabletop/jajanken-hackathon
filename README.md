# MAM · Medical Asset Management

Entrega del equipo **Jajanken** para el **Track 01 de Philips** (Customer
Installed Base Intelligence) del ISD Summit 2026.

Inteligencia de base instalada con IA **100 % local**. De la voz al dato, sin
nube.

**▶ [Video de demostración (3:42)](https://drive.google.com/file/d/13pkMDdLWSLnn2YIxVTa-ASXJP9H_h4RA/view?usp=sharing)**
— abre sin pedir credenciales, comprobado sin sesión iniciada.

> **Aviso.** Prototipo para el reto Philips del Hackathon ISD Summit 2026. **No
> es un producto oficial de Philips.** Todos los clientes, marcas, modelos e
> inventarios son **inventados**, con la convención DemoCare. Las ciudades sí son
> ciudades reales de Panamá, porque el filtro geográfico tiene que probarse
> contra un mapa que existe; **ninguna institución real aparece en los datos ni
> en la interfaz.**

---

## Qué problema resuelve

La base instalada de un fabricante de equipo médico vive en la cabeza y en la
libreta del técnico de campo. Después de cada visita alguien tiene que pasar esas
notas a un sistema, y ese paso es donde el dato se pierde, se demora o se
inventa.

MAM cierra ese hueco en la propia laptop del técnico. Vuelve de un hospital,
**dicta o escribe** lo que vio, y la aplicación lo convierte en registros
estructurados de la base instalada. Después, cualquiera **pregunta en español**
por lo ya registrado y obtiene cifras calculadas sobre esos registros, no
generadas por un modelo.

**El diferenciador:** cada dato extraído lleva **la cita textual de la nota que
lo justifica**, validada como subcadena antes de guardarse. Un modelo pequeño
falla en silencio y con buena letra; aquí el fallo queda a la vista. Si la cita
no aparece en la nota, o si la marca no se dice en ella, la fila baja a confianza
Baja y se marca en pantalla.

Dos puertas al abrir: **Registrar equipos** y **Seguimiento y reportes**.

---

## Instalación

**Descarga el instalador de la última versión publicada, en la pestaña
[Releases](../../releases) de este repositorio:** `MAM-1.0.0-setup.exe`.

Es un instalador NSIS de Windows. No hace falta Node, ni Python, ni Docker, ni
instalar nada más: el ejecutable trae dentro la aplicación, el motor de
inferencia y sus dependencias.

1. Ejecuta `MAM-1.0.0-setup.exe` y sigue el asistente.
2. Abre **MAM** desde el acceso directo.
3. **La primera vez descarga los modelos** (unos 3,9 GB) y lo muestra con una
   barra de progreso. Tarda según la conexión. **Solo ocurre una vez.**
4. A partir de ahí, ni el arranque ni el uso vuelven a tocar la red.

El arranque de marca dura 5 segundos y no espera a los modelos: escribir y dictar
funcionan desde el primer segundo, transcribir a los ~24 s e interpretar cuando
el modelo de extracción termina de cargar. Cada pantalla dice qué puede hacer y
qué todavía no.

### Requisitos mínimos

Medido en un HP ProBook 450 G10 con Windows 11. Todas las cifras de este
documento salen de esa máquina.

| Requisito | Mínimo | Recomendado |
|---|---|---|
| Sistema | Windows 10 u 11, 64 bits | Windows 11, 64 bits |
| Memoria RAM | 8 GB, con **4,2 GB libres** al arrancar | 16 GB |
| Disco | 7,5 GB libres: 3,0 GB la aplicación, 3,9 GB los modelos, 0,6 GB el instalador | 10 GB |
| Procesador | x64 moderno. Corre en CPU, no exige tarjeta gráfica | — |
| Red | Solo en el primer arranque, para bajar los modelos | — |
| Micrófono | Solo si se va a dictar. Escribir la nota funciona igual | — |

La aplicación comprueba la memoria libre antes de cargar y avisa si no alcanza.
Por debajo del mínimo no falla con un error claro: se vuelve mucho más lenta, así
que conviene cerrar lo demás antes de la primera prueba.

### Instalación sin internet

Los pesos viven en `%USERPROFILE%\.qvac`, dentro de `models/` y con el índice en
`registry-corestore/`. Para una máquina sin red, se copia esa carpeta completa
desde otra donde la aplicación ya haya arrancado una vez. Con la carpeta en su
sitio, arranca sin tocar la red ni una vez.

---

## Cómo funciona

De la voz al dato, en cuatro pasos, todos en la misma máquina:

1. **Dictado.** El micrófono se captura a WAV PCM de 16 bits y 16 kHz, y se
   transcribe con Whisper. Una nota larga se **trocea por silencios** antes de
   entrar al motor, porque el modelo devuelve un fragmento por llamada.
2. **Corrección del vocabulario.** El dictado deforma lo que no conoce
   ("rayosex" por "rayos X"). Se corrige después, contra un catálogo cerrado y
   con distancia de edición, y **cada cambio se le muestra al usuario**.
3. **Extracción.** Un modelo pequeño devuelve un esquema compacto forzado por
   gramática: modalidad, cantidad, marca, edad, estado, confianza y **la cita
   textual**. El código resuelve los índices contra el catálogo y valida la
   evidencia. El modelo no elige la categoría: devuelve el texto, y el código lo
   resuelve.
4. **Consulta.** La pregunta en español se traduce a un plan de filtros y
   agrupación. **Ni una cifra la calcula el modelo**: las cuentas las hace código
   determinista sobre los registros guardados, y la frase de respuesta se arma
   por plantilla.

Entre 3 y 4 está la **deduplicación**: los nombres de sitio se comparan por
similitud de embeddings con desempate por ciudad, para que "Metro North" en Quito
no se confunda con "North" en Monterrey.

### Con qué herramientas

Toda la inferencia corre dentro del proceso principal de Electron con el **SDK de
QVAC** de Tether. Las únicas llamadas de inferencia del repositorio son
`sdk.loadModel`, `sdk.completion`, `sdk.embed`, `sdk.transcribe` y
`sdk.unloadModel`, todas dentro de `src/main/qvac/`. No hay otra librería de
inferencia en las dependencias, no se usa la API de voz del navegador y no existe
ni una llamada HTTP en el código de la aplicación.

| Uso | Modelo | Configuración |
|---|---|---|
| Extracción | `GEMMA4_2B_MULTIMODAL_Q4_K_M` (3,4 GB) | `ctx_size: 4096`, `temp: 0`, `seed: 42`, `top_k: 1`, `json_schema`, sin caché de contexto |
| Voz a texto | `WHISPER_BASE_Q8_0` (150 MB) | `language: 'es'`, `translate: false`, `no_timestamps: true`, `initial_prompt` con el catálogo de clientes y marcas |
| Deduplicación | `EMBEDDINGGEMMA_300M_Q8_0` (330 MB) | Ranking por similitud con desempate por ciudad, **nunca** umbral fijo |

Cambiar cualquiera de estos parámetros invalida las cifras de abajo.

La interfaz es Electron y React, sin librería de componentes: los gráficos, la
barra lateral y los iconos se dibujan a mano.

### Qué es local y qué no

**La única salida al exterior** es `shell.openExternal('mailto:…')`, que abre el
cliente de correo del usuario cuando este pulsa "Preparar correo". La aplicación
no envía nada por su cuenta y no habla con ningún servidor.

**Los pesos** (unos 3,9 GB) los provisiona el SDK de QVAC. En una máquina nueva,
la primera puesta en marcha los descarga por HTTP, o se instalan desde USB con el
procedimiento de arriba. Una vez en disco, ni el arranque ni el uso vuelven a
tocar la red.

Nada de lo que el usuario escribe, dicta o guarda sale del equipo en ningún
momento, ni siquiera la primera vez.

---

## Tiempos reales, arranque en frío

| Proceso | Medido |
|---|---|
| Arranque del motor local | ~20 s, lo paga el primer modelo que cargue |
| Los tres modelos, en paralelo | 49 a 61 s |
| Interpretar una nota | 14 a 23 s |
| Interpretar una pregunta | 11 a 22 s |
| Deduplicar | 0,1 a 0,5 s |
| Guardar | menos de 0,1 s |
| Instalador | 595 MB · 3,0 GB instalado |

Con la máquina apretada de memoria estos tiempos se degradan mucho, y sin ningún
error en pantalla. Es el motivo del mínimo de 4,2 GB libres.

---

## Construir desde el código fuente

No hace falta para probar la aplicación: para eso está el instalador. Si aun así
quieres compilarla:

```bash
npm ci
npm run dev        # Electron en desarrollo
npm run build:win  # instalador NSIS en dist/
```

Probado con **Node 24.16.0** y **npm 11.15.0** en Windows 11.

> **Aviso conocido.** Con Node 24 en Windows, la postinstalación de Electron
> descarga su zip pero **no lo extrae**, y `npm run dev` falla con "Electron
> uninstall". Hay que extraer a mano el binario desde la caché de Electron
> (`%LOCALAPPDATA%\electron\Cache`) hacia `node_modules/electron/dist/`, y dejar
> `node_modules/electron/path.txt` con el contenido `electron.exe`. Es un
> problema del instalador de Electron, no del proyecto, y **no afecta al
> instalador ya construido**.

`node_modules` **nunca** se copia entre máquinas: se instala con `npm ci`.

### Verificación

```bash
npm run check   # tipos, tokens de tema, contraste, sin red, troceo, locks y reglas
npm run smoke   # el motor completo con los tres modelos, sin Electron
```

`npm run check` no necesita ni la aplicación ni los modelos, y es lo mismo que
corre la integración continua en cada push, en Windows. `npm run smoke` sí carga
los 3,9 GB.

| Comando | Qué comprueba |
|---|---|
| `npm run check:tokens` | Que toda variable de color usada exista de verdad |
| `npm run check:contrast` | Los pares de color declarados, en los dos temas |
| `npm run check:sin-red` | Ninguna salida a la red en el código que se empaqueta |
| `npm run check:troceo` | Que una nota larga se corte bien antes de ir al motor |
| `npm run check:locks` | Que un bloqueo huérfano del motor se retire y uno vivo no |
| `npm run check:reglas` | Las reglas de producto: qué entiende la consulta y qué no afirma la extracción sin evidencia |
| `npm run smoke:semaforo` | Que el estado de los modelos no mienta cuando el motor muere |

`check:sin-red` es la que sostiene la afirmación central: recorre `src/main`,
`src/shared` y `src/preload`, que es donde vive la inferencia, y falla si aparece
`fetch`, un socket, una dirección externa u otro proveedor de IA. Se prueba a sí
misma: metiéndole un `fetch` a propósito, falla y lo nombra.

---

## Limitaciones conocidas

- **La extracción acierta 8 de 10.** No se esconde: cada fila lleva su cita y la
  interfaz permite corregir antes de guardar.
- **El tipo de respuesta de una consulta falla a veces.** Lo corrige una regla
  determinista sobre la frase, pero el modelo por sí solo no lo acierta.
- **El español funciona mejor que el inglés** en voz y en extracción. Whisper
  está fijado a español a propósito: sin fijarlo, traducía al inglés.
- **Edades mixtas dentro de una misma modalidad** siguen siendo el caso difícil.
- **El workbook de Philips se carga tal cual, con sus inconsistencias.** Su fila
  3 declara cantidad 3 marcada "Aggregate row" y la fila 4 suma 1 más, así que el
  tablero muestra 4 donde el texto dice tres. Se conserva porque es su dato
  declarado, y el aviso viaja dentro de `data/seed-philips.json`.
- **Sin mapa geográfico:** tabla y gráficos.
- **El acceso no valida credenciales**, y la pantalla lo dice con esas palabras.

## Trabajo futuro

Búsqueda sobre manuales de servicio con el juego RAG del propio SDK, lectura de
la placa del equipo por foto con su motor de OCR, dictado en streaming,
aplicación móvil y sincronización entre técnicos.

---

## Declaración de origen del trabajo

**Declaración obligatoria del reto.** Todo lo que hay en este repositorio se
construyó **durante el hackatón**. No se partió de ninguna base preexistente
propia ni de terceros.

1. **Diego Laverde arrancó el proyecto** al abrir el hackatón y construyó una
   primera parte de la aplicación.
2. **Josué Carrillo construyó su parte** en paralelo: el motor de inferencia
   sobre el SDK de QVAC y la extracción con esquema forzado.
3. **Las dos partes se unieron** y sobre esa unión se terminó de levantar lo que
   hoy está montado: modo Seguimiento, deduplicación, temas, verificación
   automatizada y empaquetado.

Todo el trabajo cabe dentro de la ventana del reto. El historial de `git log`
aparece casi entero bajo una sola cuenta porque las dos partes se fusionaron en
un repositorio nuevo, y esa fusión aplanó la autoría original. El reparto real
es el de los tres puntos de arriba, y esta declaración es la que manda sobre el
historial.

### Lo que no escribimos nosotros, y va declarado

| Qué | De dónde | Cómo se usa |
|---|---|---|
| **SDK de QVAC** (`@qvac/sdk` 0.19.0) | Tether, Apache-2.0 | Toda la inferencia. Es la pieza que el reto pide usar. |
| **Modelos** `GEMMA4_2B_MULTIMODAL_Q4_K_M`, `WHISPER_BASE_Q8_0`, `EMBEDDINGGEMMA_300M_Q8_0` | Catálogo de QVAC, Apache-2.0 | Se descargan del catálogo. No están entrenados ni ajustados por nosotros. |
| **Electron y React** | Sus proyectos, MIT | El armazón de escritorio y la interfaz. |
| **Zod** y **@electron-toolkit/utils** | Sus proyectos, MIT | Las dos únicas dependencias de producción además del SDK. |
| **Asistencia de IA** (Claude Code, Codex) | Anthropic, OpenAI | Se usó como asistente de programación durante todo el reto, con revisión humana de cada cambio. |
| **Marca Philips** | Philips | Solo el logotipo en la interfaz, para el contexto del reto. No es un producto oficial de Philips. |

**Andamiaje declarado.** El proyecto se arrancó con el generador de
`electron-vite`, que aportó la estructura de tres procesos y la configuración de
compilación. Su ejemplo mínimo se sustituyó entero: no queda ni una pantalla ni
una función suyas. No se usó ninguna otra plantilla, tema comprado ni componente
de terceros.

## Licencias

Código propio bajo MIT (`LICENSE`). Electron y Chromium bajo sus respectivas
licencias. Los modelos del catálogo de QVAC bajo Apache-2.0.

**Música del video.** «Inspired», de Kevin MacLeod (incompetech.com), bajo
Creative Commons Atribución 4.0, que pide este crédito. Aparece también en el
último plano del video. No forma parte de la aplicación: solo suena en el video
de demostración.

**El alcance exacto está en [`NOTICE.md`](NOTICE.md):** qué cubre la licencia
MIT, qué no cubre, y de dónde salen los datos de demostración.
