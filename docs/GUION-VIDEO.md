# GUION FINAL — Video de demostración de MAM

**Proyecto:** MAM · Medical Asset Management · equipo Jajanken · Track 01 Philips  
**Duración total planificada:** **4:58**  
**Velocidad de narración verificada:** máximo 150 palabras por minuto (2,5 palabras por segundo)  
**Regla de grabación:** mostrar un flujo real y continuo. No sustituir la ejecución por capturas, una llamada aislada al SDK ni una prueba de velocidad.

> Los nombres y cifras de este guion se basan en `README.md`, `DECISIONES.md`, `bench/auditoria-jurado.md` y `docs/briefing.html`. `docs/GUION-VIDEO-CAMBIOS.md` se consultó únicamente como referencia histórica.

## Planos

### Plano 1 — 0:00–0:12 (12 s)

**Pantalla**

- Comenzar en el escritorio limpio, con el indicador de Wi-Fi apagado visible y sin notificaciones.
- Abrir MAM. No mover el ratón después del doble clic.
- Dejar completos los 5 segundos de marca animada. No acelerar ni cortar el arranque.
- Al terminar la marca, dejar que aparezca la pantalla de acceso.

**Narración — 28 palabras; capacidad del plano: 30**

> Esto es MAM, Medical Asset Management: una aplicación de escritorio que convierte notas de campo en inteligencia de base instalada, con toda la inferencia dentro de esta computadora.

**Qué NO hacer**

- No mostrar el instalador, una terminal ni el escritorio desordenado.
- No tapar la marca con el puntero.
- No afirmar que los modelos ya están listos durante los 5 segundos de marca; continúan cargando detrás.

### Plano 2 — 0:12–0:32 (20 s)

**Pantalla**

- En la pantalla de acceso, enfocar el aviso que declara que no se validan credenciales.
- Escribir despacio el nombre de la persona que presenta.
- Mostrar que la contraseña está deshabilitada.
- Entrar y esperar a que aparezca Inicio, sin cortar el cruce.

**Narración — 39 palabras; capacidad del plano: 50**

> El acceso es deliberadamente honesto: este prototipo no valida credenciales y la pantalla lo declara. No guarda ni envía contraseñas. El nombre sí tiene una función real: identifica al observador de cada registro y a quien solicita cada reporte.

**Qué NO hacer**

- No escribir una contraseña ni sugerir que existe autenticación.
- No usar un nombre ilegible o de prueba.
- No cortar antes de que termine el cambio de pantalla.

### Plano 3 — 0:32–0:50 (18 s)

**Pantalla**

- Mostrar Inicio completo en tema Blanco clásico.
- Dejar visible la estructura de dos columnas: barra lateral azul profundo a la izquierda y área de trabajo a la derecha.
- Recorrer con un movimiento lento la navegación, las acciones de sección, el semáforo del motor, el selector de tema y la sesión.
- Detener el puntero sobre las dos puertas centrales: **Registrar equipos** y **Seguimiento y reportes**.

**Narración — 39 palabras; capacidad del plano: 45**

> MAM siempre abre en blanco. La barra lateral azul reúne navegación, acciones, estado del motor, tema y sesión. El trabajo ocurre a la derecha. Desde Inicio hay dos puertas claras: registrar equipos, o consultar y reportar lo ya guardado.

**Qué NO hacer**

- No cambiar todavía al tema Negro.
- No plegar la barra antes de que puedan leerse sus opciones.
- No pasear el ratón entre controles sin propósito.

### Plano 4 — 0:50–1:18 (28 s)

**Pantalla**

- Pulsar **Registrar equipos**.
- Dejar terminar el cruce de marca; debe cubrir solamente el panel derecho, mientras la barra lateral permanece disponible.
- En el campo de nota, pegar exactamente este texto sintético:

  > Estuve en DemoCare Chiriquí. Me mostraron el piso de monitoreo, unos quince monitores de paciente. No vi ningún equipo de imagen.

- Aumentar el zoom de la grabación solo si la nota o los controles no se leen con claridad.
- Pulsar el control para interpretar la nota una sola vez.

**Narración — 57 palabras; capacidad del plano: 70**

> Entramos en Registrar equipos sin abandonar la navegación. Usaré texto, porque escribir y dictar son dos entradas al mismo flujo y la voz no necesita cargar con esta demostración. La nota es sintética: identifica un sitio DemoCare, quince monitores de paciente y declara que no se observó equipo de imagen. Ahora pedimos a MAM que la interprete.

**Qué NO hacer**

- No teclear toda la nota en cámara ni corregirla con el ratón nervioso; usar el portapapeles.
- No activar el dictado en esta toma.
- No pulsar dos veces el control de interpretación.

### Plano 5 — 1:18–1:42 (24 s)

**Pantalla**

- Mantener visible el estado real de procesamiento; no sustituirlo por una captura.
- Mientras MAM interpreta, señalar una vez el semáforo del motor y volver el puntero al área de trabajo.
- Esperar el resultado completo. La ventana del plano cubre el máximo medido de 14 a 23 segundos para interpretar una nota.

**Narración — 55 palabras; capacidad del plano: 60**

> La interpretación corre aquí mismo con Gemma mediante el SDK de QVAC. No hay una API de inteligencia artificial en la nube. En esta máquina, interpretar una nota tarda entre catorce y veintitrés segundos. No ocultamos la espera ni vendemos una prueba de velocidad: estamos ejecutando el flujo real que después alimentará la base instalada.

**Qué NO hacer**

- No acelerar el metraje, congelar el indicador ni insertar un resultado preparado.
- No abrir otras aplicaciones durante la inferencia.
- Si no aparece el resultado dentro de la toma, detener y aplicar el protocolo de **Riesgos en vivo**; no fingir éxito.

### Plano 6 — 1:42–2:14 (32 s)

**Pantalla**

- Recorrer las filas propuestas lentamente.
- Para cada dato que se conservará, mostrar su cita textual resaltada dentro de la nota.
- Enfocar la cantidad y la modalidad antes de editar o confirmar.
- Si aparece un valor no respaldado, corregirlo en la tabla editable usando la nota como autoridad. El resultado que se guardará debe reflejar quince monitores de paciente y ningún equipo de imagen observado.

**Narración — 78 palabras; capacidad del plano: 80**

> Aquí está el diferenciador. El extractor acierta ocho de diez casos del banco oficial, y no lo escondemos. Un modelo pequeño llegó a reportar cuarenta tomógrafos en Roma sobre una nota que decía quince monitores en un hospital sin equipo de imagen. El formato era impecable; el contenido, inventado. En MAM cada dato conserva la cita textual que lo justifica, validada como subcadena antes de guardar. Así revisamos y corregimos un fallo, en lugar de aceptarlo en silencio.

**Qué NO hacer**

- No pasar sobre las citas demasiado rápido ni dejar el texto por debajo del tamaño legible.
- No afirmar que 8/10 equivale a exactitud perfecta.
- No guardar una fila cuya cita no justifique el dato.

### Plano 7 — 2:14–2:34 (20 s)

**Pantalla**

- Dejar la fila final con cantidad **15**, modalidad de monitor de paciente y la cita visible que contiene “quince monitores de paciente”.
- Resolver la coincidencia del sitio de forma explícita, sin aceptar automáticamente una sugerencia de deduplicación.
- Pulsar **Guardar** una sola vez y esperar la confirmación visual.

**Narración — 46 palabras; capacidad del plano: 50**

> La forma válida no basta. Conservamos quince monitores porque la nota lo dice, descartamos cualquier equipo de imagen que no fue observado y resolvemos el sitio de manera explícita. La deduplicación ordena candidatos por similitud; una persona decide. Solo entonces guardamos el registro con su evidencia.

**Qué NO hacer**

- No aceptar un sitio sugerido sin leerlo.
- No ocultar una corrección hecha por la persona.
- No confundir la confianza del modelo con una aprobación humana.

### Plano 8 — 2:34–2:52 (18 s)

**Pantalla**

- Pulsar **Ver la base registrada**.
- Mostrar la fila recién guardada y su cita; mantener visibles el sitio, la modalidad y la cantidad.
- Desplazarse solo lo necesario para confirmar que el registro forma parte de la base.

**Narración — 39 palabras; capacidad del plano: 45**

> El registro ya forma parte de la base local y conserva su procedencia. Guardar tarda menos de una décima de segundo. Desde Registrar podemos abrir la base y comprobar que la observación, sus campos y su cita siguen unidos.

**Qué NO hacer**

- No recorrer columnas que no aportan a la historia.
- No mostrar datos personales ni instituciones reales; los clientes y los inventarios de la demo son inventados.
- No presentar las ciudades reales de Panamá como clientes reales.

### Plano 9 — 2:52–3:22 (30 s)

**Pantalla**

- En la barra lateral, pulsar **Seguimiento y reportes**.
- Dejar completo el cruce de marca sobre el panel derecho.
- Pegar esta consulta ya verificada: **“equipos de Panamá, en San Francisco, con confianza baja o media”**.
- Ejecutar la consulta una sola vez y mantener visible el procesamiento real.

**Narración — 65 palabras; capacidad del plano: 75**

> Pasamos a Seguimiento y reportes sin volver a una pantalla intermedia. Preguntamos en español por varias condiciones a la vez: país, lugar y dos niveles de confianza. Gemma traduce la frase a un plan de consulta; no redacta ninguna cifra. Los filtros, conteos, listas y agrupaciones se calculan sobre los registros guardados con un motor determinista. Interpretar la pregunta tarda entre once y veintidós segundos.

**Qué NO hacer**

- No escribir una consulta distinta de la ensayada.
- No cortar la espera ni afirmar que la respuesta es instantánea.
- No decir que el modelo “sabe” el inventario: interpreta la pregunta; la base aporta los datos.

### Plano 10 — 3:22–3:52 (30 s)

**Pantalla**

- Mostrar primero cómo MAM entendió la consulta: país, texto y confianza Baja o Media.
- Recorrer la respuesta redactada, las cifras, la tabla y las citas sin anunciar números de memoria; leer únicamente lo que esté visible.
- Pulsar una barra de uno de los gráficos para añadir un filtro y mostrar el cambio.
- Retirar ese filtro para volver al resultado original.

**Narración — 73 palabras; capacidad del plano: 75**

> Antes de responder, MAM muestra qué entendió, para que el usuario pueda detectar una interpretación equivocada. Después presenta una frase, cifras, una tabla y gráficos interactivos. Todo sale del mismo motor de consulta; por eso el reporte no puede contar algo distinto de la tabla. Las filas mantienen sus citas también aquí. Al pulsar una barra, el filtro se hace explícito y el resultado se recalcula sobre la base, no sobre texto inventado.

**Qué NO hacer**

- No narrar una cantidad que no coincida exactamente con la pantalla.
- No ocultar los filtros activos.
- No recorrer todos los gráficos; basta una interacción clara.

### Plano 11 — 3:52–4:14 (22 s)

**Pantalla**

- Generar el reporte disponible para la vista actual.
- Mostrar que el PDF se guarda en disco y abrirlo el tiempo suficiente para reconocer el encabezado y el resultado.
- Volver a MAM y señalar **Preparar correo**, sin pulsarlo.

**Narración — 51 palabras; capacidad del plano: 55**

> El resultado se convierte en un PDF local. MAM guarda el archivo en disco y puede abrir el cliente de correo con asunto y cuerpo preparados. No envía nada por su cuenta. Aquí detenemos el flujo antes de abrir una aplicación externa y mantenemos visible el reporte que acaba de generarse.

**Qué NO hacer**

- No mostrar una bandeja de correo, direcciones personales ni notificaciones.
- No decir que MAM envía el reporte.
- No abrir un PDF preparado antes de la toma.

### Plano 12 — 4:14–4:34 (20 s)

**Pantalla**

- Cambiar del tema Blanco clásico al tema Negro.
- Mostrar que la barra lateral continúa en azul profundo y que cambia el panel derecho.
- Plegar la barra lateral una vez; dejar visibles los iconos y sus títulos emergentes.
- Volver a desplegarla y regresar a **Inicio**.

**Narración — 49 palabras; capacidad del plano: 50**

> El tema Negro es una elección del usuario; MAM siempre inicia en blanco. La barra permanece azul profundo en ambos temas. También puede plegarse sin perder navegación: los iconos siguen activos y conservan su nombre accesible. Volvemos a Inicio sin esconder el estado del motor ni abandonar la sesión.

**Qué NO hacer**

- No decir que existen tres temas; son Blanco clásico y Negro.
- No dejar la barra plegada antes de que se entiendan sus controles.
- No alternar temas repetidamente.

### Plano 13 — 4:34–4:58 (24 s)

**Pantalla**

- Dejar Inicio en pantalla con la marca centrada y las dos puertas visibles.
- Superponer al final, en texto grande y legible: **MAM · Medical Asset Management — Equipo Jajanken — Track 01 Philips**.
- Debajo, mostrar: **Prototipo del hackatón · No es un producto oficial de Philips**.
- Fundir a negro exactamente en 4:58.

**Narración — 59 palabras; capacidad del plano: 60**

> Todo se construyó durante el hackatón, con el SDK y modelos de QVAC, dependencias declaradas y asistencia de inteligencia artificial con revisión humana. Como trabajo futuro quedan la búsqueda sobre documentos, la lectura de la placa del equipo por foto, el dictado en streaming, una aplicación móvil y la sincronización entre equipos. MAM demuestra el ciclo completo y auditable.

**Qué NO hacer**

- No presentar ningún trabajo futuro como función disponible.
- No llamar al producto Eco ni FieldLens.
- No añadir una diapositiva posterior: el video termina en 4:58.

## Verificación de duración y locución

| Plano | Intervalo | Duración | Palabras | Capacidad a 150 ppm | Margen |
|---:|:---:|---:|---:|---:|---:|
| 1 | 0:00–0:12 | 12 s | 28 | 30 | 2 |
| 2 | 0:12–0:32 | 20 s | 39 | 50 | 11 |
| 3 | 0:32–0:50 | 18 s | 39 | 45 | 6 |
| 4 | 0:50–1:18 | 28 s | 57 | 70 | 13 |
| 5 | 1:18–1:42 | 24 s | 55 | 60 | 5 |
| 6 | 1:42–2:14 | 32 s | 78 | 80 | 2 |
| 7 | 2:14–2:34 | 20 s | 46 | 50 | 4 |
| 8 | 2:34–2:52 | 18 s | 39 | 45 | 6 |
| 9 | 2:52–3:22 | 30 s | 65 | 75 | 10 |
| 10 | 3:22–3:52 | 30 s | 73 | 75 | 2 |
| 11 | 3:52–4:14 | 22 s | 51 | 55 | 4 |
| 12 | 4:14–4:34 | 20 s | 49 | 50 | 1 |
| 13 | 4:34–4:58 | 24 s | 59 | 60 | 1 |
| **Total** | **0:00–4:58** | **298 s** | **678** | **745** | **67** |

La suma de los intervalos es **298 segundos = 4:58**. Quedan **2 segundos** antes del máximo absoluto de 5:00. Ningún bloque supera 150 palabras por minuto; el promedio completo es de aproximadamente 137 palabras por minuto.

## Preparación antes de grabar

1. **Instalación.** Tener instalado y probado `MAM-1.0.0-setup.exe`. No grabar el proceso de instalación. El instalador se verificó arrancando en la máquina de desarrollo, no en un perfil limpio de Windows.
2. **Modelos y red.** Confirmar antes de la toma que los pesos de Gemma, Whisper Base y EmbeddingGemma ya existen en `%USERPROFILE%\.qvac`. Después, apagar el Wi-Fi. No borrar ni mover la caché.
3. **Qué precargar.** Copiar al portapapeles, en ese orden, la nota sintética del Plano 4 y la consulta del Plano 9. Tener preparada una carpeta vacía y visible para guardar el PDF. No abrir previamente un PDF de muestra.
4. **Arranque en frío.** El README registra **“49 a 61 s”** para **“Los tres modelos, en paralelo”**. El arranque de marca dura **5 segundos fijos y no espera a los modelos**. Por eso la interpretación comienza en 1:18, después de la ventana máxima declarada de carga.
5. **Memoria.** Cerrar navegador, correo, videollamada, sincronizadores pesados y cualquier otra aplicación que compita por memoria. Reiniciar Windows si la máquina viene de una sesión larga.
6. **Privacidad.** Desactivar notificaciones y ocultar archivos, nombres de cuenta, rutas personales y mensajes recientes. Usar solamente clientes e inventarios ficticios con la convención DemoCare.
7. **Tema.** Iniciar en **Blanco clásico**, que es el comportamiento real. Reservar el cambio a Negro para el Plano 12.
8. **Resolución de captura.** **PENDIENTE.** Ninguna de las cuatro fuentes autorizadas fija una resolución de grabación; no se inventa una.
9. **Ensayo.** Cronometrar una toma completa sin alterar la velocidad. Verificar que la nota, las citas, los filtros y el PDF sean legibles, y que el cierre ocurra en 4:58.

## Riesgos en vivo

- **El motor local se queda sin memoria o muere.** Señal: el semáforo deja de estar listo, aparece un error de modelo o la inferencia no concluye. Acción: detener la toma, cerrar aplicaciones, reiniciar MAM y esperar la carga completa. No grabar encima del fallo ni presentar un semáforo incierto como verde.
- **Los modelos aún están cargando.** Señal: interpretar o preguntar todavía no está disponible. Acción: conservar la secuencia prevista; a 1:18 ya habrá transcurrido más que la ventana de 49 a 61 segundos. Si sigue sin estar disponible, detener y reiniciar la toma.
- **La extracción propone un dato incorrecto.** Acción: no repetir hasta obtener una salida “bonita”. Mostrar la cita, corregir la fila con la nota como autoridad y guardar solamente lo respaldado. Ese comportamiento demuestra el diferenciador.
- **La deduplicación propone el sitio equivocado.** Acción: leer los candidatos y elegir explícitamente el sitio correcto. El ranking ayuda; no decide mediante un umbral automático.
- **La consulta devuelve una cantidad inesperada.** Acción: no recitar cifras memorizadas. Verificar los chips de interpretación, retirar cualquier filtro accidental y narrar únicamente los números que aparecen en pantalla.
- **Queda poca memoria libre y nadie lo nota.** Es el riesgo peor, porque no da error. Medido en esta máquina: con 0,4 GB libres, interpretar la consulta del Plano 9 tardó **175 segundos** en vez de los 30 presupuestados; con 1,8 GB libres, la misma consulta tardó **13,7 s**. Doce veces más lento, sin un solo mensaje en pantalla. Un video grabado así dura más de siete minutos, incumple el límite del reto y hace parecer lenta una aplicación que no lo es. `npm run demo:grabar` se niega a grabar por debajo de 1,5 GB libres con los modelos ya cargados. **Antes de grabar, cerrar el navegador, el correo y la hoja de cálculo.**
- **La inferencia tarda más que el máximo medido.** Acción: detener la toma y revisar memoria y estado del motor. No acelerar el video ni insertar una respuesta de otra corrida.
- **El PDF abre detrás de MAM o en otra pantalla.** Acción: ensayar el destino y el visor antes de grabar; durante la toma, usar la barra de tareas una sola vez y volver a MAM sin buscar ventanas.
- **El cliente de correo se abre o expone datos.** Acción: no pulsar **Preparar correo**. El Plano 11 solo señala el control y explica con precisión lo que hace.
- **El dictado falla por voz o ruido.** Mitigación adoptada: el guion no usa dictado. La aplicación acepta texto y el flujo demostrado sigue siendo completo.
- **Una transición queda a mitad por un clic doble.** Acción: hacer un solo clic y esperar el cruce de marca completo. La barra izquierda debe permanecer estable; el cruce ocurre únicamente sobre el panel derecho.

## Lo que se dice y no se enseña

Estas son todas las funciones que el guion declara como trabajo futuro. La frase exacta del Plano 13 es:

> “Como trabajo futuro quedan la búsqueda sobre documentos, la lectura de la placa del equipo por foto, el dictado en streaming, una aplicación móvil y la sincronización entre equipos.”

Lista exacta, sin equivalencias ni promesas adicionales:

1. **“la búsqueda sobre documentos”**
2. **“la lectura de la placa del equipo por foto”**
3. **“el dictado en streaming”**
4. **“una aplicación móvil”**
5. **“la sincronización entre equipos”**

No mostrar maquetas, pantallas, teléfonos, fotografías de placas ni búsquedas documentales que puedan confundirse con funciones disponibles. El mapa geográfico tampoco se enseña ni se promete: la decisión vigente es usar tabla y gráficos.

## CIFRAS QUE NO PUDE VERIFICAR

- **Resolución exacta de grabación.** `README.md`, `DECISIONES.md`, `bench/auditoria-jurado.md` y `docs/briefing.html` no fijan ancho, alto, relación de aspecto ni escala de Windows. Por eso Preparación indica **PENDIENTE** en vez de inventar una cifra.
