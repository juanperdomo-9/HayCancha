import { Link } from 'react-router'

import { LogoHayCancha } from '../../components/marca/LogoHayCancha'

export default function NoEncontrado() {
  return (
    <div className="min-h-dvh bg-crema text-noche">
      <header className="mx-auto max-w-6xl px-4 py-5 sm:px-8">
        <Link to="/" aria-label="HayCanchas, inicio">
          <LogoHayCancha className="text-[27px]" />
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-16 pb-20 sm:px-8">
        <h1 className="font-titulo text-[clamp(56px,11vw,120px)] leading-[.88] font-extrabold uppercase">
          Esta cancha
          <br />
          no existe
        </h1>
        <p className="mt-5 text-lg text-gris">Revisá la dirección o volvé al inicio para buscar un complejo.</p>
        <Link to="/" className="mt-8 inline-block rounded-full bg-cesped px-5 py-3 font-semibold text-white">
          Ir al inicio
        </Link>
      </main>
    </div>
  )
}
