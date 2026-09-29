export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export class ErrorApi extends Error {
  readonly estado: number

  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.estado = estado
  }
}

/** El mensaje que mandó el backend, listo para mostrarle a la persona. */
async function mensajeDeError(respuesta: Response): Promise<string> {
  try {
    const cuerpo = await respuesta.json()
    if (typeof cuerpo.detail === 'string') return cuerpo.detail
    // Errores de validación de FastAPI: [{loc: [..., "campo"], msg}]
    if (Array.isArray(cuerpo.detail) && cuerpo.detail.length) {
      const campo = cuerpo.detail[0].loc?.at(-1)
      return campo ? `Revisá el dato «${String(campo).replaceAll('_', ' ')}».` : 'Revisá los datos.'
    }
  } catch {
    // sin cuerpo JSON
  }
  if (respuesta.status >= 500) return 'Algo falló de nuestro lado. Probá de nuevo en un rato.'
  return 'No pudimos completar la acción.'
}

/** Pedido al backend. Siempre manda la cookie de sesión. */
export async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      credentials: 'include',
      ...init,
      headers: { Accept: 'application/json', ...init?.headers },
    })
  } catch {
    throw new ErrorApi(0, 'No hay conexión con el servidor. Revisá tu internet.')
  }
  if (!respuesta.ok) throw new ErrorApi(respuesta.status, await mensajeDeError(respuesta))
  if (respuesta.status === 204) return undefined as T
  return (await respuesta.json()) as T
}

export function enviar<T>(ruta: string, metodo: 'POST' | 'PATCH' | 'PUT', datos?: unknown): Promise<T> {
  return pedir<T>(ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: datos === undefined ? undefined : JSON.stringify(datos),
  })
}

export function subirArchivo<T>(ruta: string, archivo: File): Promise<T> {
  const formulario = new FormData()
  formulario.append('archivo', archivo)
  return pedir<T>(ruta, { method: 'POST', body: formulario })
}

export function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : 'No pudimos completar la acción.'
}
