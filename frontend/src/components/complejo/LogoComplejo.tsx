import { iniciales } from '../../utils/formato'

type Props = {
  nombre: string
  logoUrl: string | null
  className?: string
}

/** El logo del complejo o, si no subió uno, sus iniciales con su color. Va dentro de <TemaComplejo>. */
export function LogoComplejo({ nombre, logoUrl, className = '' }: Props) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`Logo de ${nombre}`}
        className={`aspect-square rounded-2xl bg-superficie object-contain p-1.5 ring-3 ring-tiza ${className}`}
      />
    )
  }
  return (
    <span
      role="img"
      aria-label={`Logo de ${nombre}`}
      className={`grid aspect-square place-items-center rounded-2xl bg-complejo text-complejo-sobre ring-3 ring-tiza ${className}`}
    >
      <span className="numeros text-[.42em] leading-none font-extrabold" style={{ fontStretch: '75%' }}>
        {iniciales(nombre)}
      </span>
    </span>
  )
}
