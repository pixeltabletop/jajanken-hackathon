// Catálogo cerrado del dominio. Único origen de verdad para main y renderer.
// Los índices importan: el modelo devuelve enteros y se resuelven contra estos arrays.
// Cambiar el orden rompe el esquema compacto medido. No reordenar.

export const MODALITIES = [
  'MR',
  'CT',
  'Ultrasound',
  'X-Ray',
  'Patient Monitoring',
  'Image Guided Therapy',
  'Other'
] as const

export const BRANDS = [
  'NovaMed',
  'Aurelia Health',
  'BluePeak Medical',
  'Orion Imaging',
  'HelixCare',
  'Zenith MedTech'
] as const

export const STATUSES = ['Confirmed', 'Reported', 'Estimated', 'Unknown'] as const

export const CONFIDENCE = ['High', 'Medium', 'Low'] as const

export const AGE_QUALITATIVE = ['new', 'recent', 'old', 'very old'] as const

export type Modality = (typeof MODALITIES)[number]
export type Brand = (typeof BRANDS)[number]
export type Status = (typeof STATUSES)[number]
export type Confidence = (typeof CONFIDENCE)[number]
export type AgeQualitative = (typeof AGE_QUALITATIVE)[number]

// Etiquetas en español para la interfaz. Los valores guardados siguen en inglés.
export const MODALITY_LABEL_ES: Record<Modality, string> = {
  MR: 'Resonancia magnética',
  CT: 'Tomografía',
  Ultrasound: 'Ecografía',
  'X-Ray': 'Rayos X',
  'Patient Monitoring': 'Monitoreo de paciente',
  'Image Guided Therapy': 'Terapia guiada por imagen',
  Other: 'Otro'
}

export const STATUS_LABEL_ES: Record<Status, string> = {
  Confirmed: 'Confirmado',
  Reported: 'Reportado',
  Estimated: 'Estimado',
  Unknown: 'Desconocido'
}

export const CONFIDENCE_LABEL_ES: Record<Confidence, string> = {
  High: 'Alta',
  Medium: 'Media',
  Low: 'Baja'
}

// Pregunta de seguimiento por campo faltante. Paso 12 de la lógica de agente de Philips.
export const FOLLOW_UP_ES: Record<string, string> = {
  brand: '¿Sabes la marca o el fabricante del equipo?',
  model: '¿Alcanzaste a ver el modelo o la familia del producto?',
  approxAgeYears: '¿Aproximadamente cuántos años tiene el equipo?',
  city: '¿En qué ciudad queda este sitio?',
  country: '¿En qué país está el cliente?',
  quantity: '¿Cuántas unidades viste exactamente?'
}
