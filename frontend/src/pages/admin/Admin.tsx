import { ExternalLink, Plus, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router'

import { mensaje } from '../../api/client'
import { type ComplejoAdmin, type UsuarioSesion, useCambiarComplejo, useComplejosAdmin, useLinkDelDueno, useSalir } from '../../api/panel'
import { LogoHayCancha } from '../../components/marca/LogoHayCancha'
import { PantallaMensaje, RequiereSesion } from '../../components/RequiereSesion'
import { Aviso, Boton, CopiarLink } from '../../components/ui/Formulario'
import NuevoComplejo from './NuevoComplejo'
import { BotonModo } from '../../components/BotonModo'

/** Panel de HayCanchas: todos los complejos, altas, suspensiones y cobros. */
export default function Admin() {
  return (
    <RequiereSesion>
      {(yo) =>
        yo.rol === 'superadmin' ? (
          <MarcoAdmin yo={yo}>
            <Routes>
              <Route index element={<ListaDeComplejos />} />
              <Route path="nuevo" element={<NuevoComplejo />} />
            </Routes>
          </MarcoAdmin>
        ) : (
          <PantallaMensaje titulo="Solo para HayCanchas">Esta sección es del equipo de HayCanchas.</PantallaMensaje>
        )
      }
    </RequiereSesion>
  )
}

function MarcoAdmin({ yo, children }: { yo: UsuarioSesion; children: ReactNode }) {
  const salir = useSalir()
  const navegar = useNavigate()
  return (
    <div className="min-h-dvh bg-crema text-noche">
      <header className="bloque-oscuro bg-bloque text-cal">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3.5 sm:px-8">
          <Link to="/admin" aria-label="Panel de HayCanchas">
            <LogoHayCancha sobreOscuro className="text-[22px]" />
          </Link>
          <span className="rounded-md bg-cal/10 px-2 py-0.5 text-xs font-semibold tracking-[.08em] text-cesped-claro uppercase">Admin</span>
          <span className="ml-auto hidden text-sm text-cal/60 md:inline">{yo.email}</span>
          <BotonModo className="ml-auto text-cal hover:bg-cal/10 md:ml-0" />
          <button
            type="button"
            onClick={() => salir.mutate(undefined, { onSuccess: () => navegar('/ingresar') })}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-cal/10"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-16 sm:px-8">{children}</main>
    </div>
  )
}

const ESTADOS: Record<ComplejoAdmin['estado_cuenta'], string> = {
  al_dia: 'Al día',
  atrasado: 'Atrasado',
  suspendido: 'Suspendido',
}

function ListaDeComplejos() {
  const complejos = useComplejosAdmin()
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-titulo text-[clamp(40px,6vw,60px)] leading-[.9] font-extrabold uppercase">Complejos</h1>
          <p className="mt-2 text-gris">
            {complejos.data ? `${complejos.data.length} ${complejos.data.length === 1 ? 'complejo' : 'complejos'} en HayCanchas.` : ' '}
          </p>
        </div>
        <Link to="/admin/nuevo" className="inline-flex items-center gap-2 rounded-xl bg-cesped px-4 py-2.5 font-semibold text-white hover:bg-cesped/90">
          <Plus className="size-4" aria-hidden="true" />
          Dar de alta un complejo
        </Link>
      </div>
      {complejos.error && <Aviso>{mensaje(complejos.error)}</Aviso>}
      {complejos.data?.length === 0 && <Aviso tipo="info">Todavía no hay complejos. Dá de alta el primero.</Aviso>}
      <ul className="grid gap-3">
        {complejos.data?.map((c) => (
          <FilaComplejo key={c.id} complejo={c} />
        ))}
      </ul>
    </div>
  )
}

function FilaComplejo({ complejo: c }: { complejo: ComplejoAdmin }) {
  const cambiar = useCambiarComplejo()
  const link = useLinkDelDueno()
  const suspendido = c.estado_cuenta === 'suspendido'
  return (
    <li className={`grid gap-3 rounded-2xl bg-cal p-4 ring-1 ring-linea sm:p-5 ${suspendido ? 'opacity-75' : ''}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <b className="text-lg">{c.nombre}</b>
          <p className="text-sm text-gris">
            haycanchas.com.ar/{c.slug}
            {c.barrio && ` · ${c.barrio}`} · {c.canchas} {c.canchas === 1 ? 'cancha' : 'canchas'}
          </p>
          <p className="mt-1 text-sm">
            {c.dueno_email ?? 'Sin dueño'}{' '}
            {c.dueno_email &&
              (c.dueno_clave_definida ? (
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-900">Ya entró</span>
              ) : (
                <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">Falta que elija su contraseña</span>
              ))}
          </p>
        </div>
        <label className="grid gap-1 text-[13px] font-semibold">
          Cobro
          <select
            value={c.estado_cuenta}
            disabled={cambiar.isPending}
            onChange={(e) => cambiar.mutate({ id: c.id, estado_cuenta: e.target.value as ComplejoAdmin['estado_cuenta'] })}
            className={`rounded-lg border-[1.5px] px-2.5 py-1.5 text-sm font-semibold ${
              suspendido ? 'border-red-300 bg-red-50 text-red-800' : c.estado_cuenta === 'atrasado' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-linea bg-superficie'
            }`}
          >
            {Object.entries(ESTADOS).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-1.5 text-sm font-semibold">
          <input
            type="checkbox"
            checked={c.plan === 'pro'}
            disabled={cambiar.isPending}
            onChange={(e) => cambiar.mutate({ id: c.id, plan: e.target.checked ? 'pro' : null })}
            className="size-4 accent-[#1E7A3E]"
          />
          Plan Pro
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to={`/panel/${c.slug}/canchas`} className="inline-flex items-center gap-2 rounded-xl bg-noche px-3.5 py-2 text-sm font-semibold text-crema hover:bg-noche/90">
          <Settings className="size-4" aria-hidden="true" />
          Configurar
        </Link>
        <Link to={`/${c.slug}`} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold ring-[1.5px] ring-noche ring-inset hover:bg-noche hover:text-crema">
          <ExternalLink className="size-4" aria-hidden="true" />
          Ver página
        </Link>
        {c.dueno_email && !c.dueno_clave_definida && (
          <Boton variante="suave" className="px-3.5 py-2 text-sm" cargando={link.isPending} onClick={() => link.mutate(c.id)}>
            Link para el dueño
          </Boton>
        )}
      </div>
      {link.data && <CopiarLink link={link.data.link} />}
      {(cambiar.error || link.error) && <Aviso>{mensaje(cambiar.error ?? link.error)}</Aviso>}
      {suspendido && <p className="text-sm text-red-800">Suspendido: no aparece en la página principal y su página no abre.</p>}
    </li>
  )
}
