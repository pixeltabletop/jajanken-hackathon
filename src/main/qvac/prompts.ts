// System prompts, tal cual se midieron. Cambiar una palabra cambia la calidad
// de la extraccion: no se tocan sin volver a medir.

import { BRANDS, CONFIDENCE, MODALITIES, STATUSES } from '../../shared/catalog.ts'

const idx = (arr: readonly string[]): string => arr.map((v, i) => `${i}=${v}`).join(' ')

// Medido: 8/10 casos oficiales de Philips en español, 14/14 citas textuales,
// 12.0 s por nota con Gemma 2B y ctx 4096.
export const PROMPT_EXTRACT_ES = `Extraes equipo medico de una nota de campo. Responde solo el JSON compacto.
Claves: f sitio, ci ciudad, eq equipos. Por equipo: m modalidad, q cantidad, e cantidad estimada,
b marca, a edad en anios, c confianza, s estado, ev evidencia.

m: ${idx(MODALITIES)}
b: -1=desconocida ${idx(BRANDS)}
c: ${idx(CONFIDENCE)}
s: ${idx(STATUSES)}

Reglas:
1. Solo equipo que el observador VIO. Si la nota dice que algo NO estaba, no crees fila.
2. b=-1 si no se menciona la marca. Nunca adivines una marca.
3. e=true SOLO si la cantidad viene con duda: "unos", "quizas", "varios", "como". Si dice un numero claro, e=false.
4. a solo si se menciona un numero de anios. Si dice "nuevo" o "viejo" sin numero, a=null.
5. Si la misma modalidad tiene edades distintas, crea filas separadas.
6. ev es la cita TEXTUAL de la nota que justifica la fila, copiada palabra por palabra.
Sinonimos: resonancia/resonador/MRI=0, tomografo/scanner/CT=1, ecografo/ultrasonido=2, monitores de paciente=4.`

// Vocabulario que se siembra en Whisper. Llevó los nombres propios de 1/10 a 9/10
// con el mismo modelo.
export function whisperHint(customerNames: string[], brands: readonly string[] = BRANDS): string {
  const hospitals = customerNames.length ? customerNames.join(', ') : 'ninguno registrado'
  return `Nota de campo de un tecnico de equipo medico. Hospitales: ${hospitals}. Marcas: ${brands.join(', ')}.`
}

// Interpretación de la pregunta en español. El modelo traduce la pregunta a un
// plan de consulta y NADA más: los conteos los calcula query-engine.ts.
//
// Iteración 3 (2026-09-09, tarde). La 1 daba 6/10, la 2 llegó a 10/10 en el
// Anexo F. Esta añade lo que Josué pidió probar: consultas de varias condiciones
// como "equipos de Panamá, en San Francisco, con confianza baja o media". La
// versión anterior las rompía por dos sitios:
//   1. Un solo `lugar` para toda la frase: "Panamá" y "San Francisco" acababan
//      pegados en una sola cadena que no era ni país ni ciudad. Ahora es
//      `lugares`, una lista, y la categoría de cada uno la sigue decidiendo el
//      código contra el catálogo, no el modelo.
//   2. Una sola confianza y un solo estado: "baja o media" perdía la segunda.
//      Ahora `c` y `s` son listas, y una lista vacía significa "cualquiera".
export const PROMPT_QUERY_ES = `Traduces una pregunta en espanol sobre una base de equipo medico a un plan de consulta. Responde solo el JSON compacto.
Claves: lugares, m modalidades, b marcas, amin edad minima en anios, amax edad maxima, s estados, c confianzas, i intencion, g agrupacion.
lugares, m, b, s y c son LISTAS. Una lista vacia [] significa "cualquiera", y es lo que va cuando la pregunta no lo menciona. En la duda, deja la lista vacia.

m: ${idx(MODALITIES)}
b: ${idx(BRANDS)}
c: ${idx(CONFIDENCE)}
s: ${idx(STATUSES)}
i: 0=lista, enumera filas 1=conteo, una sola cifra 2=desglose por grupo
g: -1=ninguna 0=pais 1=ciudad 2=sitio 3=modalidad 4=marca 5=estado 6=confianza 7=antiguedad
   g es SIEMPRE la dimension por la que se pide el reparto, NUNCA el lugar donde se pide.
   "el estatus de las unidades en Panama" -> g=5 (estatus), NO g=0. El lugar va en lugares.

Reglas:
1. lugares es la lista de paises, ciudades u hospitales que NOMBRA la pregunta, cada uno copiado TAL CUAL y por separado, sin preposiciones. "de Panama, en San Francisco" -> ["Panama","San Francisco"]. Si no nombra ninguno, [].
2. Nunca escribas un lugar que no aparezca en la pregunta. No completes el pais de una ciudad ni al reves.
3. Edad con numero, manda el numero de la pregunta: "de mas de N anios" -> amin=N, amax=null. "de menos de N anios" -> amax=N, amin=null. "de N anios o mas" -> amin=N.
3b. Edad sin ningun numero: "nuevos" o "recientes" -> amax=3 y amin=null. "viejos" o "antiguos" -> amin=8 y amax=null. Si la pregunta trae un numero, esta regla NO aplica.
4. c y s recogen TODAS las opciones que pida la pregunta. "confianza baja o media" -> c=[2,1]. "baja" -> c=[2]. Sin mencion -> c=[].
5. i=1 (conteo) solo si empieza por "cuantos" o "cuantas".
6. i=2 (desglose) si la pregunta pide como se reparte un conjunto. Disparadores y su g:
   "cual es el estatus de" -> i=2, g=5 - "que marcas hay" -> i=2, g=4 - "que modalidades hay" -> i=2, g=3 - "que paises" -> i=2, g=0 - "que ciudades" -> i=2, g=1 - "por confianza" -> i=2, g=6 - "por antiguedad" -> i=2, g=7 - "distribucion por X" o "reparto por X" o "como se reparte por X" -> i=2, g=X.
7. i=0 (lista) en los demas casos: "cuales", "dame", "muestra", "que hay en", "que tiene".
8. Sinonimos de modalidad: resonancia/resonador/MRI=0, tomografo/scanner/CT=1, ecografo/ultrasonido=2, rayos x=3, monitores de paciente=4.
9. Solo se llena lo que la pregunta dice con sus palabras. Si no nombra marca, b=[]. Si no nombra tipo de equipo, m=[]. Si no habla de estado, s=[]. Si no habla de confianza, c=[]. Nunca deduzcas un valor "probable".

Ejemplos (ninguno es una consulta del banco de medicion):
"cuantos tomografos hay" -> {"lugares":[],"m":[1],"b":[],"amin":null,"amax":null,"s":[],"c":[],"i":1,"g":-1}
"muestra los equipos Orion Imaging" -> {"lugares":[],"m":[],"b":[3],"amin":null,"amax":null,"s":[],"c":[],"i":0,"g":-1}
"como se reparte la base por ciudad" -> {"lugares":[],"m":[],"b":[],"amin":null,"amax":null,"s":[],"c":[],"i":2,"g":1}
"que modalidades hay en Peru" -> {"lugares":["Peru"],"m":[],"b":[],"amin":null,"amax":null,"s":[],"c":[],"i":2,"g":3}
"equipos reportados o estimados en Brasil, en Campinas" -> {"lugares":["Brasil","Campinas"],"m":[],"b":[],"amin":null,"amax":null,"s":[1,2],"c":[],"i":0,"g":-1}
"equipos de mas de cuatro anios en el Hospital DemoCare Pines" -> {"lugares":["Hospital DemoCare Pines"],"m":[],"b":[],"amin":4,"amax":null,"s":[],"c":[],"i":0,"g":-1}`
