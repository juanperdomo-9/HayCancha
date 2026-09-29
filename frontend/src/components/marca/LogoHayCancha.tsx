type Props = {
  className?: string
  /** Sobre fondos oscuros (noche), "Hay" va en verde claro. */
  sobreOscuro?: boolean
}

/** La marca: una cancha vista desde arriba, con líneas de cal. */
export function MarcaCancha({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="46" height="30" rx="6" className="fill-cesped" />
      <g className="fill-none stroke-cal" strokeWidth="2">
        <rect x="6" y="6" width="36" height="20" rx="1" />
        <line x1="24" y1="6" x2="24" y2="26" />
        <circle cx="24" cy="16" r="4.5" />
      </g>
    </svg>
  )
}

/** Logo completo. El tamaño sale del font-size (por ejemplo, `text-[27px]`). */
export function LogoHayCancha({ className = '', sobreOscuro = false }: Props) {
  return (
    <span role="img" aria-label="HayCancha" className={`inline-flex items-center gap-[.37em] ${className}`}>
      <MarcaCancha className="h-[1.1em] w-auto flex-none" />
      <span
        aria-hidden="true"
        className={`font-titulo leading-none font-extrabold whitespace-nowrap uppercase ${sobreOscuro ? 'text-cal' : 'text-noche'}`}
      >
        <span className={sobreOscuro ? 'text-cesped-claro' : 'text-cesped'}>Hay</span>cancha
      </span>
    </span>
  )
}
