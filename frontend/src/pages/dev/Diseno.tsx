import { motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'

import { DibujoCancha } from '../../components/cancha/DibujoCancha'
import { LogoHayCancha } from '../../components/marca/LogoHayCancha'
import { FONDO_BASE, contraste, temaComplejo } from '../../theme/paleta'
import { TemaComplejo } from '../../theme/TemaComplejo'

/** Guía del sistema de diseño. Solo existe en desarrollo (ver App.tsx). */

const MARCA = [
  ['Crema', 'bg-crema', '#F1E9D8'],
  ['Crema oscuro', 'bg-crema-oscuro', '#E6DAC2'],
  ['Césped', 'bg-cesped', '#1E7A3E'],
  ['Verde claro', 'bg-cesped-claro', '#57C986'],
  ['Noche', 'bg-noche', '#14231A'],
  ['Cal', 'bg-cal', '#F6F1E6'],
] as const

const COLORES_PRUEBA = ['#1F8A4C', '#2447D8', '#F2C200', '#C4552B', '#7B3FE4', '#D42A3C', '#F7B5CA', '#EDEDED']
const DEPORTES = [
  ['futbol7', 'Fútbol'],
  ['padel', 'Pádel'],
  ['tenis', 'Tenis'],
  ['basquet', 'Básquet'],
  ['voley', 'Vóley'],
] as const
const TURNOS = [
  { hora: '19:00', libres: 3 },
  { hora: '20:00', libres: 1 },
  { hora: '21:00', libres: 2 },
  { hora: '22:00', libres: 0 },
]

export default function Diseno() {
  const [color, setColor] = useState('#1F8A4C')
  const [turno, setTurno] = useState('21:00')
  const tema = temaComplejo(color)

  return (
    <div className="min-h-dvh bg-crema text-noche">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <Link to="/" aria-label="HayCancha, inicio">
          <LogoHayCancha className="text-[27px]" />
        </Link>
        <span className="text-sm text-gris">Sistema de diseño · solo en desarrollo</span>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-16 px-4 pt-6 pb-24 sm:px-8">
        <section className="grid gap-6">
          <h1 className="font-titulo text-[clamp(48px,8vw,96px)] leading-[.9] font-extrabold uppercase">Cal y césped</h1>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid place-items-center rounded-2xl border border-linea p-10">
              <LogoHayCancha className="text-[clamp(30px,9vw,48px)]" />
            </div>
            <div className="grid place-items-center rounded-2xl bg-noche p-10">
              <LogoHayCancha sobreOscuro className="text-[clamp(30px,9vw,48px)]" />
            </div>
          </div>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {MARCA.map(([nombre, clase, hex]) => (
              <li key={nombre} className="grid gap-1 text-sm">
                <span className={`aspect-[1.3] rounded-xl ring-1 ring-black/10 ${clase}`} />
                <b>{nombre}</b>
                <code className="text-xs text-gris">{hex}</code>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 rounded-2xl bg-noche p-6 text-cal sm:p-8">
            <span className="font-titulo text-6xl leading-none font-extrabold uppercase">¿Hay cancha?</span>
            <span className="numeros text-4xl font-bold">21:00 · 22:30 · $ 78.000</span>
            <span className="max-w-[60ch] text-cal/80">
              Títulos en Big Shoulders Display, números en Archivo condensada y el texto en Instrument Sans.
            </span>
          </div>
        </section>

        <section className="grid gap-6">
          <div>
            <h2 className="font-titulo text-5xl leading-none font-extrabold uppercase">Tema por complejo</h2>
            <p className="mt-3 max-w-[60ch] text-gris">
              Elegí cualquier color: la página deriva el texto encima, una versión legible para textos y los tonos suaves.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {COLORES_PRUEBA.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={c === color}
                aria-label={`Probar ${c}`}
                className="size-9 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-crema aria-pressed:ring-noche"
                style={{ background: c }}
              />
            ))}
            <label className="ml-2 inline-flex items-center gap-2 rounded-full border border-dashed border-gris px-3 py-1.5 text-sm">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-6 cursor-pointer" />
              Cualquier color
            </label>
          </div>

          <TemaComplejo color={color} className="overflow-hidden rounded-3xl bg-lienzo text-tinta ring-1 ring-borde">
            <div className="relative bg-oscuro text-white">
              <DibujoCancha deporte="futbol7" animado className="absolute inset-0" />
              <div className="absolute inset-0 bg-linear-to-t from-oscuro via-oscuro/50 to-oscuro/10" />
              <div className="relative px-5 pt-28 pb-6 sm:px-8">
                <h3 className="numeros text-[clamp(44px,7vw,80px)] leading-[.88] font-extrabold" style={{ fontStretch: '70%' }}>
                  Complejo de prueba
                </h3>
                <p className="mt-2 text-white/75">Palermo · Todos los días de 9 a 24 h</p>
              </div>
            </div>
            <div className="grid gap-6 p-5 sm:p-8">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {TURNOS.map(({ hora, libres }) => {
                  const elegido = turno === hora
                  return (
                    <motion.button
                      key={hora}
                      type="button"
                      whileTap={{ scale: 0.96 }}
                      disabled={libres === 0}
                      onClick={() => setTurno(hora)}
                      aria-pressed={elegido}
                      className="grid gap-2 rounded-xl border-[1.5px] border-borde bg-superficie p-3 text-left transition-colors hover:border-complejo-linea disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent aria-pressed:border-complejo aria-pressed:bg-complejo aria-pressed:text-complejo-sobre"
                    >
                      <span className="numeros text-[27px] leading-none font-bold">{hora}</span>
                      <span className="flex gap-[3px]">
                        {[0, 1, 2].map((i) => (
                          <i
                            key={i}
                            className={`h-[5px] flex-1 rounded-full ${
                              i < libres ? (elegido ? 'bg-complejo-sobre' : 'bg-complejo') : elegido ? 'bg-complejo-sobre/30' : 'bg-borde'
                            }`}
                          />
                        ))}
                      </span>
                      <span className={`text-xs font-medium ${elegido ? '' : libres === 1 ? 'font-bold text-complejo-texto' : 'text-tenue'}`}>
                        {libres === 0 ? 'completo' : libres === 1 ? 'queda 1' : `quedan ${libres}`}
                      </span>
                    </motion.button>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="rounded-xl bg-complejo px-5 py-3.5 font-bold text-complejo-sobre hover:brightness-105">
                  Pagar seña de $ 23.400
                </button>
                <span className="rounded-full bg-complejo-suave px-3 py-1.5 text-sm font-semibold text-complejo-texto">Techada</span>
                <span className="font-semibold text-complejo-texto">Texto con el color del complejo</span>
              </div>
              <dl className="grid gap-1 text-sm text-tenue">
                <div>
                  Texto sobre el color: <b className="text-tinta">{contraste(tema.sobre, tema.complejo).toFixed(1)}:1</b>
                </div>
                <div>
                  Color como texto sobre el fondo: <b className="text-tinta">{contraste(tema.texto, FONDO_BASE).toFixed(1)}:1</b>
                  {tema.texto !== tema.complejo && ' (oscurecido automáticamente)'}
                </div>
              </dl>
            </div>
          </TemaComplejo>
        </section>

        <section className="grid gap-6">
          <h2 className="font-titulo text-5xl leading-none font-extrabold uppercase">Portadas sin foto</h2>
          <TemaComplejo color={color} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DEPORTES.map(([codigo, nombre]) => (
              <figure key={codigo} className="grid gap-2">
                <DibujoCancha deporte={codigo} className="relative aspect-[16/9] rounded-2xl" />
                <figcaption className="text-sm font-semibold">{nombre}</figcaption>
              </figure>
            ))}
          </TemaComplejo>
        </section>
      </main>
    </div>
  )
}
