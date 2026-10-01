import { useMutation } from '@tanstack/react-query'

import { enviar } from './client'

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
