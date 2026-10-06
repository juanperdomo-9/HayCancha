import { BarChart3, Bot, CalendarDays, LogOut, Menu, X, Clock, CreditCard, Palette, Shield, SquareStack, Users, Wallet } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router'

import { ErrorApi, mensaje } from '../../api/client'
import { inicioDe, usePanel, useSalir, type UsuarioSesion } from '../../api/panel'
import { LogoComplejo } from '../../components/complejo/LogoComplejo'
import { LogoHayCancha } from '../../components/marca/LogoHayCancha'
import { PantallaCargando, PantallaMensaje, RequiereSesion } from '../../components/RequiereSesion'
import { TemaComplejo } from '../../theme/TemaComplejo'
import { BotonModo } from '../../components/BotonModo'

/** /panel sin complejo: cada uno va al suyo. */
export function PanelSinComplejo() {
  return <RequiereSesion>{(yo) => <Navigate to={inicioDe(yo)} replace />}</RequiereSesion>
}

/** Marco del panel de un complejo: estructura de HayCancha con el logo y el color del complejo. */
export default function Panel() {
  const { slug = '' } = useParams()
  return <RequiereSesion>{(yo) => <PanelDelComplejo slug={slug} yo={yo} />}</RequiereSesion>
}

const SECCIONES = [
  { ruta: '', nombre: 'Agenda', icono: CalendarDays, soloDueno: false },
  { ruta: 'resultados', nombre: 'Resultados', icono: BarChart3, soloDueno: true },
  { ruta: 'canchas', nombre: 'Canchas', icono: SquareStack, soloDueno: true },
  { ruta: 'horarios', nombre: 'Horarios y precios', icono: Clock, soloDueno: true },
  { ruta: 'reservas', nombre: 'Seña y cancelación', icono: Wallet, soloDueno: true },
  { ruta: 'marca', nombre: 'Tu página', icono: Palette, soloDueno: true },
  { ruta: 'equipo', nombre: 'Equipo', icono: Users, soloDueno: true },
  { ruta: 'cobros', nombre: 'Cobros', icono: CreditCard, soloDueno: true },
  { ruta: 'asistente', nombre: 'Asistente', icono: Bot, soloDueno: true },
]

function PanelDelComplejo({ slug, yo }: { slug: string; yo: UsuarioSesion }) {
  const { data: panel, isPending, error } = usePanel(slug)
  const salir = useSalir()
  const navegar = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)

  if (isPending) return <PantallaCargando />
  if (error) {
    const sinAcceso = error instanceof ErrorApi && (error.estado === 403 || error.estado === 404)
    return (
      <PantallaMensaje titulo={sinAcceso ? 'No podés entrar acá' : 'Algo falló'}>
        <p>{mensaje(error)}</p>
        <Link to={inicioDe(yo)} className="mt-5 inline-block font-semibold text-cesped underline underline-offset-3">
          Ir a mi panel
        </Link>
      </PantallaMensaje>
    )
  }

  const esDueno = panel.rol !== 'empleado'
  const secciones = SECCIONES.filter((s) => esDueno || !s.soloDueno)

  return (
    <TemaComplejo color={panel.color_primario} secundario={panel.color_secundario} className="min-h-dvh bg-crema text-noche">
      <header className="bloque-oscuro bg-bloque text-cal">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-8 lg:pb-0">
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            aria-label="Abrir el menú"
            aria-expanded={menuAbierto}
            className="-ml-1.5 grid size-10 flex-none place-items-center rounded-lg hover:bg-cal/10 lg:hidden"
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>
          <Link to="/" aria-label="HayCancha" className="hidden sm:block">
            <LogoHayCancha sobreOscuro className="text-[19px]" />
          </Link>
          <span className="hidden h-6 w-px bg-cal/20 sm:block" aria-hidden="true" />
          <span className="flex min-w-0 items-center gap-2.5">
            <LogoComplejo nombre={panel.nombre} logoUrl={panel.logo_url} className="w-8 flex-none rounded-lg text-[32px] ring-0" />
            <b className="truncate">{panel.nombre}</b>
          </span>
          <span className="ml-auto flex items-center gap-2 text-sm">
            {yo.rol === 'superadmin' && (
              <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-cesped-claro hover:bg-cal/10">
                <Shield className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}
            <span className="hidden text-cal/60 md:inline">{yo.email}</span>
            <BotonModo className="text-cal hover:bg-cal/10" />
            <button
              type="button"
              onClick={() => salir.mutate(undefined, { onSuccess: () => navegar('/ingresar') })}
              className="hidden rounded-lg px-2.5 py-1.5 font-medium hover:bg-cal/10 sm:block"
            >
              Salir
            </button>
          </span>
        </div>
        <nav aria-label="Secciones del panel" className="mx-auto hidden max-w-6xl gap-1 overflow-x-auto px-3 pt-3 [scrollbar-width:none] sm:px-7 lg:flex">
          {secciones.map(({ ruta, nombre, icono: Icono }) => (
            <NavLink
              key={ruta}
              to={ruta ? `/panel/${slug}/${ruta}` : `/panel/${slug}`}
              end
              className={({ isActive }) =>
                `flex flex-none items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-crema text-noche' : 'text-cal/70 hover:text-cal'
                }`
              }
            >
              <Icono className="size-4" aria-hidden="true" />
              {nombre}
            </NavLink>
          ))}
        </nav>
      </header>
      {createPortal(
        <AnimatePresence>
          {menuAbierto && (
            <MenuDelCelular
              slug={slug}
              nombre={panel.nombre}
              secciones={secciones}
              yo={yo}
              onCerrar={() => setMenuAbierto(false)}
              onSalir={() => salir.mutate(undefined, { onSuccess: () => navegar('/ingresar') })}
            />
          )}
        </AnimatePresence>,
        document.body,
      )}
      <main className="mx-auto max-w-6xl px-4 pt-7 pb-16 sm:px-8">
        <Outlet />
      </main>
    </TemaComplejo>
  )
}

/** Celular y tablet: el menú con todas las secciones, que se abre desde la izquierda. */
function MenuDelCelular({
  slug,
  nombre,
  secciones,
  yo,
  onCerrar,
  onSalir,
}: {
  slug: string
  nombre: string
  secciones: typeof SECCIONES
  yo: UsuarioSesion
  onCerrar: () => void
  onSalir: () => void
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    const scroll = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', alTeclear)
    return () => {
      document.body.style.overflow = scroll
      window.removeEventListener('keydown', alTeclear)
    }
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <motion.div className="absolute inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCerrar} />
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label="Menú del panel"
        className="bloque-oscuro absolute inset-y-0 left-0 flex w-[84%] max-w-xs flex-col bg-bloque text-cal shadow-2xl"
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <LogoHayCancha sobreOscuro className="text-[19px]" />
          <button type="button" onClick={onCerrar} aria-label="Cerrar el menú" className="grid size-10 place-items-center rounded-lg hover:bg-cal/10">
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>
        <p className="truncate px-5 pb-3 text-sm text-cal/60">{nombre}</p>
        <nav aria-label="Secciones del panel" className="grid flex-1 content-start gap-0.5 overflow-y-auto px-3">
          {secciones.map(({ ruta, nombre: texto, icono: Icono }) => (
            <NavLink
              key={ruta}
              to={ruta ? `/panel/${slug}/${ruta}` : `/panel/${slug}`}
              end
              onClick={onCerrar}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-semibold transition-colors ${
                  isActive ? 'bg-crema text-noche' : 'text-cal/80 hover:bg-cal/10 hover:text-cal'
                }`
              }
            >
              <Icono className="size-5" aria-hidden="true" />
              {texto}
            </NavLink>
          ))}
        </nav>
        <div className="grid gap-1 border-t border-cal/15 px-3 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
          {yo.rol === 'superadmin' && (
            <Link to="/admin" onClick={onCerrar} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-[15px] font-semibold text-cesped-claro hover:bg-cal/10">
              <Shield className="size-5" aria-hidden="true" />
              Admin de HayCancha
            </Link>
          )}
          <p className="truncate px-3.5 pt-1 text-[13px] text-cal/50">{yo.email}</p>
          <button type="button" onClick={onSalir} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-left text-[15px] font-semibold hover:bg-cal/10">
            <LogOut className="size-5" aria-hidden="true" />
            Salir
          </button>
        </div>
      </motion.aside>
    </div>
  )
}
