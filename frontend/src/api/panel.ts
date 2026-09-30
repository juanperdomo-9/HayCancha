import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { ErrorApi, enviar, pedir, subirArchivo } from './client'

/** Sesión, panel de cada complejo y /admin. Espeja app/schemas/panel.py. */

export type Rol = 'superadmin' | 'dueno' | 'empleado'

export type UsuarioSesion = {
  email: string
  rol: Rol
  negocio: { slug: string; nombre: string; color_primario: string; logo_url: string | null } | null
}

export type PanelResumen = {
  slug: string
  nombre: string
  color_primario: string
  color_secundario: string | null
  logo_url: string | null
  rol: Rol
}

export type Configuracion = {
  slug: string
  nombre: string
  direccion: string | null
  barrio: string | null
  referencia: string | null
  whatsapp: string | null
  latitud: number | null
  longitud: number | null
  servicios: string[]
  logo_url: string | null
  portada_url: string | null
  color_primario: string
  color_secundario: string | null
  sena_tipo: 'fija' | 'porcentaje'
  sena_valor: string
  horas_cancelacion: number
  minutos_para_pagar: number
}

export type CanchaPanel = {
  id: string
  nombre: string
  deporte: string
  deporte_nombre: string
  caracteristicas: string | null
  activo: boolean
  orden: number
}

export type DeportePanel = { codigo: string; nombre: string; duracion_sugerida_min: number }

export type Franja = {
  dias: number[]
  desde: string
  hasta: string
  duracion_turno_min: number
  precio: string
}

export type Integrante = { id: string; email: string; rol: Rol; activo: boolean; clave_definida: boolean }

export type ComplejoAdmin = {
  id: string
  slug: string
  nombre: string
  barrio: string | null
  estado_cuenta: 'al_dia' | 'atrasado' | 'suspendido'
  activo: boolean
  plan: string | null
  canchas: number
  dueno_email: string | null
  dueno_clave_definida: boolean
  creado_a: string
}

export type AltaDeComplejo = {
  nombre: string
  slug: string
  direccion?: string
  barrio?: string
  referencia?: string
  servicios: string[]
  dueno_email: string
  sena_tipo: 'fija' | 'porcentaje'
  sena_valor: string
  horas_cancelacion: number
  minutos_para_pagar: number
  color_primario: string
}

// --- Sesión ---

export function useYo() {
  return useQuery({
    queryKey: ['yo'],
    queryFn: async () => {
      try {
        return await pedir<UsuarioSesion>('/auth/yo')
      } catch (error) {
        if (error instanceof ErrorApi && error.estado === 401) return null
        throw error
      }
    },
    staleTime: 60_000,
    retry: false,
  })
}

export function useIngresar() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: { email: string; clave: string }) => enviar<UsuarioSesion>('/auth/ingresar', 'POST', datos),
    onSuccess: (usuario) => cliente.setQueryData(['yo'], usuario),
  })
}

export function useSalir() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: () => enviar<void>('/auth/salir', 'POST'),
    onSuccess: () => {
      cliente.clear()
      cliente.setQueryData(['yo'], null)
    },
  })
}

export function useInvitacion(token: string) {
  return useQuery({
    queryKey: ['invitacion', token],
    queryFn: () => pedir<{ email: string; negocio: string | null }>(`/auth/invitacion?token=${encodeURIComponent(token)}`),
    enabled: Boolean(token),
    retry: false,
  })
}

export function useDefinirClave() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: { token: string; clave: string }) => enviar<UsuarioSesion>('/auth/definir-clave', 'POST', datos),
    onSuccess: (usuario) => cliente.setQueryData(['yo'], usuario),
  })
}

/** A dónde va cada uno después de ingresar. */
export function inicioDe(usuario: UsuarioSesion): string {
  if (usuario.rol === 'superadmin') return '/admin'
  return usuario.negocio ? `/panel/${usuario.negocio.slug}` : '/'
}

// --- Panel ---

const base = (slug: string) => `/panel/${encodeURIComponent(slug)}`

export function usePanel(slug: string) {
  return useQuery({ queryKey: ['panel', slug], queryFn: () => pedir<PanelResumen>(base(slug)), retry: false })
}

export function useConfiguracion(slug: string) {
  return useQuery({ queryKey: ['panel', slug, 'configuracion'], queryFn: () => pedir<Configuracion>(`${base(slug)}/configuracion`) })
}

export function useGuardarConfiguracion(slug: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (cambios: Partial<Configuracion>) => enviar<Configuracion>(`${base(slug)}/configuracion`, 'PATCH', cambios),
    onSuccess: (configuracion) => {
      cliente.setQueryData(['panel', slug, 'configuracion'], configuracion)
      cliente.invalidateQueries({ queryKey: ['panel', slug], exact: true })
    },
  })
}

export function useSubirImagen(slug: string, tipo: 'logo' | 'portada') {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (archivo: File) => subirArchivo<Configuracion>(`${base(slug)}/marca/${tipo}`, archivo),
    onSuccess: (configuracion) => {
      cliente.setQueryData(['panel', slug, 'configuracion'], configuracion)
      cliente.invalidateQueries({ queryKey: ['panel', slug], exact: true })
    },
  })
}

export function useDeportes(slug: string) {
  return useQuery({
    queryKey: ['panel', slug, 'deportes'],
    queryFn: () => pedir<DeportePanel[]>(`${base(slug)}/deportes`),
    staleTime: Infinity,
  })
}

export function useCanchas(slug: string) {
  return useQuery({ queryKey: ['panel', slug, 'canchas'], queryFn: () => pedir<CanchaPanel[]>(`${base(slug)}/canchas`) })
}

export function useCrearCancha(slug: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: { nombre: string; deporte: string; caracteristicas?: string }) =>
      enviar<CanchaPanel>(`${base(slug)}/canchas`, 'POST', datos),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['panel', slug, 'canchas'] }),
  })
}

export function useCambiarCancha(slug: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...cambios }: { id: string } & Partial<Pick<CanchaPanel, 'nombre' | 'caracteristicas' | 'activo'>>) =>
      enviar<CanchaPanel>(`${base(slug)}/canchas/${id}`, 'PATCH', cambios),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['panel', slug, 'canchas'] }),
  })
}

export function useHorarios(slug: string, canchaId: string | undefined) {
  return useQuery({
    queryKey: ['panel', slug, 'horarios', canchaId],
    queryFn: () => pedir<Franja[]>(`${base(slug)}/canchas/${canchaId}/horarios`),
    enabled: Boolean(canchaId),
  })
}

export function useGuardarHorarios(slug: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: { canchas: string[]; franjas: Franja[] }) =>
      enviar<{ canchas: number; franjas: number }>(`${base(slug)}/horarios`, 'PUT', datos),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['panel', slug, 'horarios'] }),
  })
}

export function useEquipo(slug: string) {
  return useQuery({ queryKey: ['panel', slug, 'equipo'], queryFn: () => pedir<Integrante[]>(`${base(slug)}/equipo`) })
}

export function useInvitarEmpleado(slug: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => enviar<{ integrante: Integrante; link: string }>(`${base(slug)}/equipo`, 'POST', { email }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['panel', slug, 'equipo'] }),
  })
}

export function useNuevoLink(slug: string) {
  return useMutation({
    mutationFn: (usuarioId: string) => enviar<{ link: string }>(`${base(slug)}/equipo/${usuarioId}/invitacion`, 'POST'),
  })
}

export function useCambiarIntegrante(slug: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      enviar<Integrante>(`${base(slug)}/equipo/${id}`, 'PATCH', { activo }),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['panel', slug, 'equipo'] }),
  })
}

// --- Superadmin ---

export function useComplejosAdmin() {
  return useQuery({ queryKey: ['admin', 'complejos'], queryFn: () => pedir<ComplejoAdmin[]>('/admin/complejos') })
}

export function useAltaDeComplejo() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: AltaDeComplejo) => enviar<{ complejo: ComplejoAdmin; link_dueno: string }>('/admin/complejos', 'POST', datos),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['admin', 'complejos'] }),
  })
}

export function useCambiarComplejo() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...cambios }: { id: string; estado_cuenta?: ComplejoAdmin['estado_cuenta']; activo?: boolean }) =>
      enviar<ComplejoAdmin>(`/admin/complejos/${id}`, 'PATCH', cambios),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['admin', 'complejos'] }),
  })
}

export function useLinkDelDueno() {
  return useMutation({
    mutationFn: (negocioId: string) => enviar<{ link: string }>(`/admin/complejos/${negocioId}/invitacion`, 'POST'),
  })
}
