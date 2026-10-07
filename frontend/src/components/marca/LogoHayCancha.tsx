type Props = {
  className?: string
  /** Sobre fondos oscuros (noche), "Hay" va en verde claro. */
  sobreOscuro?: boolean
}

/** La marca: la burbuja de chat con "¿?", la pregunta que se manda en el grupo. El punto del
 * "?" es una pelota (de cualquier deporte). Colores fijos: se ve igual en modo claro y oscuro. */
export function MarcaBurbuja({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 46" className={className} aria-hidden="true" focusable="false">
      <path d="M13 2h22a11 11 0 0 1 11 11v11a11 11 0 0 1-11 11H21l-9.5 8.5V34.4A11 11 0 0 1 2 24V13A11 11 0 0 1 13 2z" fill="#1E7A3E" />
      <g fill="none" stroke="#F6F1E6" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M27.5 12.6a5.2 5.2 0 1 1 7.6 4.6c-1.9 1-2.9 2.3-2.9 4.4v.8" />
        <path d="M20.5 24.4a5.2 5.2 0 1 1-7.6-4.6c1.9-1 2.9-2.3 2.9-4.4v-.8" />
      </g>
      <circle cx="16" cy="9.3" r="2.3" fill="#F6F1E6" />
      <circle cx="32.2" cy="28.4" r="3.1" fill="#57C986" />
    </svg>
  )
}

/** Logo completo. El tamaño sale del font-size (por ejemplo, `text-[27px]`). */
export function LogoHayCancha({ className = '', sobreOscuro = false }: Props) {
  return (
    <span role="img" aria-label="HayCanchas" className={`inline-flex items-center gap-[.37em] ${className}`}>
      <MarcaBurbuja className="h-[1.15em] w-auto flex-none" />
      <span aria-hidden="true" className={`font-titulo leading-none font-extrabold whitespace-nowrap uppercase ${sobreOscuro ? 'text-cal' : 'text-noche'}`}>
        <span className={sobreOscuro ? 'text-cesped-claro' : 'text-cesped'}>Hay</span>canchas
      </span>
    </span>
  )
}
