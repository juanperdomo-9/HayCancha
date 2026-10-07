import { MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { LogoHayCancha } from './marca/LogoHayCancha'
import { BotonTurnia } from './TurniaCelular'

const ANIO = new Date().getFullYear()

function Credito() {
  return (
    <span>
      Desarrollo web por{' '}
      <a href="https://jpweb.com.ar" target="_blank" rel="noopener" className="font-semibold underline decoration-1 underline-offset-3 hover:no-underline">
        jpweb.com.ar
      </a>
    </span>
  )
}

/** Pie de la página principal de HayCanchas. */
export function PieHayCancha({ extra }: { extra?: ReactNode }) {
  return (
    <footer className="bloque-oscuro border-t border-cal/10 bg-bloque text-cal">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-12 pb-8 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-3">
          <LogoHayCancha sobreOscuro className="text-[26px]" />
          <p className="max-w-[36ch] text-cal/70">Reservá cancha en segundos: horarios libres de verdad y la seña con Mercado Pago.</p>
        </div>
        <nav aria-label="HayCanchas" className="grid content-start gap-2 text-sm">
          <b className="mb-1 text-xs tracking-[.12em] text-cal/50 uppercase">Jugadores</b>
          <a href="/#complejos" className="text-cal/80 hover:text-cal">
            Buscar cancha
          </a>
          <a href="/#mapa" className="text-cal/80 hover:text-cal">
            Mapa de canchas
          </a>
          <a href="/#mapa" className="text-cal/80 hover:text-cal">
            Buscar complejos
          </a>
        </nav>
        <nav aria-label="Complejos" className="grid content-start gap-2 text-sm">
          <b className="mb-1 text-xs tracking-[.12em] text-cal/50 uppercase">Complejos</b>
          <a href="/#sumate" className="text-cal/80 hover:text-cal">
            Sumá tu complejo
          </a>
          <Link to="/ingresar" className="text-cal/80 hover:text-cal">
            Acceso a tu panel
          </Link>
          <BotonTurnia className="justify-self-start text-left text-cal/80 hover:text-cal">Conocé Turnia</BotonTurnia>
        </nav>
      </div>
      <div className="border-t border-cal/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-[13px] text-cal/60 sm:px-8">
          <span>
            © {ANIO} HayCanchas, un producto de{' '}
            <BotonTurnia className="font-semibold text-cal/85 underline decoration-cal/30 underline-offset-3 hover:text-cal hover:decoration-cal">Turnia</BotonTurnia>
          </span>
          {extra}
          <Credito />
        </div>
      </div>
    </footer>
  )
}

type PieComplejoProps = {
  nombre: string
  direccion: string | null
  barrio: string | null
  referencia: string | null
}

/** Pie de la página de cada complejo: sus datos, la marca HayCanchas y el crédito. */
export function PieComplejo({ nombre, direccion, barrio, referencia }: PieComplejoProps) {
  return (
    <footer className="bg-oscuro text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 px-4 pt-10 pb-7 sm:px-8">
        <div className="grid gap-1.5">
          <b className="numeros text-2xl leading-none" style={{ fontStretch: '72%' }}>
            {nombre}
          </b>
          {direccion && (
            <span className="flex items-start gap-1.5 text-sm text-white/70">
              <MapPin className="mt-0.5 size-4 flex-none" aria-hidden="true" />
              <span>
                {direccion}
                {barrio && `, ${barrio}`}
                {referencia && <span className="block">{referencia}</span>}
              </span>
            </span>
          )}
        </div>
        <div className="grid justify-items-start gap-1.5 text-sm text-white/60 sm:justify-items-end">
          <Link to="/" className="grid justify-items-start gap-1.5 hover:text-white sm:justify-items-end">
            Reservas online con
            <LogoHayCancha sobreOscuro className="text-[20px]" />
          </Link>
          <span>
            un sistema de{' '}
            <BotonTurnia className="font-semibold text-white/85 underline decoration-white/30 underline-offset-3 hover:text-white hover:decoration-white">Turnia</BotonTurnia>
          </span>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-[13px] text-white/55 sm:px-8">
          <span>© {ANIO} {nombre}</span>
          <Credito />
        </div>
      </div>
    </footer>
  )
}
