# Eco · Jajanken

Inteligencia de base instalada con IA **100 % local**. De la voz al dato, sin nube.

Entrega del equipo **Jajanken** para el **Track 01 de Philips** (Customer Installed
Base Intelligence) del ISD Summit 2026.

> **Aviso:** prototipo del equipo Jajanken para el reto Philips · Hackathon ISD
> Summit 2026 · **No es un producto oficial de Philips.** Todos los clientes,
> marcas, modelos y ubicaciones de los datos son **sintéticos**.

---

## Bases preexistentes

**Declaración obligatoria.** Este proyecto NO se construyó desde cero durante el
hackatón. Se partió de dos bases propias del equipo, y esto es exactamente qué
había antes y qué se hizo durante:

| Base preexistente | Autor | Qué era antes del reto | Qué se hizo durante |
|---|---|---|---|
| **FieldLens v1** | Diego Laverde | Aplicación Electron + React + TypeScript con una pantalla de captura, tabla y empaquetado con electron-builder. Modelo de datos plano: **un equipo por observación**. | Se conservaron Electron, la base del empaquetado y parte del sistema de color. Se **reescribió** el proceso principal completo, se abrió el modelo de datos a `Observation.equipment[]` y se rehízo el renderer. |
| **Banco de mediciones QVAC** | Josué Carrillo | Scripts de banco (`bench/bench*.js`) para comparar modelos, cuantizaciones y esquemas sobre el SDK de QVAC, escritos en los días previos al reto. | Se ampliaron con el banco de la pregunta en español (`bench/bench_query.js`) y con la verificación contra la aplicación en ejecución. |

Todo lo demás —motor QVAC modular, almacén, deduplicación, modo Seguimiento,
reportes, temas, verificación automatizada— se escribió durante el reto, y el
historial de `git log` lo refleja commit por commit.

Dependencias de terceros: Electron, React, Recharts, Zod, xlsx y el SDK de QVAC
de Tether. Ninguna otra.

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
**ni el arranque ni el uso vuelven a tocar la red**. La verificación
automatizada comprueba, contra la aplicación en ejecución, que no queda ni una
petición fuera de `localhost`.

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

Sin internet: instalar los modelos desde USB antes de abrir la aplicación por
primera vez, con el procedimiento de `docs/BLUEPRINT.md`, sección 12.

Si `npm run dev` dice **"Electron uninstall"**, ver **D22** en `DECISIONES.md`:
con Node 24 en Windows el postinstall de Electron descarga el zip pero no lo
extrae, y hay que hacerlo a mano con `Expand-Archive`.

## Cómo reproducir la verificación

```bash
npm run check                        # tipos + contraste medido en los dos temas
npm run smoke                        # el motor sin Electron
npm run bench:all                    # reproduce el banco de mediciones
node scripts/e2e-4b.mjs              # 80 comprobaciones contra la app en ejecución
node scripts/check-contrast-vivo.mjs # contraste real, elemento por elemento
```

Las tres últimas necesitan la aplicación abierta con
`npm run dev -- -- --remote-debugging-port=9222`.

## Resultados medidos

| Qué | Resultado |
|---|---|
| Extracción, 10 casos oficiales de Philips en español | 8/10 |
| Citas textuales válidas | 100 % en todas las corridas |
| Pregunta en español, Anexo F del blueprint | 10/10 |
| Pregunta en español, intención y agrupación | 5/5 |
| Pregunta en español, consultas de varias condiciones | 5/5 |
| Voz: hospitales reconocidos con vocabulario sembrado | 9/10 |
| Contraste WCAG | 98/98 pares declarados · más de 5.000 textos medidos en la app viva, 0 fallos |
| Verificación de la interfaz contra la app real | 80/80 |

Evidencia cruda en `bench/*.json`, capturas en `bench/e2e/`.

## Tiempos reales, arranque en frío

| Proceso | Medido |
|---|---|
| Arranque del worker de QVAC | ~20 s, lo paga el primer modelo que cargue |
| Los tres modelos, en paralelo | 49 a 61 s |
| Interpretar una nota | 14 a 23 s |
| Interpretar una pregunta | 11 a 22 s |
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
