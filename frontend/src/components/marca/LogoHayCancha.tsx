type Props = {
  className?: string
  /** Sobre fondos oscuros (noche), "Hay" va en verde claro. */
  sobreOscuro?: boolean
}

/** La marca: el escudo circular verde con "HC", las líneas de una cancha y las pelotas
 * (public/logo-haycanchas.png). Colores fijos: se ve igual en modo claro y oscuro. */
export function MarcaBurbuja({ className = '' }: { className?: string }) {
  return <img src="/logo-haycanchas.png" alt="" aria-hidden="true" draggable={false} className={`aspect-square rounded-full object-contain ${className}`} />
}

/** Logo completo. El tamaño sale del font-size (por ejemplo, `text-[27px]`). */
export function LogoHayCancha({ className = '', sobreOscuro = false }: Props) {
  return (
    <span role="img" aria-label="HayCanchas" className={`inline-flex items-center gap-[.37em] ${className}`}>
      <MarcaBurbuja className="h-[1.35em] w-auto flex-none" />
      <span aria-hidden="true" className={`font-titulo leading-none font-extrabold whitespace-nowrap uppercase ${sobreOscuro ? 'text-cal' : 'text-noche'}`}>
        <span className={sobreOscuro ? 'text-cesped-claro' : 'text-cesped'}>Hay</span>canchas
      </span>
    </span>
  )
}
