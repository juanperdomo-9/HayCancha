import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { pedir } from './client'

/** Lo que devuelven las rutas /publico del backend. La plata viene como texto ("85000.00"). */

export type Deporte = { codigo: string; nombre: string }

export type ComplejoResumen = {
  slug: string
  nombre: string
  barrio: string | null
  logo_url: string | null
  portada_url: string | null
  color_primario: string
  color_secundario: string | null
  deportes: Deporte[]
  hoy: string
  proximo_turno: { fecha: string; hora: string } | null
}

export type Cancha = { id: string; nombre: string; caracteristicas: string | null }

export type DeporteDelComplejo = Deporte & {
  duraciones_min: number[]
  precio_desde: string | null
  canchas: Cancha[]
}

export type ComplejoDetalle = {
  slug: string
  nombre: string
  barrio: string | null
  direccion: string | null
  referencia: string | null
  servicios: string[]
  logo_url: string | null
  portada_url: string | null
  color_primario: string
  color_secundario: string | null
  hoy: string
  dias_reservables: number
  sena_tipo: 'fija' | 'porcentaje'
  sena_valor: string
  horas_cancelacion: number
  minutos_para_pagar: number
  deportes: DeporteDelComplejo[]
}

export type CanchaLibre = Cancha & { precio: string; sena: string }

export type Turno = {
  inicio: string
  fin: string
  hora: string
  hora_fin: string
  duracion_min: number
  precio: string | null
  canchas_total: number
  libres: CanchaLibre[]
}

export type Disponibilidad = { fecha: string; deporte: string; turnos: Turno[] }

export function useComplejos() {
  return useQuery({
    queryKey: ['complejos'],
    queryFn: () => pedir<ComplejoResumen[]>('/publico/complejos'),
  })
}

export function useComplejo(slug: string) {
  return useQuery({
    queryKey: ['complejo', slug],
    queryFn: () => pedir<ComplejoDetalle>(`/publico/complejos/${encodeURIComponent(slug)}`),
    retry: false,
  })
}

export function useDisponibilidad(slug: string, deporte: string | undefined, fecha: string) {
  return useQuery({
    queryKey: ['disponibilidad', slug, deporte, fecha],
    queryFn: () =>
      pedir<Disponibilidad>(
        `/publico/complejos/${encodeURIComponent(slug)}/disponibilidad?` +
          new URLSearchParams({ deporte: deporte ?? '', fecha }),
      ),
    enabled: Boolean(deporte),
    // Los horarios cambian mientras el jugador mira: se refrescan solos.
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })
}
