import type { ReactNode } from 'react'

/**
 * Cancha vista desde arriba, con franjas de pasto cortado y líneas de cal.
 * Toma los colores del <TemaComplejo> que la envuelve. Es la portada de los
 * complejos que todavía no subieron fotos.
 */

type Grupo = 'futbol' | 'padel' | 'tenis' | 'basquet' | 'voley'

function grupoDeporte(codigo: string): Grupo {
  if (codigo.startsWith('futbol')) return 'futbol'
  if (codigo === 'padel' || codigo === 'tenis' || codigo === 'basquet' || codigo === 'voley') return codigo
  return 'futbol'
}

const LINEAS: Record<Grupo, ReactNode> = {
  futbol: (
    <>
      <rect x="90" y="60" width="1020" height="480" />
      <line x1="600" y1="60" x2="600" y2="540" />
      <circle cx="600" cy="300" r="78" />
      <circle cx="600" cy="300" r="6" className="fill-tiza" />
      <rect x="90" y="160" width="170" height="280" />
      <rect x="90" y="230" width="60" height="140" />
      <rect x="940" y="160" width="170" height="280" />
      <rect x="1050" y="230" width="60" height="140" />
      <path d="M260 245 A 70 70 0 0 1 260 355" />
      <path d="M940 245 A 70 70 0 0 0 940 355" />
    </>
  ),
  padel: (
    <>
      <rect x="120" y="60" width="960" height="480" strokeWidth="2" opacity=".5" />
      <rect x="160" y="100" width="880" height="400" />
      <line x1="600" y1="80" x2="600" y2="520" strokeWidth="3" strokeDasharray="10 9" />
      <line x1="294" y1="100" x2="294" y2="500" />
      <line x1="906" y1="100" x2="906" y2="500" />
      <line x1="294" y1="300" x2="906" y2="300" />
    </>
  ),
  tenis: (
    <>
      <rect x="160" y="97" width="880" height="406" />
      <line x1="160" y1="148" x2="1040" y2="148" />
      <line x1="160" y1="452" x2="1040" y2="452" />
      <line x1="363" y1="148" x2="363" y2="452" />
      <line x1="837" y1="148" x2="837" y2="452" />
      <line x1="363" y1="300" x2="837" y2="300" />
      <line x1="600" y1="80" x2="600" y2="520" strokeWidth="3" strokeDasharray="10 9" />
    </>
  ),
  basquet: (
    <>
      <rect x="120" y="70" width="960" height="460" />
      <line x1="600" y1="70" x2="600" y2="530" />
      <circle cx="600" cy="300" r="70" />
      <rect x="120" y="230" width="220" height="140" />
      <circle cx="340" cy="300" r="70" />
      <rect x="860" y="230" width="220" height="140" />
      <circle cx="860" cy="300" r="70" />
      <path d="M120 110 L200 110 A 250 250 0 0 1 200 490 L120 490" />
      <path d="M1080 110 L1000 110 A 250 250 0 0 0 1000 490 L1080 490" />
    </>
  ),
  voley: (
    <>
      <rect x="240" y="120" width="720" height="360" />
      <line x1="600" y1="90" x2="600" y2="510" strokeWidth="3" strokeDasharray="10 9" />
      <line x1="480" y1="120" x2="480" y2="480" />
      <line x1="720" y1="120" x2="720" y2="480" />
    </>
  ),
}

type Props = {
  /** Código del deporte (`futbol7`, `padel`, `tenis`…). */
  deporte: string
  className?: string
  /** Movimiento lento de cámara, para portadas. */
  animado?: boolean
}

/** `className` tiene que posicionarlo (`relative` o `absolute`): el dibujo va adentro en absoluto. */
export function DibujoCancha({ deporte, className = 'relative', animado = false }: Props) {
  return (
    <div className={`overflow-hidden bg-complejo-profundo ${className}`}>
      <svg
        viewBox="0 0 1200 600"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
        className={`perspectiva-cancha absolute top-[-28%] left-[-10%] h-[150%] w-[120%] ${animado ? 'motion-safe:animate-deriva' : ''}`}
      >
        {Array.from({ length: 14 }, (_, i) => (
          <rect
            key={i}
            x={i * 100 - 100}
            y={-60}
            width={100}
            height={720}
            className={i % 2 ? 'fill-complejo-profundo' : 'fill-complejo-franja'}
          />
        ))}
        <g className="fill-none stroke-tiza" strokeWidth="5" opacity=".85">
          {LINEAS[grupoDeporte(deporte)]}
        </g>
      </svg>
    </div>
  )
}
