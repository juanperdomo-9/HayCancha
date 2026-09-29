import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { mensaje } from '../api/client'
import { type UsuarioSesion, useYo } from '../api/panel'

/** Muestra el contenido solo con sesión; si no, manda a /ingresar y después vuelve acá. */
export function RequiereSesion({ children }: { children: (usuario: UsuarioSesion) => ReactNode }) {
  const { data: yo, isPending, error } = useYo()
  const ubicacion = useLocation()

  if (isPending) return <PantallaCargando />
  if (error) return <PantallaMensaje titulo="No pudimos cargar tu sesión">{mensaje(error)}</PantallaMensaje>
  if (!yo) return <Navigate to={`/ingresar?volver=${encodeURIComponent(ubicacion.pathname)}`} replace />
  return children(yo)
}

export function PantallaCargando() {
  return (
    <div className="grid min-h-dvh place-items-center bg-crema" aria-busy="true">
      <span className="size-8 animate-spin rounded-full border-3 border-linea border-t-cesped" />
    </div>
  )
}

export function PantallaMensaje({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-crema p-6 text-center text-noche">
      <div className="max-w-md">
        <h1 className="font-titulo text-5xl leading-[.9] font-extrabold uppercase">{titulo}</h1>
        <div className="mt-4 text-gris">{children}</div>
      </div>
    </div>
  )
}
