import type { ReactNode } from 'react'

export function EncabezadoSeccion({ titulo, bajada }: { titulo: string; bajada: ReactNode }) {
  return (
    <div>
      <h1 className="font-titulo text-[clamp(40px,6vw,60px)] leading-[.9] font-extrabold uppercase">{titulo}</h1>
      <p className="mt-2 max-w-[62ch] text-gris">{bajada}</p>
    </div>
  )
}
