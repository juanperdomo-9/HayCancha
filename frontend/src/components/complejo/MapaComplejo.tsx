import { MapPin, Navigation } from 'lucide-react'

import { consultaMaps, urlComoLlegar, urlMapaEmbebido, urlVerEnMaps } from '../../utils/mapas'

type Props = {
  nombre: string
  direccion: string | null
  barrio: string | null
  referencia?: string | null
}

const CLAVE_MAPS = import.meta.env.VITE_GOOGLE_MAPS_KEY

/** Dónde queda el complejo: mapa de Google (si hay clave) y botón para ir con Maps. */
export function MapaComplejo({ nombre, direccion, barrio, referencia }: Props) {
  const consulta = consultaMaps({ direccion, barrio })
  if (!consulta) {
    return <p className="text-tenue">Dirección a confirmar.</p>
  }

  return (
    <div className="grid gap-3">
      {CLAVE_MAPS ? (
        <iframe
          title={`Mapa de ${nombre}`}
          src={urlMapaEmbebido(consulta, CLAVE_MAPS)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="aspect-[16/10] w-full rounded-2xl border border-borde bg-superficie"
        />
      ) : (
        <a
          href={urlVerEnMaps(consulta)}
          target="_blank"
          rel="noreferrer"
          className="group grid aspect-[16/10] w-full place-content-center justify-items-center gap-2 rounded-2xl border border-borde bg-[repeating-linear-gradient(0deg,transparent_0_23px,var(--color-borde)_23px_24px),repeating-linear-gradient(90deg,transparent_0_23px,var(--color-borde)_23px_24px)] bg-superficie p-6 text-center"
        >
          <MapPin className="size-9 text-complejo-texto transition-transform group-hover:-translate-y-1" aria-hidden="true" />
          <span className="font-semibold">{direccion}</span>
          {barrio && <span className="text-sm text-tenue">{barrio}</span>}
          <span className="mt-1 text-sm font-semibold text-complejo-texto underline underline-offset-3">Ver en Google Maps</span>
        </a>
      )}
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
