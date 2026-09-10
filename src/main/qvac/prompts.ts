// System prompts. Verbatim de las mediciones en bench/. Cambiar una palabra
// obliga a correr `npm run bench:extract` y anotar el resultado en DECISIONES.md.

import { BRANDS, CONFIDENCE, MODALITIES, STATUSES } from '../../shared/catalog.ts'

const idx = (arr: readonly string[]): string => arr.map((v, i) => `${i}=${v}`).join(' ')

// Medido: 8/10 casos oficiales de Philips en español, 14/14 citas textuales,
// 12.0 s por nota con Gemma 2B y ctx 4096. bench/compacto10_GEMMA4_2B_MULTIMODAL_Q4_K_M_es.json
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
// con el mismo modelo. bench/asr_WHISPER_BASE_Q8_0_es+prompt.json
export function whisperHint(customerNames: string[], brands: readonly string[] = BRANDS): string {
  const hospitals = customerNames.length ? customerNames.join(', ') : 'ninguno registrado'
  return `Nota de campo de un tecnico de equipo medico. Hospitales: ${hospitals}. Marcas: ${brands.join(', ')}.`
}

// Interpretación de la pregunta en español (Bloque 4B). El modelo traduce la
// pregunta a un plan de consulta y NADA más: los conteos los calcula
// src/shared/query-engine.ts.
//
// Iteración 2 (la única que permite la puerta de calidad). La 1 daba 6/10 y 2/5.
// Tres cambios, cada uno contra un fallo medido en bench/query-anexoF.json:
//   1. El lugar deja de ser dos indices (pais y ciudad) y pasa a ser UNA cadena
//      copiada de la pregunta. El modelo ya no decide la categoria, la decide
//      resolvePlan() contra el catalogo. Mataba 4 de los 8 fallos: preguntar por
//      "Panama" acababa como ciudad "Panama City", y "DemoCare Chiriqui" como
//      ciudad "Chitre".
//   2. La regla de la edad pone el numero de la pregunta por delante del atajo
//      de "viejos": "mas de diez anios" salia como 8.
//   3. La intencion trae disparadores explicitos: "cual es el estatus de" y
//      "que X hay" son desglose, no conteo ni lista.
// Ningun ejemplo es una consulta del banco.
export const PROMPT_QUERY_ES = `Traduces una pregunta en espanol sobre una base de equipo medico a un plan de consulta. Responde solo el JSON compacto.
Claves: lugar, m modalidad, b marca, amin edad minima en anios, amax edad maxima, s estado, c confianza, i intencion, g agrupacion.
Los indices usan -1 para "cualquiera".

m: ${idx(MODALITIES)}
b: ${idx(BRANDS)}
c: ${idx(CONFIDENCE)}
s: ${idx(STATUSES)}
i: 0=lista, enumera filas 1=conteo, una sola cifra 2=desglose por grupo
g: -1=ninguna 0=pais 1=ciudad 2=sitio 3=modalidad 4=marca 5=estado 6=confianza 7=antiguedad

Reglas:
1. lugar es el pais, la ciudad o el hospital que nombra la pregunta, copiado TAL CUAL de la pregunta, sin la preposicion. Si la pregunta no nombra ningun lugar, lugar=null. Nunca escribas un lugar que no aparezca en la pregunta.
2. Edad con numero, manda el numero de la pregunta: "de mas de N anios" -> amin=N, amax=null. "de menos de N anios" -> amax=N, amin=null. "de N anios o mas" -> amin=N.
2b. Edad sin ningun numero en la pregunta: "nuevos" o "recientes" -> amax=3 y amin=null. "viejos" o "antiguos" -> amin=8 y amax=null. Si la pregunta trae un numero, esta regla NO aplica.
3. i=1 (conteo) solo si empieza por "cuantos" o "cuantas".
4. i=2 (desglose) si la pregunta pide como se reparte un conjunto. Disparadores: "cual es el estatus de", "que marcas hay", "que modalidades hay", "que paises hay", "distribucion por", "reparto por", "como se reparte". Con i=2, g es SIEMPRE la dimension que nombra la pregunta, no el lugar:
   estatus o estado -> g=5 · marcas -> g=4 · modalidades o tipos de equipo -> g=3 · paises -> g=0 · ciudades -> g=1 · sitios u hospitales -> g=2 · confianza -> g=6 · antiguedad o edad -> g=7.
   El lugar de la pregunta va en "lugar", nunca en g. "cual es el estatus de las unidades en Brasil" es g=5 (estatus), no g=0.
5. i=0 (lista) en los demas casos: "cuales", "dame", "muestra", "que hay en", "que tiene".
6. Sinonimos de modalidad: resonancia/resonador/MRI=0, tomografo/scanner/CT=1, ecografo/ultrasonido=2, rayos x=3, monitores de paciente=4.
7. "confianza baja"->c=2. "estimados"->s=2. "confirmados"->s=0. "reportados"->s=1.
8. No pongas nada que la pregunta no diga. Sin marca preguntada, b=-1. Sin modalidad preguntada, m=-1.

Ejemplos (ninguno es una consulta del banco de medicion):
"cuantos tomografos hay" -> {"lugar":null,"m":1,"b":-1,"amin":null,"amax":null,"s":-1,"c":-1,"i":1,"g":-1}
"muestra los equipos Orion Imaging" -> {"lugar":null,"m":-1,"b":3,"amin":null,"amax":null,"s":-1,"c":-1,"i":0,"g":-1}
"como se reparte la base por ciudad" -> {"lugar":null,"m":-1,"b":-1,"amin":null,"amax":null,"s":-1,"c":-1,"i":2,"g":1}
"que modalidades hay en Peru" -> {"lugar":"Peru","m":-1,"b":-1,"amin":null,"amax":null,"s":-1,"c":-1,"i":2,"g":3}
"equipos de mas de cuatro anios en el Hospital DemoCare Pines" -> {"lugar":"Hospital DemoCare Pines","m":-1,"b":-1,"amin":4,"amax":null,"s":-1,"c":-1,"i":0,"g":-1}`
