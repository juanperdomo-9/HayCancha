import { DibujoCancha } from '../cancha/DibujoCancha'

type Props = {
  portadaUrl: string | null
  deporte: string
  className?: string
  animado?: boolean
}

/** La foto de portada del complejo o, si no tiene, el dibujo de su cancha. Posicionala con className. */
export function PortadaComplejo({ portadaUrl, deporte, className = 'relative', animado = false }: Props) {
  if (portadaUrl) {
    return (
      <div className={`overflow-hidden bg-complejo-profundo ${className}`}>
        <img src={portadaUrl} alt="" className="absolute inset-0 size-full object-cover" />
      </div>
    )
  }
  return <DibujoCancha deporte={deporte} animado={animado} className={className} />
}
