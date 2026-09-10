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

**D20 · País se guarda en inglés canónico; ciudad como la dijo el usuario; la interfaz traduce el país.** Al unir semillas, Philips traía "Panama" y la nuestra "Panamá": dos países en el tablero para el mismo lugar. Regla: `country` sigue la ortografía de Philips (Panama, Brazil, Mexico, Peru, Dominican Republic, ...), coherente con D10. `city` es texto libre y `inferCountry` la compara sin acentos ni mayúsculas. El renderer muestra el país con etiqueta en español vía un mapa pequeño. Se normalizó `data/seed-panama.json` y se regeneró `data/catalog.json`.

**D21 · El workbook de Philips se carga tal cual, con sus inconsistencias señaladas, no corregidas.** La fila 3 (Horizon) dice cantidad 3 marcada "Aggregate row" y la fila 4 añade 1 más: el tablero suma 4 resonadores donde el texto dice tres. Se conserva porque es su dato declarado; el aviso queda en `_avisos` de `data/seed-philips.json` y va a "Limitaciones" del README.

**D22 · Si `npm run dev` dice "Electron uninstall", el binario se extrae a mano.** Con Node 24.16 en Windows, el postinstall del paquete `electron` (`install.js`) descarga el zip completo (136 MB) pero `extract-zip` termina en silencio sin extraer nada y sin error: `dist/` queda con una carpeta `locales` vacía y no existe `path.txt`. Arreglo verificado: `Expand-Archive` del zip cacheado en `%LOCALAPPDATA%\electron\Cache\<hash>\` hacia `node_modules/electron/dist`, mover `electron.d.ts` un nivel arriba y escribir `node_modules/electron/path.txt` con el texto exacto `electron.exe` sin salto de línea. Va al README en "Notas para construir" porque Diego lo va a encontrar al hacer `npm ci`.

## 2026-09-09 · Bloque 4B

**D23 · Dos puertas de entrada, y la app deja de abrir en el tablero de captura.** El reto de Philips pide registrar Y seguir el estatus de lo ya registrado. La app solo sabía registrar. `App.tsx` arranca en `mode: 'home'`, con dos tarjetas: Registrar equipos y Seguimiento y reportes. Sin librería de router: `useState` y renderizado condicional. Volver al inicio está siempre en el `Header`, y con un borrador sin guardar pide confirmación antes de descartarlo. Evidencia: `bench/e2e-4b.json`, `bench/e2e/4b-03-selector-foco.png`.

**D24 · La respuesta sale solo de los registros; el modelo únicamente traduce la pregunta.** `src/main/qvac/query.ts` devuelve un `QueryPlan` (filtro + intención + agrupación) y nada más. Los conteos, listados y agrupaciones los calcula `src/shared/query-engine.ts`, funciones puras sin Electron ni QVAC. Ni una cifra de la pantalla la escribe un modelo, y la frase redactada es una plantilla determinista sobre números ya calculados. `src/main/reports.ts` pasó a usar ese mismo motor: tenía su propia copia del filtrado, que es exactamente lo que permite que un PDF diga algo distinto de la tabla que lo originó. Evidencia: la comprobación "los números del desglose suman el total de equipos" en `bench/e2e-4b.json`.

**D25 · Las variantes azul y negro del logo animado no se ven: esos dos temas usan la marca vectorial.** Medido, no opinado. Ningún fotograma de `philips-logo-30s-loop.webm` pasa de 0/255 en ningún canal, y `…-hue-neon.webm` no pasa de 16/255; Chromium las compone opacas (alfa 255 en todos los píxeles, leído desde un canvas contra la app viva). En pantalla son un rectángulo oscuro sin logo. La pieza `…-light-brand.webm` sí se ve: escudo negro sobre `#f4f8fb`. No se reasigna la tabla de temas ni se reanima el archivo, las dos cosas están fuera de alcance: `LogoMotion.tsx` lleva un `visible` por variante y los temas Azul oscuro y Negro caen a `philips-logo.svg`. En cuanto lleguen piezas visibles sobre fondo oscuro se cambia ese `visible` a `true` y no hay que tocar nada más. Evidencia: `bench/logo-variantes.json`. **Pendiente con Diego.**

**D26 · Puerta de la pregunta en español: superada. 10/10 en el Anexo F y 4/5 en las cinco nuevas.** Se conecta la barra. La medición costó tres corridas y una iteración de prompt, todas guardadas:
- v1 (`bench/query-anexoF-v1.json`): 6/10 y 2/5. El modelo elegía la categoría del lugar y confundía "Panamá" (país) con "Panama City" (ciudad), y "DemoCare Chiriquí" (sitio) con "Chitré".
- v2 (`bench/query-anexoF-v2.json`): 9/10 y 3/5. El lugar pasó a ser una cadena copiada de la pregunta y la categoría la decide `resolvePlace()` contra el catálogo. Quedaban la edad con número y el mapeo de agrupación.
- v3 (`bench/query-anexoF.json`, `bench/query-bloque4b.json`): 10/10 y 4/5. Se separó la regla de la edad con número de la de "nuevos/viejos" y se listó qué dimensión va en `g`.
Único fallo que queda: "qué marcas hay en Ciudad de Panamá" se interpreta como lista en vez de desglose. Ninguna de las 15 consultas del banco aparece en los ejemplos del prompt. Mediana de `query:parse`: **11.4 s en el banco** y **15 a 22 s dentro de la app** con los otros dos modelos cargados.

**D27 · El contraste se mide con la fórmula de WCAG, por tema, y rompe la construcción si baja.** `scripts/check-contrast.mjs` recorre 38 pares por tema, 114 en total, y sale con código distinto de cero si alguno queda bajo su umbral. Se engancha a `npm run check`. Lo que estaba fallando de verdad era el anillo de foco: `#caecff` sobre blanco es 1.16:1, es decir, invisible. Ahora es `--focus` medido a 4.68:1. Tabla completa en `docs/contraste.md`.

**D28 · El resaltado de evidencia conserva el mismo par amarillo/tinta en los tres temas.** El `<mark>` lleva su propio fondo, así que lo que cambia con el tema es lo que tiene alrededor. Lo que se mide contra ese entorno es su borde de 2 px, que pasa 3:1 en los tres temas. Así el diferenciador del producto no depende del tema ni solo del color.

**D29 · Registrar abre sin la tabla de la base.** Se pide con "Ver la base registrada" y su estado no se recuerda entre entradas. La pantalla de registro dejaba de competir consigo misma por la atención, y duplicar ahí la consulta contradice la reorientación de las dos puertas.

**D30 · La barra de pregunta depende solo de Gemma, no de los tres modelos.** Guardar un cliente nuevo recarga Whisper para meterlo en su vocabulario, y eso dejaba el modo Seguimiento bloqueado sin ninguna razón. Lo encontró la verificación del bloque, no una lectura del código.

**D31 · Búsqueda de texto solo por nombre de sitio y ciudad.** Antes barría también la nota completa, la marca y el modelo, así que "DemoCare Chiriquí" traía cualquier nota que mencionara Chiriquí. El resto de campos se filtra por catálogo, exacto. Cambia el comportamiento del buscador libre del tablero de Registrar, a propósito.

**D32 · Ninguna fila con cantidad se descarta en silencio.** Si un filtro deja fuera un registro porque el campo que se filtra viene vacío, no desaparece: se cuenta aparte y la pantalla lo declara ("3 filas sin país registrado (7 equipos)"). El motor lo devuelve en `missing` y `KpiRow` lo pinta.

**D33 · El correo no lo envía la aplicación.** Se guarda el PDF en disco, se abre la carpeta y se abre el cliente de correo del usuario con asunto y cuerpo ya escritos. La interfaz lo dice con esas palabras. El producto se demuestra con el WiFi apagado y el README declara ejecución cien por ciento local: un botón que sugiera un envío automático rompe ese argumento delante del jurado.

**D34 · Movimiento reducido: fundido de 80 ms, sin desplazamiento.** La transición normal es `document.startViewTransition` a 180–220 ms con reserva en CSS. Con `prefers-reduced-motion: reduce` se reactiva a propósito una animación de 80 ms, porque la regla general de la hoja apaga toda animación con `!important`. Los datos nunca se animan: la tabla y las cifras aparecen de una vez.

**D35 · El HMR de electron-vite solo recarga el renderer.** Cualquier cambio en `src/main/` (IPC, almacén, reportes, motor QVAC) exige cerrar y volver a abrir la app. Costó un PDF que salía sin la frase redactada mientras la pantalla ya mostraba el código nuevo: la verificación estaba midiendo el proceso principal viejo. El aviso está en la cabecera de `scripts/e2e-4b.mjs`.

**D36 · Dos temas, no tres. Se retira Azul oscuro.** Decisión de Josué el 2026-09-09: si una variante no aporta, sobra. Quedan Blanco clásico y Negro, que son los dos que de verdad se ven distintos, y es el mismo orden de recorte que ya traía el documento del bloque. El tema es un factor estético y no puede costarle rendimiento a la aplicación: se borraron también `logo/azul.webm` y `logo/azul.png` para no empaquetar 690 KB muertos. El medidor de contraste pasó de 144 a 96 pares, todos en verde.

**D37 · El vídeo del logo se queda solo en el arranque.** Josué lo vio en pantalla: la versión de 96 px del encabezado parpadeaba, y la de 40 px de las esperas también. El bucle de 30 s tiene fotogramas donde el escudo no está, y a tamaño pequeño eso no se lee como una animación sino como un fallo. El resto de la interfaz usa `LogoMark`, la marca vectorial fija. El vídeo no se recorta ni se reanima: está fuera de alcance.

**D38 · El arranque dura 5 segundos fijos y deja de esperar a los modelos.** Antes se quedaba hasta que los tres estuvieran listos, así que el usuario miraba una pantalla quieta hasta 57 s. Ahora los modelos terminan de cargar detrás, el encabezado dice en qué van y cada modo declara lo que todavía no puede hacer. Es el cambio que de verdad bajó la espera: el minuto sigue existiendo, pero ya no se sufre.

**D39 · Cuándo se puede empezar a dictar: desde el primer segundo.**
| Acción | Qué necesita | Disponible desde |
|---|---|---|
| Escribir la nota | nada | al abrir |
| Dictar (grabar) | el micrófono | al abrir |
| Transcribir el dictado | Whisper Base | ~24 s, y si el audio llega antes se espera en vez de fallar |
| Interpretar la nota | Gemma 2B | ~50 a 60 s |
| Preguntar en español | Gemma 2B | ~50 a 60 s |
| Deduplicar y guardar | EmbeddingGemma | ~29 s |
El botón Dictar ya no espera a nadie: grabar es solo el micrófono. Si el audio llega antes de que Whisper termine, el proceso principal espera a que esté y transcribe (`whisperReady`). Los cargadores memorizan la carga en curso, así que dos llamadas concurrentes no arrancan dos cargas del mismo modelo.

**D40 · El orden de carga no mueve la aguja; se queda en paralelo.** Se midió cargar Whisper primero y solo, para que el dictado sirviera antes. No sirvió: tardó 24.3 s frente a 23.6 s en paralelo, y el total subió. El suelo son ~20 s de arranque del worker de QVAC, que paga entero el primer modelo que se cargue sea cual sea, más la lectura de los 3.4 GB de Gemma. Bajar de ahí exige cambiar el modelo o la cuantización, lo que invalidaría el 8/10 medido de D03 a 36 horas de la entrega. La tabla completa está en el comentario de `warmup()` en `src/main/qvac/models.ts`.

**D41 · El panel de tiempos es interno, no parte del producto.** Josué: ver cuánto tarda cada proceso invita al usuario a evaluar el rendimiento de la aplicación, y quien tiene que hacer eso somos nosotros. La pestaña de tiempos se enciende con **Ctrl+Alt+T** y queda guardada en ese equipo. Apagada, la sección de abajo se llama solo "Guía" y habla de los campos del registro.

**D42 · Una sola animación por cambio de modo.** La capa que entra se animaba a la vez que el propio cruce del navegador, y el cambio se veía a tirones. Ahora `transition.ts` marca el documento con `no-vt` cuando no hay `startViewTransition`, y el desplazamiento de entrada solo se aplica en ese caso. El arranque, además, sale en fundido de 220 ms en vez de desaparecer de golpe.

**D43 · El vídeo del logo se retira del producto. La marca es el SVG.** Josué reportó que en el arranque salía negro y parpadeando, "que parece un fallo". Se analizó el archivo fotograma a fotograma:
- `philips-logo-30s-loop.webm` (negro): negro puro en los 882 fotogramas.
- `…-hue-neon.webm` (azul): ningún canal pasa de 16 de 255.
- `…-light-brand.webm` (blanco): la única que se veía. Traía la cadencia rota, `avg_frame_rate=0/0` con base de tiempo de 1000 fps, y **eso** era lo que hacía que Chromium la reprodujera a tirones. Reconstruida con cadencia constante de 30 fps se ve lo que de verdad contiene: la silueta encendida 1.73 s y apagada 1.6 s, en corte seco, repetido nueve veces. Y dentro del tramo encendido los 51 fotogramas son **idénticos**, cero píxeles de diferencia.

O sea que el archivo no contiene una animación: contiene una imagen fija que parpadea, y además la silueta es un escudo liso, sin el escudo Philips real. El SVG que ya estaba en el repositorio le gana en todo: es vectorial, tiene el escudo de verdad, pesa 3 KB frente a 2.5 MB de los tres vídeos y no tiene nada que pueda parpadear. El movimiento del arranque lo pone ahora una animación CSS de 0.8 s que sí controlamos, escalonada con el nombre y la línea de estado. Se borraron los tres `.webm` y sus PNG del repositorio.

**Para Diego:** si la intención era una pieza animada, la exportación no la contiene. Hace falta un archivo con movimiento real, cadencia constante y luminancia sobre su propio fondo. Mientras tanto el arranque funciona sin él.

**D44 · Pantalla de acceso honesta, sin autenticación.** Josué la pidió como marcador de sitio: que se vea dónde irá el control de acceso, sin pedir credenciales hoy. La casilla de contraseña está **deshabilitada**, la pantalla dice con esas palabras que no valida nada y que cualquiera que abra la aplicación entra, y no se guarda ni se envía ninguna contraseña. Lo que sí es real es el nombre: alimenta el campo Observador de cada registro y el Solicitado por de cada reporte, que antes había que escribir a mano en dos sitios distintos.

**D45 · El medidor de contraste ahora también corre sobre la app viva.** `scripts/check-contrast.mjs` mide los pares que yo declaro; `scripts/check-contrast-vivo.mjs` recorre la aplicación en ejecución, elemento por elemento, en los dos temas y en cinco estados, calcula el fondo efectivo subiendo por los ancestros y mide 2.766 textos. Encontró a la primera lo que la lista declarada no veía: en el tema Negro el texto dentro del resaltado amarillo de evidencia heredaba `--ink`, que ahí es casi blanco, y quedaba en **1.12:1**. Es decir, el diferenciador del producto era ilegible en uno de los dos temas. Josué lo venía diciendo tres veces: "al seleccionar, el texto desaparece".

**D46 · Nada que se elija pierde su texto.** Además del resaltado se cerraron tres huecos que no salen en ninguna lista de tokens porque no los pinta nuestro CSS: las opciones de los desplegables (las pinta el sistema con su propio azul), la selección de texto con el ratón, y el estado presionado de los botones. Los tres llevan ahora colores propios del tema.

**D47 · Un campo del filtro admite varios valores. "Confianza baja o media" ya se puede pedir.** `QueryFilter` pasa a `OneOrMany<T>` y la comparación vive en una sola función, `matches()`. El chip lo lee con "o", los gráficos añaden y quitan valores sin tocar los demás, y el desplegable muestra "Varios: Baja o Media" cuando hay más de uno.

**D48 · La pregunta admite varios lugares en la misma frase.** Antes había un solo `lugar` y "de Panamá, en San Francisco" acababa como una sola cadena que no era ni país ni ciudad, así que no devolvía nada. Ahora el modelo entrega `lugares`, una lista copiada de la pregunta, y **la categoría de cada uno la sigue decidiendo el código** contra el catálogo: país exacto, ciudad exacta, ciudad contenida, o sitio. La consulta que pidió Josué, "equipos de Panamá, en San Francisco, con confianza baja o media", resuelve a país=Panama, texto=San Francisco, confianza=[Baja, Media].

**D49 · Tanda C del banco: cinco consultas de varias condiciones, puerta 4 de 5.** Mide lo que la versión anterior no sabía hacer. Evidencia en `bench/query-complejas.json`.

**D50 · El modo Seguimiento tiene su guía de cómo pedirlo.** Igual que la nota tiene la suya. Dice qué entiende (lugar, modalidad, marca, edad, estatus, confianza, y qué tipo de respuesta se quiere), qué **no** entiende todavía (comparar dos periodos, fechas de visita, opiniones, datos que no están en la base) y trae un ejemplo completo pulsable. Existe para que nadie escriba a ciegas: cuando algo no entra en parámetros la aplicación no inventa, pero es mejor decirlo antes que después.

## 2026-09-10 · Abogado del diablo y bloque 7

**D51 · El identificador de un modelo puede morir con la aplicación abierta, y el estado mentía.** Reproducido: `models:status` devolvía los tres en `ready`, la pantalla pintaba tres puntos verdes, y **toda** inferencia fallaba con `Model with ID "826f40296d485aa6" not found`. La causa es que `models.ts` guardaba el handle en memoria para siempre y nadie lo revalidaba; si el worker de QVAC se reinicia, los handles mueren y el estado en memoria se queda contando una historia vieja. Arreglo: `withModel()` envuelve las cuatro rutas de inferencia (extraer, transcribir, deduplicar, preguntar), detecta el error de handle muerto, olvida **los tres** modelos porque el worker se los llevó juntos, recarga y reintenta **una** vez. Verificado matando `bare.exe` a mano con la aplicación abierta: la siguiente pregunta se recuperó sola en 30,6 s y la de después funcionó normal; el semáforo pasó a decir la verdad. Antes de esto, el mismo escenario dejaba la app muerta con tres luces verdes, que es exactamente lo que habría pasado en mitad de la demo.

**D52 · El instalador existe y arranca. El bloque 7 deja de ser un desconocido.** `npm run build:win` nunca se había ejecutado. Se ejecutó: construye a la primera. El empaquetado se verificó en ejecución, no solo compilando: arranca, carga los tres modelos, responde una pregunta en 11,1 s, no hace ni una petición de red y no deja un solo error de consola.

**D53 · El instalador baja de 1,01 GB a 602 MB quitando los motores de QVAC que no usamos.** El SDK trae backends para difusión, traducción, OCR, texto a voz, audio generativo, BCI, clasificación y VLA. Nosotros llamamos a tres: LLM, embeddings y ASR. Son 2,1 GB de binarios que no se ejecutan nunca. Excluidos en `electron-builder.yml` y **verificado arrancando el empaquetado después**: sigue funcionando igual. Instalado pasa de 5,1 GB a 3,0 GB.

**D54 · El brief y el workbook de Philips ya no viajan dentro de nuestro artefacto.** `electron-builder.yml` no excluía `reference/`, `bench/`, `audio/`, `docs/` ni `scripts/`, así que el instalador redistribuía el documento del reto y su workbook. Corregido. También se quitó `publish.url: https://example.com/auto-updates`, que venía del andamiaje.

**D55 · El README lleva ya la declaración de bases preexistentes.** Era el punto que el propio blueprint marca como descalificante y solo había una nota diciendo que el bloque 8 lo escribiría. Ahora está escrito, con una tabla de qué había antes y qué se hizo durante, por cada una de las dos bases.

**D56 · Respaldo del repositorio fuera de esta laptop.** El repositorio **no tiene remoto**: doce commits vivían en un solo disco. Hasta que Diego dé acceso al repositorio del jurado, hay un `git bundle` completo en `Contexto-IA/proyectos-personales/jajanken-hackathon/respaldo-repo/`, que OneDrive sincroniza fuera del equipo, con instrucciones de restauración. **Un bundle es una foto y no se actualiza solo: no sustituye al remoto.**

**D57 · La pregunta funciona también en inglés, y el ejemplo del propio brief se atiende.** El brief está escrito en inglés y su consulta de ejemplo es literal: "Show me customers in Brazil with MR systems estimated to be more than seven years old". Sale correcta (país Brasil, modalidad MR, edad ≥ 7). Se añadieron dos guardas deterministas: las frases de desglose en inglés ("what brands", "breakdown by…"), y que **"estimated" pegado a una edad no se lea como el estado Estimated**, que es la trampa en la que caía justo el ejemplo del brief.

**Pendiente que no puedo cerrar yo:** el remoto del repositorio, la instalación en un perfil de Windows limpio, y la decisión del interruptor de la voz con el audio real de Diego.

**D58 · Fuera Recharts y fuera xlsx de producción.** Recharts eran 9 MB en el paquete y unos 400 KB del bundle para pintar tres gráficos de barras; se sustituyeron por las mismas barras que ya usaba el modo Seguimiento, que además llevan descripción accesible. `xlsx` (7,2 MB) solo lo usa `scripts/convert-philips-seed.mjs`, que es una herramienta de desarrollo, así que pasa a `devDependencies` y deja de viajar en el instalador. Resultado medido: bundle del renderer de **1.549 KB a 718 KB**, instalador de **602 a 594 MB**, y las dependencias de producción bajan de seis a cuatro. Verificado arrancando el empaquetado después, y con la verificación completa: 80/80, ciclo OK, contraste 98/98 y sin fallos en vivo.

**D59 · Acceso de escritura al repositorio del jurado, verificado.** Se probó con una rama huérfana mínima que no publicaba el código; el push funcionó con la identidad `josweq`. **Efecto lateral que hay que cerrar:** GitHub tomó esa rama de prueba como predeterminada del repositorio vacío y ahora se niega a borrarla mientras lo sea. Se resuelve solo al subir `main`, o borrándola desde la interfaz de GitHub. La rama local ya se llama `main`.

**D60 · Licencia y limpieza del repositorio.** Se añadió `LICENSE` (MIT) declarando además lo que NO cubre: Electron, el SDK de QVAC, los modelos Apache-2.0 y la marca Philips. Salieron del control de versiones el brief y el workbook de Philips, `docs/briefing.html` (artefacto muerto que además cargaba tipografías de Google por red) y `resources/seed-observations.json`.

## Pendientes de decisión

- **La carga real a `main`.** El remoto ya está configurado y el acceso de escritura probado (D59). Falta decidir cuándo se sube, y con eso muere la rama de prueba que quedó como predeterminada.
- **Instalación en un perfil de Windows limpio.** El instalador está construido y verificado en esta máquina; en una limpia, no.
- Voz vive o muere (Anexo G del blueprint), con el audio real de Diego.
- Pieza de logo con movimiento real y cadencia constante, si Diego quiere animación en el arranque (D43).
- Nombre definitivo de la aplicación.
