// Puente al motor de consulta compartido. La lógica vive en
// src/shared/query-engine.ts para que el banco de mediciones la ejercite desde
// Node sin Electron. Aquí solo se reexporta con el nombre que ya usan los
// componentes, para que exista un único camino de filtrado en toda la app.

export {
  applyFilter,
  applyFilterAudited,
  countActive,
  describeFilter,
  describeFilterParts,
  EMPTY_FILTER,
  flatten,
  isEmptyFilter,
  norm,
  withoutField
} from '../../../shared/query-engine.ts'

export type { EquipmentHit as EquipmentRowView, FilterPart } from '../../../shared/query-engine.ts'
