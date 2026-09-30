import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { enviar, pedir } from './client'

/** La pestaña Cobros. El backend nunca manda los tokens de Mercado Pago. */
export type EstadoCobros = {
  disponible: boolean
  vinculado: boolean
  cuenta_mp: string | null
  vence_a: string | null
}

const base = (slug: string) => `/panel/${encodeURIComponent(slug)}/cobros`

export function useCobros(slug: string) {
  return useQuery({
    queryKey: ['panel', slug, 'cobros'],
    queryFn: () => pedir<EstadoCobros>(base(slug)),
  })
}

/** Pide el link de autorización y se va a Mercado Pago (vuelve a /panel/:slug/cobros). */
export function useVincularMercadoPago(slug: string) {
  return useMutation({
    mutationFn: () => enviar<{ url: string }>(`${base(slug)}/vincular`, 'POST'),
    onSuccess: ({ url }) => window.location.assign(url),
  })
}

export function useDesvincularMercadoPago(slug: string) {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: () => enviar<EstadoCobros>(`${base(slug)}/desvincular`, 'POST'),
    onSuccess: (estado) => cliente.setQueryData(['panel', slug, 'cobros'], estado),
  })
}
