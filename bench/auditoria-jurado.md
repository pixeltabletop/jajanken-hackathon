# MAM · Medical Asset Management — auditoría desde la silla del jurado

Fecha: 2026-09-10, revisada esa misma tarde. Entrega: viernes 11 de
septiembre, 08:00 hora de Panamá.

Esto no es un resumen del trabajo hecho. Es el proyecto mirado por alguien que
busca razones para bajarle la nota, con los criterios que el propio reto publicó.

---

## Veredicto

**El producto está listo. La entrega no.**

Lo que se construyó aguanta una revisión técnica seria: la inferencia es local y
ahora se puede demostrar con un comando, el flujo de usuario corre entero y está
verificado contra la aplicación real, y la honestidad sobre los límites es el
punto más fuerte del expediente.

Lo que puede hundirlo no está en el código. **Falta el video, que es lo primero
que el jurado abre, y el repositorio recibe a quien entra por una rama de
prueba.** Las dos cosas se arreglan hoy y ninguna depende de programar.

---

## Las dos reglas que descalifican

El reto nombra dos causales explícitas. Se revisaron las dos.

### 1. La inferencia corre en el dispositivo · **cumple**

Un jurado no se conforma con que lo digas. Aquí hay tres capas de prueba, y la
tercera es nueva de hoy porque las dos primeras tenían un hueco:

| Prueba | Qué demuestra | Hueco que dejaba |
|---|---|---|
| Lectura del código | Ninguna llamada de red en el motor | Depende de que alguien la repita a mano |
| Verificación en vivo | La interfaz no pide nada fuera | **Solo ve el renderer, y la inferencia no vive ahí** |
| `npm run check:sin-red` | El código que se empaqueta no puede pedir nada | Ninguno conocido. Se prueba a sí misma |

El hueco era real y grave: el README afirmaba comprobar que no había peticiones
fuera de `localhost`, pero la única comprobación miraba el proceso equivocado.
Un jurado técnico lo habría encontrado en diez minutos y habría sido una mala
conversación.

**Por dónde te atacarían igualmente:** «dices cien por cien local y la primera
puesta en marcha se baja casi cuatro gigas por HTTP». Es cierto, está declarado
en el README, y el procedimiento para arrancar sin red está ahora escrito con la
ruta exacta de la caché. La respuesta correcta es darla antes de que la
pregunten, y demostrarlo con el WiFi apagado.

### 2. Declarar toda base preexistente y todo código generado · **cumple hoy, no cumplía esta mañana**

El README declaraba dos bases preexistentes que **no existían**. Todo el
proyecto se construyó dentro de la ventana del reto, y el propio historial lo
respalda: el primer commit y la fusión del trabajo de Diego son del mismo 9 de
septiembre.

Declarar de más no descalifica, pero es una afirmación falsa en el documento que
el jurado lee primero, y regala una pregunta que no tenía por qué existir. Ya
está corregido, y ahora se declara lo que sí hay que declarar: el SDK, los
modelos, las dependencias, el andamiaje de `electron-vite`, la asistencia de
inteligencia artificial con revisión humana, y la marca Philips.

---

## Los entregables

| Qué pide el reto | Estado | Riesgo |
|---|---|---|
| Repositorio accesible durante toda la evaluación | **Parcial** | Alto |
| Instrucciones para que otra persona lo corra | Cumple | Bajo |
| Video de 5 minutos, enlace sin contraseña | **No existe** | **Crítico** |
| Flujo de usuario completo, que corre de verdad | Cumple | Bajo |

### El repositorio recibe mal a quien entra

**Actualizado el 2026-09-10.** `main` **ya está publicado**: los trece commits que
faltaban (el cambio de nombre a MAM, la barra lateral, la corrección de la
declaración de origen, la comprobación de ausencia de red, el guion del video y
el arnés de grabación) están en el remoto, con cabeza `689b417`.

Lo que sigue abierto es otra cosa, y es la que importa: **la rama predeterminada
en GitHub sigue siendo `prueba-de-acceso`**, trece commits por detrás. Un jurado
que abra el enlace aterriza en el README viejo, con el nombre viejo y con una
declaración de origen contraria a la que vale. No se arregla solo al publicar
`main`, como decía la D59: hace falta cambiar la predeterminada desde la
configuración del repositorio, que pide permiso de administración, o adelantar
`prueba-de-acceso` hasta la cabeza de `main`, que es un avance directo y solo
necesita permiso de escritura. Ver D68.

### El video: ya no falta todo, falta grabarlo

Es lo primero que revisa el jurado, antes que el código. Sigue sin existir el
archivo, pero ya no se parte de cero:

- **Guion completo** en `docs/GUION-VIDEO.md`: trece planos, 4:58, narración
  palabra por palabra con el conteo contra la capacidad de cada plano, y una
  sección de riesgos en vivo. Cada cifra que cita sale de un archivo del
  repositorio; ninguna inventada.
- **Coreografía automatizada** en `scripts/grabar-demo.mjs`. `npm run demo:ensayo`
  recorre y cronometra sin gastar una toma; `npm run demo:grabar` graba la
  pantalla. Ensayado de punta a punta: **4:58 exactos, los trece planos sin
  desviación**.
- **Lo que falta:** memoria libre para grabar, y la narración encima.

El README tiene el sitio del enlace marcado en la primera línea.

---

## Dónde te atacaría yo, en orden

### 1. «Tu extractor falla dos de cada diez veces y vendes calidad del dato»

Es el golpe más fuerte y es cierto: 8 de 10 en el banco oficial.

La respuesta no es defender el 8, es que **el 8 es el punto**. Un modelo pequeño
no falla gritando, falla con buena letra: en las mediciones, uno reportó cuarenta
tomógrafos en Roma sobre una nota que hablaba de quince monitores en un hospital
sin equipo de imagen, con formato impecable y listo para guardarse. Aquí cada
dato lleva la cita textual que lo justifica, validada como subcadena antes de
guardarse; si la cita no aparece, la fila baja a confianza baja y se marca en
pantalla. **El fallo es auditable en vez de invisible**, que es exactamente lo
que el brief de Philips pregunta cuando habla de distinguir una observación de
un hecho verificado.

Dicho primero, es el diferenciador. Dicho a la defensiva, es una excusa.

### 2. «Se te murió en tu propia máquina»

Pasó dos veces hoy, durante las pruebas, y de dos formas distintas.

**Muere.** Los tres modelos piden unos 4,2 GB y con la memoria apretada el motor
se muere a mitad de carga. El mensaje del SDK era mudo: hablaba de un proceso que
salió, sin sugerir que el problema fuera la memoria. Ya se traduce y dice cuántos
gigas quedaban.

**O peor: no muere, se arrastra.** Medido en el ensayo del video:

| Memoria libre | La misma consulta | El video entero |
|---|---|---|
| 0,4 GB | 175 s | 7:23, incumple el reto |
| 1,8 GB | 13,7 s | 4:58 |

Doce veces más lento, sin un solo error y sin ninguna señal en pantalla. Un
jurado que viera eso concluiría que la aplicación es lenta, y no lo es. **Este es
el riesgo número uno de la demostración**, por encima de cualquier fallo del
modelo. La máquina se prepara cerrando todo antes de grabar o presentar, y el
arnés de grabación se niega a empezar por debajo de 1,5 GB libres.

### 3. «¿Esto lo probaste o lo escribiste?»

Aquí el expediente es fuerte y conviene enseñarlo sin que lo pidan:

| Qué | Resultado |
|---|---|
| Extracción, 10 casos oficiales en español | 8/10 |
| Pregunta en español, Anexo F | 10/10 |
| Intención y agrupación | 5/5 |
| Consultas de varias condiciones | 5/5 |
| Interfaz contra la aplicación real | 86/86 |
| Contraste declarado, dos temas | 150/150 |
| Contraste sobre la app viva | 32 estados en dos temas, incluidos ratón encima y presionado, 0 fallos |
| El motor sin interfaz | humo completo OK |
| El estado de los modelos no miente | 9/9 sin interfaz, 3/3 en vivo |

Todo reproducible con un comando, y los JSON de evidencia están en el
repositorio.

### 4. «La voz solo la has probado contigo»

Sigue abierto. El dictado se ha probado con audio sintético y con el micrófono
de la auditoría, no con la voz real de Diego en una sala con ruido. Es el
componente más vistoso del video y el menos probado. **Si no da tiempo a
probarlo en condiciones, no debería ser el centro de la demo.**

### 5. «Prometes cosas que no enseñas»

El reto dice que declarar el alcance con honestidad suma y prometer de más
resta. El README ahora lista lo que quedó fuera por tiempo y no por diseño:
búsqueda sobre documentos, lectura de placa por foto, dictado en streaming,
móvil y sincronización. Eso está bien planteado, **siempre que el video no las
enseñe como si existieran**.

---

## Lo que haría en las próximas horas, en este orden

1. ~~**Subir `main`** al repositorio del jurado.~~ **Hecho el 2026-09-10:** los
   trece commits están publicados, cabeza `689b417`.
2. **Que Diego cambie la rama predeterminada a `main`** y borre
   `prueba-de-acceso`. Necesita permiso de administración. Sigue pendiente, y es
   lo que decide con qué README se encuentra el jurado. Alternativa sin admin:
   adelantar `prueba-de-acceso` hasta `main`, que es un avance directo. Ver D68.
3. **Grabar el video.** Es el único punto crítico. Sin él no hay entrega. El
   guion y la coreografía ya están; hace falta cerrar aplicaciones para tener
   memoria y poner la narración encima.
3b. **Decidir el dictado.** El guion lo deja fuera a propósito y lo justifica en
   la narración, pero el producto se presenta como «de la voz al dato». O entra
   un plano corto de dictado, o no se lidera con la voz.
4. **Poner el enlace en la primera línea del README** y comprobarlo en una
   ventana privada, sin sesión iniciada.
5. **Instalar en un perfil de Windows limpio** y correr el ciclo con el WiFi
   apagado. Es la única evidencia de que un juez puede instalarlo, y hoy no
   existe.
6. **Decidir la voz** con el audio real de Diego. Si no convence, sale del video
   y se declara como trabajo futuro. No se entrega a medias.
7. Confirmar por escrito lo de un track por equipo.

---

## Lo que no pude verificar

- **Que un juez pueda instalarlo.** El instalador `MAM-1.0.0-setup.exe` (595 MB)
  está construido y verificado **arrancando desde el ejecutable empaquetado**:
  los tres modelos cargan, una extracción real tarda 14,7 s, devuelve el sitio
  correcto con su cita y no inventa el equipo que la nota negaba, y no hace una
  sola petición fuera del equipo. Lo que sigue sin probarse es un **perfil de
  Windows limpio**, que es lo único que demuestra que otra persona puede
  instalarlo.
- **Que el nombre de ningún cliente inventado coincida por casualidad con una
  institución real.** Se usa la convención DemoCare y las ciudades son reales a
  propósito, pero no hay forma de probar la ausencia desde aquí.
- **El comportamiento con la voz real de Diego.**
- **Las licencias vigentes del SDK y los modelos.** Solo se comprobó la
  coherencia interna de lo declarado.
