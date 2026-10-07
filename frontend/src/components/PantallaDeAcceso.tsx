import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { LogoHayCancha } from './marca/LogoHayCancha'

/** Pantalla partida para ingresar y elegir contraseña: formulario a la izquierda, cancha a la derecha. */
export function PantallaDeAcceso({ titulo, bajada, children }: { titulo: string; bajada: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-crema text-noche lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link to="/" aria-label="HayCanchas, inicio" className="self-start">
          <LogoHayCancha className="text-[26px]" />
        </Link>
        <main className="my-auto w-full max-w-sm self-center py-10">
          <h1 className="font-titulo text-[clamp(44px,8vw,64px)] leading-[.9] font-extrabold uppercase">{titulo}</h1>
          <p className="mt-3 mb-7 text-gris">{bajada}</p>
          {children}
        </main>
      </div>
      <div className="relative hidden overflow-hidden bg-noche lg:block" aria-hidden="true">
        <svg viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={i * 75} y="0" width="75" height="800" className={i % 2 ? 'fill-noche' : 'fill-[#18301f]'} />
          ))}
          <g className="fill-none stroke-cal/60" strokeWidth="4">
            <rect x="60" y="60" width="480" height="680" />
            <line x1="60" y1="400" x2="540" y2="400" />
            <circle cx="300" cy="400" r="70" />
            <rect x="190" y="60" width="220" height="110" />
            <rect x="190" y="630" width="220" height="110" />
          </g>
        </svg>
        <p className="absolute right-10 bottom-10 left-10 font-titulo text-6xl leading-[.9] font-extrabold text-cal uppercase">
          La agenda
          <br />
          <span className="text-cesped-claro">se llena sola</span>
        </p>
      </div>
    </div>
  )
}
