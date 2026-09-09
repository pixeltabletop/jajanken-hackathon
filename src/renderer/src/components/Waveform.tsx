import { useEffect, useRef, useState, type JSX } from 'react'

// Barras que reaccionan al micrófono. No es decoración: si el técnico habla y
// las barras no se mueven, sabe al instante que el micrófono no está entrando,
// en vez de descubrirlo cuando la transcripción sale vacía.
const BARS = 28

export function Waveform({ level, seconds }: { level: number; seconds: number }): JSX.Element {
  const [phase, setPhase] = useState(0)
  const raf = useRef(0)

  useEffect(() => {
    const tick = (): void => { setPhase((p) => p + 0.14); raf.current = requestAnimationFrame(tick) }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [])

  return (
    <div className="wave" role="status" aria-label={`Grabando, ${seconds.toFixed(0)} segundos`}>
      <div className="wave-bars" aria-hidden="true">
        {Array.from({ length: BARS }, (_, i) => {
          // Envolvente suave para que el centro se mueva más que los bordes.
          const env = Math.sin((i / (BARS - 1)) * Math.PI)
          const wob = 0.45 + 0.55 * Math.abs(Math.sin(phase + i * 0.5))
          const h = Math.max(3, Math.round(4 + level * 34 * env * wob))
          return <i key={i} style={{ height: `${h}px` }} />
        })}
      </div>
      <span className="wave-time">{seconds.toFixed(0)} s</span>
    </div>
  )
}
