import { CalendarDays, Clock, CreditCard, Palette, Shield, SquareStack, Users, Wallet } from 'lucide-react'
import { Link, Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router'

import { ErrorApi, mensaje } from '../../api/client'
import { inicioDe, usePanel, useSalir, type UsuarioSesion } from '../../api/panel'
import { LogoComplejo } from '../../components/complejo/LogoComplejo'
import { LogoHayCancha } from '../../components/marca/LogoHayCancha'
import { PantallaCargando, PantallaMensaje, RequiereSesion } from '../../components/RequiereSesion'
import { TemaComplejo } from '../../theme/TemaComplejo'

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
  { ruta: 'canchas', nombre: 'Canchas', icono: SquareStack, soloDueno: true },
  { ruta: 'horarios', nombre: 'Horarios y precios', icono: Clock, soloDueno: true },
  { ruta: 'reservas', nombre: 'Seña y cancelación', icono: Wallet, soloDueno: true },
  { ruta: 'marca', nombre: 'Tu página', icono: Palette, soloDueno: true },
  { ruta: 'equipo', nombre: 'Equipo', icono: Users, soloDueno: true },
  { ruta: 'cobros', nombre: 'Cobros', icono: CreditCard, soloDueno: true },
]

function PanelDelComplejo({ slug, yo }: { slug: string; yo: UsuarioSesion }) {
  const { data: panel, isPending, error } = usePanel(slug)
  const salir = useSalir()
  const navegar = useNavigate()

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
      <header className="bg-noche text-cal">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-3 sm:px-8">
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
            <button
              type="button"
              onClick={() => salir.mutate(undefined, { onSuccess: () => navegar('/ingresar') })}
              className="rounded-lg px-2.5 py-1.5 font-medium hover:bg-cal/10"
            >
              Salir
            </button>
          </span>
        </div>
        <nav aria-label="Secciones del panel" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pt-3 [scrollbar-width:none] sm:px-7">
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
      <main className="mx-auto max-w-6xl px-4 pt-7 pb-16 sm:px-8">
        <Outlet />
      </main>
    </TemaComplejo>
  )
}
