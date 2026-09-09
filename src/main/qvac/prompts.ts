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
