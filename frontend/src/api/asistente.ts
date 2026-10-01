import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { enviar, pedir } from './client'

export type MensajeDelChat = { rol: 'usuario' | 'asistente'; texto: string }

export type ResultadoBusqueda = {
  complejo: string
  slug: string
  barrio: string | null
  deporte: string
  deporte_codigo: string
  cancha: string
  caracteristicas: string | null
  fecha: string
  hora: string
  hora_fin: string
  precio: string
  sena: string
}

/** El buscador con IA: se manda la charla entera (solo textos) y vuelven la respuesta y
 * los turnos encontrados. */
export function useBuscarConIA() {
  return useMutation({
    mutationFn: (mensajes: MensajeDelChat[]) => enviar<{ respuesta: string; resultados: ResultadoBusqueda[] }>('/asistente/buscar', 'POST', { mensajes }),
  })
}

export type RespuestaDelComplejo = {
  respuesta: string
  turnos: ResultadoBusqueda[]
  reserva: { link: string; url_pago: string | null } | null
}

/** El asistente de un complejo. */
export function useCharlarConComplejo(slug: string) {
  return useMutation({
    mutationFn: (mensajes: MensajeDelChat[]) => enviar<RespuestaDelComplejo>(`/asistente/complejos/${encodeURIComponent(slug)}`, 'POST', { mensajes }),
  })
}

export type ConsultaPendiente = { id: string; pregunta: string; creado_a: string }

export function useConsultas(slug: string) {
  return useQuery({
    queryKey: ['panel', slug, 'consultas'],
    queryFn: () => pedir<ConsultaPendiente[]>(`/panel/${encodeURIComponent(slug)}/asistente/consultas`),
  })
}

export function useResolverConsulta(slug: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => enviar<void>(`/panel/${encodeURIComponent(slug)}/asistente/consultas/${id}/resolver`, 'POST'),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['panel', slug, 'consultas'] }),
  })
}
