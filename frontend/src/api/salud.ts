import { useQuery } from '@tanstack/react-query'

import { ErrorApi, pedir } from './client'

export type Salud = { api: 'ok'; base: 'ok' | 'error' }

async function obtenerSalud(): Promise<Salud> {
  try {
    return await pedir<Salud>('/health')
  } catch (error) {
    // 503: la API anda pero no llega a la base.
    if (error instanceof ErrorApi && error.estado === 503) return { api: 'ok', base: 'error' }
    throw error
  }
}

export function useSalud() {
  return useQuery({ queryKey: ['salud'], queryFn: obtenerSalud, refetchInterval: 15_000, retry: false })
}
