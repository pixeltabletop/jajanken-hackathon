// Esquema v2 — derivado de las 19 columnas del workbook de Philips,
// mas tres campos que el workbook no pide y que creemos necesarios.
//
// Lo que el modelo extrae vs lo que rellena la aplicacion:
//   App:      Observation ID, Observer, Visit Date, Source
//   Modelo:   todo lo demas
//   Derivado: Estimated Installation Year = ano de visita - approx_age_years
//
// Añadidos nuestros, no estan en el workbook:
//   evidence            -> la cita textual de la nota que justifica la fila.
//                          Sin esto no hay forma de auditar una alucinacion.
//   quantity_is_estimate-> el workbook mezcla "vi dos" con "quizas ocho" y los
//                          distingue solo por la columna Status. Un booleano
//                          separado permite mostrarlo en la interfaz.
//   missing_fields      -> alimenta la pregunta de seguimiento del paso 12.

export const MODALITIES = ['MR', 'CT', 'Ultrasound', 'X-Ray', 'Patient Monitoring', 'Image Guided Therapy', 'Other'];
export const BRANDS = ['NovaMed', 'Aurelia Health', 'BluePeak Medical', 'Orion Imaging', 'HelixCare', 'Zenith MedTech'];
export const STATUSES = ['Confirmed', 'Reported', 'Estimated', 'Unknown'];
export const CONFIDENCE = ['High', 'Medium', 'Low'];

export const OBSERVATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['facility', 'city', 'country', 'equipment', 'missing_fields'],
  properties: {
    facility: { type: 'string' },
    city: { type: ['string', 'null'] },
    country: { type: ['string', 'null'] },
    equipment: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['modality', 'quantity', 'quantity_is_estimate', 'brand', 'model',
                   'approx_age_years', 'age_qualitative', 'confidence', 'status', 'evidence'],
        properties: {
          modality: { type: 'string', enum: MODALITIES },
          quantity: { type: 'integer', minimum: 1 },
          quantity_is_estimate: { type: 'boolean' },
          brand: { type: ['string', 'null'] },
          model: { type: ['string', 'null'] },
          approx_age_years: { type: ['number', 'null'] },
          age_qualitative: { type: ['string', 'null'], enum: ['new', 'recent', 'old', 'very old', null] },
          confidence: { type: 'string', enum: CONFIDENCE },
          status: { type: 'string', enum: STATUSES },
          evidence: { type: 'string' },
          notes: { type: ['string', 'null'] }
        }
      }
    },
    missing_fields: { type: 'array', items: { type: 'string' } }
  }
};

const RULES_EN = `You extract medical-equipment observations from a field note.

Rules:
1. Only include equipment the observer actually saw. If the note says equipment was NOT present, do not create a row for it.
2. "evidence" must be an exact word-for-word quote from the note that justifies that row. Never paraphrase it.
3. If the note mentions the same modality with different ages, split it into separate rows.
4. brand and model are null when not stated. Never guess a brand.
5. quantity_is_estimate is true for hedged counts such as "about six", "maybe eight", "several".
6. status: Confirmed if directly observed and certain, Reported if the observer states it plainly, Estimated if hedged or approximate, Unknown if barely supported.
7. approx_age_years is a number only when a number or range is stated. For a range use the midpoint. For vague words like "new" or "old" leave it null and fill age_qualitative instead.
8. missing_fields lists the field names you could not fill and that are worth asking about, such as "brand", "model", "approx_age_years", "city".

Normalize synonyms: MRI and resonancia become MR. Scanner, tomografo and tomografia become CT. Ecografo and ultrasonido become Ultrasound. Monitores de paciente becomes Patient Monitoring.`;

const EXAMPLE = `
Example note: "At Clinica Sur I saw two X-ray units, maybe three. No ultrasound there."
Example output: {"facility":"Clinica Sur","city":null,"country":null,"equipment":[{"modality":"X-Ray","quantity":2,"quantity_is_estimate":true,"brand":null,"model":null,"approx_age_years":null,"age_qualitative":null,"confidence":"Medium","status":"Estimated","evidence":"I saw two X-ray units, maybe three","notes":null}],"missing_fields":["brand","approx_age_years","city"]}`;

export const SYSTEM_EN = RULES_EN + EXAMPLE;

export const SYSTEM_ES = `Extraes observaciones de equipo medico a partir de una nota de campo.
La nota viene en espanol. Los valores del JSON van en ingles segun el catalogo, pero "evidence" va en espanol, copiado textual de la nota.
` + RULES_EN.split('\n').slice(2).join('\n') + EXAMPLE;
