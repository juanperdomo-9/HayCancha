import { CalendarCheck, LayoutGrid, Wallet } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'

import { DibujoCancha } from '../../components/cancha/DibujoCancha'
import { DirectorioComplejos } from '../../components/complejo/DirectorioComplejos'
import { LogoHayCancha } from '../../components/marca/LogoHayCancha'
import { PieHayCancha } from '../../components/PieDePagina'
import { TemaComplejo } from '../../theme/TemaComplejo'
import { useComplejos } from '../../api/publico'
import { FormularioComplejo } from '../../components/FormularioComplejo'
import { MapaDeCanchas } from '../../components/MapaLeaflet'
import { BotonModo } from '../../components/BotonModo'
import { BuscadorIA } from '../../components/BuscadorIA'

const ENTRADA = [0.2, 0.8, 0.2, 1] as const

const PARA_DUENOS = [
  {
    icono: LayoutGrid,
    clave: 'haycanchas.com.ar/tu-complejo',
    titulo: 'Tu página, con tu logo y tus colores',
    texto: 'Tus jugadores ven los horarios libres y reservan desde el celular, a cualquier hora.',
  },
  {
    icono: Wallet,
    clave: 'Seña con Mercado Pago',
    titulo: 'La plata entra directo a tu cuenta',
    texto: 'El turno se confirma solo cuando el pago se acredita. Si no pagan a tiempo, el horario se libera.',
  },
  {
    icono: CalendarCheck,
    clave: 'Agenda en el celular',
    titulo: 'Web, teléfono y bloqueos en la misma grilla',
    texto: 'Cargás a mano las reservas que te piden por teléfono y nunca se pisan con las de la web.',
  },
]

export default function Inicio() {
  return (
    <div className="min-h-dvh bg-crema text-noche">
      <header className="sticky top-0 z-30 border-b border-linea/70 bg-crema/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-8">
          <Link to="/" aria-label="HayCanchas, inicio" className="flex items-center">
            <LogoHayCancha className="text-[24px]" />
          </Link>
          <nav aria-label="Secciones" className="ml-6 hidden items-center gap-1 text-[15px] font-semibold lg:flex">
            {[
              ['#buscar', 'Buscar'],
              ['#mapa', 'Mapa'],
              ['#complejos', 'Complejos'],
              ['#duenos', 'Para complejos'],
            ].map(([destino, texto]) => (
              <a key={destino} href={destino} className="rounded-full px-3.5 py-2 text-noche/75 transition-colors hover:bg-crema-oscuro hover:text-noche">
                {texto}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <BotonModo className="text-noche ring-1 ring-linea hover:bg-crema-oscuro" />
            <a href="#buscar" className="flex h-9 items-center rounded-full bg-cesped px-4 text-sm font-semibold text-white transition-colors hover:bg-cesped/90">
              <span className="sm:hidden">Buscar</span>
              <span className="hidden sm:inline">Buscar cancha</span>
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-4 pb-20 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-10 lg:pb-28">
          <div className="min-w-0">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: ENTRADA }}
              className="mb-4 text-xs font-semibold tracking-[.12em] text-gris uppercase"
            >
              Canchas en Buenos Aires
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: ENTRADA, delay: 0.05 }}
              className="font-titulo text-[clamp(68px,12.5vw,168px)] leading-[.88] font-extrabold text-balance uppercase"
            >
              <span className="text-cesped">¿</span>Hay cancha<span className="text-cesped">?</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: ENTRADA, delay: 0.15 }}
              className="mt-6 max-w-[44ch] text-[clamp(17px,1.7vw,20px)] text-gris"
            >
              Mirá qué canchas están libres de verdad, <b className="font-semibold text-noche">pagá la seña con Mercado Pago</b> y el turno queda tuyo. Sin esperar que
              alguien te conteste un mensaje.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: ENTRADA, delay: 0.22 }}
              className="mt-8 flex flex-wrap gap-2.5"
            >
              <a href="#buscar" className="rounded-full bg-cesped px-5 py-3 font-semibold text-white transition-transform hover:-translate-y-px">
                Buscar cancha
              </a>
              <a href="#sumate" className="rounded-full px-5 py-3 font-semibold ring-[1.5px] ring-noche transition-colors ring-inset hover:bg-noche hover:text-crema">
                Tengo un complejo
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: ENTRADA, delay: 0.1 }}
            className="bloque-oscuro relative aspect-[4/3] max-w-full overflow-hidden rounded-3xl shadow-[0_34px_70px_-34px_rgba(20,18,10,.55)]"
          >
            <TemaComplejo color="#1E7A3E" className="absolute inset-0">
              <DibujoCancha deporte="futbol7" animado className="absolute inset-0" />
            </TemaComplejo>
            <div className="absolute inset-0 bg-linear-to-t from-bloque/80 via-bloque/10 to-transparent" />
            <p className="absolute bottom-5 left-5 font-titulo text-3xl leading-none font-extrabold text-cal uppercase sm:text-4xl">
              Fútbol · Pádel · Tenis
              <br />
              Básquet · Vóley
            </p>
          </motion.div>
        </section>

        <section id="buscar" className="border-t border-linea">
          <div className="mx-auto max-w-4xl px-4 py-16 sm:px-8 sm:py-20">
            <h2 className="font-titulo text-[clamp(40px,6vw,64px)] leading-[.9] font-extrabold uppercase">Contanos qué buscás</h2>
            <p className="mt-2 mb-6 max-w-[60ch] text-gris">Escribilo como se lo dirías a un amigo: el deporte, el día, la hora, la zona y cómo querés la cancha. Te mostramos los turnos libres de verdad.</p>
            <BuscadorIA />
          </div>
        </section>

        <section id="mapa" className="border-t border-linea">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
            <h2 className="font-titulo text-[clamp(40px,6vw,64px)] leading-[.9] font-extrabold uppercase">El mapa de las canchas</h2>
            <p className="mt-2 mb-6 max-w-[60ch] text-gris">
              Todos los complejos que trabajan con HayCanchas. Buscá por nombre, barrio o deporte y tocá un pin para ver sus horarios.
            </p>
            <SeccionMapa />
          </div>
        </section>

        <section id="complejos" className="border-t border-linea">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-24">
            <DirectorioComplejos />
          </div>
        </section>

        <section id="duenos" className="bloque-oscuro bg-bloque text-cal">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-8 sm:py-28">
            <p className="text-xs font-semibold tracking-[.12em] text-cal/60 uppercase">Para dueños de complejos</p>
            <h2 className="mt-3 font-titulo text-[clamp(42px,6.4vw,80px)] leading-[.9] font-extrabold text-balance uppercase">Tu agenda se llena sola</h2>
            <ul className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-10">
              {PARA_DUENOS.map(({ icono: Icono, clave, titulo, texto }) => (
                <li key={clave} className="grid content-start gap-2">
                  <Icono className="size-6 text-cesped-claro" aria-hidden="true" />
                  <span className="text-xs font-semibold tracking-[.1em] text-cesped-claro uppercase">{clave}</span>
                  <b className="text-lg font-semibold">{titulo}</b>
                  <p className="text-cal/75">{texto}</p>
                </li>
              ))}
            </ul>
            <div id="sumate" className="mt-12 max-w-2xl scroll-mt-20">
              <FormularioComplejo />
            </div>
          </div>
        </section>
      </main>

      <PieHayCancha />
    </div>
  )
}

function SeccionMapa() {
  const { data } = useComplejos()
  return <MapaDeCanchas complejos={data ?? []} />
}
