import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { LogoHayCancha } from './marca/LogoHayCancha'

type Props = {
  titulo: string
  fase: number
  children: ReactNode
}

/** Página provisoria para las rutas que se construyen en fases siguientes. */
export function EnConstruccion({ titulo, fase, children }: Props) {
  return (
    <div className="min-h-dvh bg-crema text-noche">
      <header className="mx-auto max-w-6xl px-4 py-5 sm:px-8">
        <Link to="/" aria-label="HayCancha, inicio">
          <LogoHayCancha className="text-[27px]" />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-20 sm:px-8 sm:pt-16">
        <p className="text-xs font-semibold tracking-[.12em] text-gris uppercase">Llega en la fase {fase}</p>
        <h1 className="mt-3 font-titulo text-[clamp(48px,9vw,96px)] leading-[.9] font-extrabold text-balance uppercase">{titulo}</h1>
        <div className="mt-5 max-w-[52ch] text-lg text-gris">{children}</div>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-noche px-5 py-3 font-semibold text-crema transition-transform hover:-translate-y-px"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver al inicio
        </Link>
      </main>
    </div>
  )
}
