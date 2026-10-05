import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { enviar, pedir } from './client'

/** Lo que devuelven las rutas /publico del backend. La plata viene como texto ("85000.00"). */

export type Deporte = { codigo: string; nombre: string }

export type ComplejoResumen = {
  slug: string
  latitud: number | null
  longitud: number | null
  nombre: string
  barrio: string | null
  logo_url: string | null
  portada_url: string | null
  color_primario: string
  color_secundario: string | null
  deportes: Deporte[]
  hoy: string
  proximo_turno: { fecha: string; hora: string } | null
  caracteristicas: string[]
}

/** Mapa general: complejos con lugar en el día y la hora elegidos. */
export type ComplejoConLugar = {
  slug: string
  fecha: string
  deporte_codigo: string
  hora: string
  canchas: number
  horas: string[]
  precio_desde: string
}

export type FiltroDeLugar = { fecha: string; hora: string | null; deporte: string | null; caracteristicas: string[] }

export function useComplejosConLugar(filtro: FiltroDeLugar | null) {
  return useQuery({
    queryKey: ['libres', filtro],
    enabled: filtro !== null,
    placeholderData: keepPreviousData,
    queryFn: () => {
      const q = new URLSearchParams({ fecha: filtro!.fecha })
      if (filtro!.hora) q.set('hora', filtro!.hora)
      if (filtro!.deporte) q.set('deporte', filtro!.deporte)
      for (const c of filtro!.caracteristicas) q.append('caracteristicas', c)
      return pedir<ComplejoConLugar[]>(`/publico/libres?${q}`)
    },
  })
}

export type Cancha = { id: string; nombre: string; caracteristicas: string | null }

export type DeporteDelComplejo = Deporte & {
  duraciones_min: number[]
  precio_desde: string | null
  canchas: Cancha[]
}

export type ComplejoDetalle = {
  fotos: string[]
  asistente: { nombre: string; bienvenida: string } | null
  slug: string
  nombre: string
  barrio: string | null
  direccion: string | null
  referencia: string | null
  whatsapp: string | null
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
  /** Si ya cobra la seña online (Mercado Pago vinculado, o pago simulado en desarrollo). */
  reservas_online: boolean
  deportes: DeporteDelComplejo[]
}

export type CanchaLibre = Cancha & { precio: string; sena: string; precio_efectivo: string | null }

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
    queryFn: () => pedir<Disponibilidad>(`/publico/complejos/${encodeURIComponent(slug)}/disponibilidad?` + new URLSearchParams({ deporte: deporte ?? '', fecha })),
    enabled: Boolean(deporte),
    // Los horarios cambian mientras el jugador mira: se refrescan solos.
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })
}

// --- Reserva online del jugador ---

export type NuevaReserva = {
  deporte: string
  inicio: string
  recurso_id?: string
  nombre: string
  telefono: string
  email?: string
  llegada?: 'haycancha' | 'directo'
}

export type ReservaPublica = {
  id: string
  /** Ruta de la reserva (/slug/r/codigo): es lo único que la identifica. */
  link: string
  estado: 'pendiente_pago' | 'confirmada' | 'vencida' | 'cancelada'
  complejo: string
  slug: string
  color_primario: string
  color_secundario: string | null
  logo_url: string | null
  jugador: string
  cancha: string
  deporte: string
  fecha: string
  hora: string
  hora_fin: string
  precio: string
  sena: string
  saldo: string
  precio_efectivo: string | null
  saldo_efectivo: string | null
  vence_a: string | null
  url_pago: string | null
  pago_simulado: boolean
  horas_cancelacion: number
  direccion: string | null
  barrio: string | null
  referencia: string | null
  deporte_codigo: string
  cancha_id: string
  sena_pagada: boolean
  cancelable_hasta: string
  puede_cancelar: boolean
  recupera_sena: boolean
  puede_cambiar: boolean
  ya_cambio_horario: boolean
  devolucion: 'pendiente' | 'hecha' | null
  monto_devuelto: string | null
}

const reservas = (slug: string) => `/publico/complejos/${encodeURIComponent(slug)}/reservas`

export function useCrearReserva(slug: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: NuevaReserva) => enviar<{ id: string; url_pago: string | null; link: string }>(reservas(slug), 'POST', datos),
    // Pase lo que pase, los horarios cambiaron: se vuelven a pedir.
    onSettled: () => cliente.invalidateQueries({ queryKey: ['disponibilidad', slug] }),
  })
}

/** La reserva por su código (link nuevo, /slug/r/codigo) o por su id (links viejos). */
export function useReservaPublica(slug: string, clave: { id?: string; codigo?: string }) {
  const ruta = clave.codigo ? `por-codigo/${encodeURIComponent(clave.codigo)}` : encodeURIComponent(clave.id ?? '')
  return useQuery({
    queryKey: ['reserva-publica', slug, clave.codigo ?? clave.id],
    queryFn: () => pedir<ReservaPublica>(`${reservas(slug)}/${ruta}`),
    retry: false,
    // Mientras espera el pago, se consulta seguido hasta que se confirme.
    refetchInterval: (consulta) => (consulta.state.data?.estado === 'pendiente_pago' ? 3_000 : false),
  })
}

/** El jugador cancela confirmando con su teléfono. La seña se devuelve según la política. */
export function useCancelarReserva(slug: string, id: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (telefono: string) => enviar<ReservaPublica>(`${reservas(slug)}/${encodeURIComponent(id)}/cancelar`, 'POST', { telefono }),
    onSuccess: (reserva) => {
      cliente.setQueriesData({ queryKey: ['reserva-publica', slug] }, (vieja?: ReservaPublica) => (vieja?.id === reserva.id ? reserva : vieja))
      cliente.invalidateQueries({ queryKey: ['disponibilidad', slug] })
    },
  })
}

/** El jugador cambia el horario (una vez) confirmando con su teléfono. */
export function useCambiarHorario(slug: string, id: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: { telefono: string; inicio: string }) => enviar<ReservaPublica>(`${reservas(slug)}/${encodeURIComponent(id)}/cambiar`, 'POST', datos),
    onSuccess: (reserva) => {
      cliente.setQueriesData({ queryKey: ['reserva-publica', slug] }, (vieja?: ReservaPublica) => (vieja?.id === reserva.id ? reserva : vieja))
      cliente.invalidateQueries({ queryKey: ['disponibilidad', slug] })
    },
  })
}

export function useSimularPago(slug: string, id: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: () => enviar<ReservaPublica>(`${reservas(slug)}/${encodeURIComponent(id)}/simular-pago`, 'POST'),
    onSuccess: (reserva) => cliente.setQueriesData({ queryKey: ['reserva-publica', slug] }, (vieja?: ReservaPublica) => (vieja?.id === reserva.id ? reserva : vieja)),
  })
}
