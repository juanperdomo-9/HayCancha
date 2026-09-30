import { Navigation } from 'lucide-react'

import { consultaMaps, urlComoLlegar, urlMapaEmbebido } from '../../utils/mapas'

type Props = {
  nombre: string
  direccion: string | null
  barrio: string | null
  referencia?: string | null
}

const CLAVE_MAPS = import.meta.env.VITE_GOOGLE_MAPS_KEY

/** Dónde queda el complejo: mapa de Google y botón para ir con Maps. */
export function MapaComplejo({ nombre, direccion, barrio, referencia }: Props) {
  const consulta = consultaMaps({ direccion, barrio })
  if (!consulta) {
    return <p className="text-tenue">Dirección a confirmar.</p>
  }

  return (
    <div className="grid gap-3">
      <iframe
        title={`Mapa de ${nombre}`}
        src={urlMapaEmbebido(consulta, CLAVE_MAPS)}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="aspect-[16/10] w-full rounded-2xl border border-borde bg-superficie"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-tenue">
          {direccion}
          {barrio && ` · ${barrio}`}
          {referencia && <span className="block text-sm">{referencia.charAt(0).toUpperCase() + referencia.slice(1)}</span>}
        </p>
        <a
          href={urlComoLlegar(consulta)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-complejo px-4 py-2.5 font-semibold text-complejo-sobre transition hover:brightness-105"
        >
          <Navigation className="size-4" aria-hidden="true" />
          Cómo llegar
        </a>
      </div>
    </div>
  )
}
