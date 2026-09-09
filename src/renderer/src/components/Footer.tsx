import type { JSX } from 'react'

// Pie obligatorio (blueprint sección 7): la app usa el logo del patrocinador del
// track y debe leerse como prototipo del equipo, no como producto de Philips.
export function Footer(): JSX.Element {
  return (
    <footer className="legal">
      <b>Eco</b> · Prototipo del equipo Jajanken para el reto Philips · Hackathon ISD Summit 2026 · No es un producto oficial de Philips.
      <br />
      Todos los clientes, marcas y equipos son sintéticos: 13 sitios del workbook de Philips y 10 sitios ficticios de Panamá. Ninguna cifra describe una institución real.
      <br />
      Inferencia 100% local con QVAC: Gemma 2B (extracción), Whisper Base (voz), EmbeddingGemma 300M (deduplicación). Ningún dato sale de esta computadora.
    </footer>
  )
}
