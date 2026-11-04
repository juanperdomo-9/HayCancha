import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { enviar, pedir } from './client'

/** La agenda del panel. Espeja app/schemas/agenda.py. La plata viene como texto. */

export type EstadoReserva = 'pendiente_pago' | 'confirmada' | 'vencida' | 'cancelada' | 'bloqueada'
export type Origen = 'web' | 'panel' | 'bot'

export type ReservaEnAgenda = {
  id: string
  estado: EstadoReserva
  cliente: string | null
  precio: string | null
  sena: string
  sena_en_efectivo: boolean
  saldo: string
  saldo_cobrado: boolean
  saldo_efectivo: string | null
  saldo_en_efectivo: boolean
  /** Cómo se cobró el saldo en la cancha (null: se marcó antes de guardarlo). */
  cobrado_efectivo?: string | null
  cobrado_transferencia?: string | null
  origen: Origen
  asistencia: 'vino' | 'no_vino' | null
  motivo_bloqueo: string | null
  /** Bloqueo automático por canchas unidas: se libera cancelando o moviendo la reserva original. */
  espejo?: boolean
  /** Lo que se alquila aparte (ya sumado en el saldo). */
  adicionales?: { adicional_id: string; nombre: string; cantidad: number; precio: string }[]
  total_adicionales?: string
  // Bloqueo fijo (todas las semanas): el id es el del bloqueo, no de una reserva.
  fijo?: boolean
  minutos_para_pagar: number | null
  /** El nombre del cumpleaños, si la reserva es uno. */
  cumpleanos?: string | null
  /** Si es de un turno fijo de juego (se repite todas las semanas). */
  turno_fijo?: boolean
}

export type TurnoEnAgenda = {
  inicio: string
  fin: string
  hora: string
  hora_fin: string
  precio: string
  sena: string
  pasado: boolean
  reserva: ReservaEnAgenda | null
}

export type CanchaEnAgenda = {
  id: string
  nombre: string
  deporte: string
  deporte_nombre: string
  caracteristicas: string | null
  turnos: TurnoEnAgenda[]
}

export type Agenda = {
  fecha: string
  hoy: string
  canchas: CanchaEnAgenda[]
  resumen: {
    ocupados: number
    libres: number
    bloqueados: number
    senas_cobradas: string
    saldo_por_cobrar: string
    cobrado_efectivo?: string
    cobrado_transferencia?: string
  }
}

export type DiaDeLaSemana = { fecha: string; ocupados: number; libres: number; bloqueados: number }

export type ReservaDetalle = Omit<ReservaEnAgenda, 'cliente' | 'turno_fijo'> & {
  cancha_id: string
  cancha: string
  deporte: string
  deporte_nombre: string
  fecha: string
  inicio: string
  fin: string
  hora: string
  hora_fin: string
  cliente: { nombre: string; telefono: string; email: string | null } | null
  /** Lo que contó el jugador al reservar el cumpleaños. */
  nota?: string | null
  /** Turno fijo de juego: su id y "Todos los martes a las 21:00". */
  turno_fijo_id?: string | null
  turno_fijo?: string | null
  creado_a: string
  sena_online: boolean
  devolucion: 'pendiente' | 'hecha' | null
}

/** Identifica un turno de una cancha (para elegir varios y bloquearlos juntos). */
export const claveTurno = (canchaId: string, inicio: string) => `${canchaId}|${inicio}`

const base = (slug: string) => `/panel/${encodeURIComponent(slug)}`

export function useAgenda(slug: string, fecha: string | null) {
  return useQuery({
    queryKey: ['agenda', slug, fecha],
    queryFn: () => pedir<Agenda>(`${base(slug)}/agenda${fecha ? `?fecha=${fecha}` : ''}`),
    // Las reservas nuevas aparecen solas, sin recargar la página.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })
}

export function useSemana(slug: string, desde: string | null, activa: boolean) {
  return useQuery({
    queryKey: ['semana', slug, desde],
    queryFn: () => pedir<DiaDeLaSemana[]>(`${base(slug)}/semana${desde ? `?desde=${desde}` : ''}`),
    enabled: activa,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  })
}

export function useReserva(slug: string, id: string | null) {
  return useQuery({
    queryKey: ['reserva', slug, id],
    queryFn: () => pedir<ReservaDetalle>(`${base(slug)}/reservas/${id}`),
    enabled: Boolean(id),
  })
}

/** Después de cualquier cambio, se refresca la agenda, la semana y el detalle. */
function useRefrescar(slug: string) {
  const cliente = useQueryClient()
  return () => {
    cliente.invalidateQueries({ queryKey: ['agenda', slug] })
    cliente.invalidateQueries({ queryKey: ['semana', slug] })
    cliente.invalidateQueries({ queryKey: ['reserva', slug] })
  }
}

export type ReservaManual = {
  recurso_id: string
  inicio: string
  nombre: string
  telefono: string
  email?: string
  sena_en_efectivo: boolean
  /** Si dejó otro monto que la seña calculada. */
  sena_monto?: string
}

export function useCargarReserva(slug: string) {
  const refrescar = useRefrescar(slug)
  return useMutation({
    mutationFn: (datos: ReservaManual) => enviar<ReservaDetalle>(`${base(slug)}/reservas`, 'POST', datos),
    onSuccess: refrescar,
  })
}

export function useCambiarReserva(slug: string) {
  const refrescar = useRefrescar(slug)
  return useMutation({
    mutationFn: ({ id, ...cambios }: { id: string; asistencia?: 'vino' | 'no_vino' | null; saldo_cobrado?: boolean; saldo_en_efectivo?: boolean; sena_efectivo?: string; cobro?: { efectivo: string; transferencia: string } }) =>
      enviar<ReservaDetalle>(`${base(slug)}/reservas/${id}`, 'PATCH', cambios),
    onSuccess: refrescar,
  })
}

export function useCambiarAdicionales(slug: string) {
  const refrescar = useRefrescar(slug)
  return useMutation({
    mutationFn: ({ id, pedidos }: { id: string; pedidos: { id: string; cantidad: number }[] }) =>
      enviar<ReservaDetalle>(`${base(slug)}/reservas/${id}/adicionales`, 'PUT', pedidos),
    onSuccess: refrescar,
  })
}

export function useCancelarReserva(slug: string) {
  const refrescar = useRefrescar(slug)
  return useMutation({
    mutationFn: ({ id, devolverSena = true }: { id: string; devolverSena?: boolean }) =>
      enviar<ReservaDetalle>(`${base(slug)}/reservas/${id}/cancelar`, 'POST', { devolver_sena: devolverSena }),
    onSuccess: refrescar,
  })
}

export function useMoverReserva(slug: string) {
  const refrescar = useRefrescar(slug)
  return useMutation({
    mutationFn: ({ id, recurso_id, inicio }: { id: string; recurso_id: string; inicio: string }) =>
      enviar<ReservaDetalle>(`${base(slug)}/reservas/${id}/mover`, 'POST', { recurso_id, inicio }),
    onSuccess: refrescar,
  })
}

export function useBloquear(slug: string) {
  const refrescar = useRefrescar(slug)
  return useMutation({
    mutationFn: (datos: { turnos: { recurso_id: string; inicio: string }[]; motivo: string }) =>
      enviar<{ bloqueados: number; omitidos: number }>(`${base(slug)}/bloqueos`, 'POST', datos),
    onSuccess: refrescar,
  })
}

// --- Bloqueos fijos (todas las semanas) ---

export type BloqueoFijo = {
  id: string
  dia_semana: number
  desde: string
  hasta: string
  recurso_id: string | null
  cancha: string | null
  motivo: string
}

export type TurnoFijo = { id: string; dia_semana: number; desde: string; recurso_id: string; cancha: string; cliente: string; telefono: string }

export type NuevoTurnoFijo = {
  recurso_id: string
  dia_semana: number
  desde: string
  nombre: string
  telefono: string
  /** Seña en efectivo que dejó para el primer partido. */
  sena_monto?: string
}

export function useTurnosFijos(slug: string) {
  return useQuery({ queryKey: ['panel', slug, 'turnos-fijos'], queryFn: () => pedir<TurnoFijo[]>(`${base(slug)}/turnos-fijos`) })
}

export function useCrearTurnoFijo(slug: string) {
  const refrescar = useRefrescar(slug)
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: NuevoTurnoFijo) =>
      enviar<{ turno_fijo: TurnoFijo; creadas: number; omitidas: string[] }>(`${base(slug)}/turnos-fijos`, 'POST', datos),
    onSuccess: () => {
      refrescar()
      cliente.invalidateQueries({ queryKey: ['panel', slug, 'turnos-fijos'] })
    },
  })
}

/** Liberar para siempre: cancela las reservas que vienen y no crea más. */
export function useLiberarTurnoFijo(slug: string) {
  const refrescar = useRefrescar(slug)
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => pedir<void>(`${base(slug)}/turnos-fijos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refrescar()
      cliente.invalidateQueries({ queryKey: ['panel', slug, 'turnos-fijos'] })
    },
  })
}

export type NuevoBloqueoFijo = { dia_semana: number; desde: string; hasta: string; recurso_id: string | null; motivo: string }

export function useBloqueosFijos(slug: string) {
  return useQuery({ queryKey: ['panel', slug, 'bloqueos-fijos'], queryFn: () => pedir<BloqueoFijo[]>(`${base(slug)}/bloqueos-fijos`) })
}

export function useCrearBloqueoFijo(slug: string) {
  const refrescar = useRefrescar(slug)
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: NuevoBloqueoFijo) =>
      enviar<{ bloqueo: BloqueoFijo; reservas_existentes: number }>(`${base(slug)}/bloqueos-fijos`, 'POST', datos),
    onSuccess: () => {
      refrescar()
      cliente.invalidateQueries({ queryKey: ['panel', slug, 'bloqueos-fijos'] })
    },
  })
}

export function useBorrarBloqueoFijo(slug: string) {
  const refrescar = useRefrescar(slug)
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => pedir<void>(`${base(slug)}/bloqueos-fijos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refrescar()
      cliente.invalidateQueries({ queryKey: ['panel', slug, 'bloqueos-fijos'] })
    },
  })
}
