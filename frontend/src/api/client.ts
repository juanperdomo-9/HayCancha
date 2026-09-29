export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export class ErrorApi extends Error {
  readonly estado: number

  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
  }
}

/** GET/POST al backend. Siempre manda la cookie de sesión. */
export async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  const respuesta = await fetch(`${API_URL}${ruta}`, {
    credentials: 'include',
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
  })
  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, `El servidor respondió ${respuesta.status} en ${ruta}`)
  }
  return (await respuesta.json()) as T
}
