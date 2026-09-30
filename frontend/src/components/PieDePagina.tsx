import { MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { LogoHayCancha } from './marca/LogoHayCancha'

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

/** Pie de la página principal de HayCancha. */
export function PieHayCancha({ extra }: { extra?: ReactNode }) {
  return (
    <footer className="border-t border-cal/10 bg-noche text-cal">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 pt-12 pb-8 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-3">
          <LogoHayCancha sobreOscuro className="text-[26px]" />
          <p className="max-w-[36ch] text-cal/70">Reservá cancha en segundos: horarios libres de verdad y la seña con Mercado Pago.</p>
        </div>
        <nav aria-label="HayCancha" className="grid content-start gap-2 text-sm">
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
          <a href="#duenos" className="text-cal/80 hover:text-cal">
            Sumá tu complejo
          </a>
          <Link to="/ingresar" className="text-cal/80 hover:text-cal">
            Acceso a tu panel
          </Link>
        </nav>
      </div>
      <div className="border-t border-cal/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-[13px] text-cal/60 sm:px-8">
          <span>
            © {ANIO} HayCancha · haycancha.com.ar
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

/** Pie de la página de cada complejo: sus datos, la marca HayCancha y el crédito. */
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
        <Link to="/" className="grid justify-items-start gap-1.5 text-sm text-white/60 hover:text-white sm:justify-items-end">
          Reservas online con
          <LogoHayCancha sobreOscuro className="text-[20px]" />
        </Link>
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
