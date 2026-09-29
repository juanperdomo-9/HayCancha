import { type FormEvent, useState } from 'react'
import { useParams } from 'react-router'

import { mensaje } from '../../api/client'
import { type Integrante, useCambiarIntegrante, useEquipo, useInvitarEmpleado, useNuevoLink } from '../../api/panel'
import { Aviso, Boton, Campo, CopiarLink, Tarjeta } from '../../components/ui/Formulario'
import { EncabezadoSeccion } from './EncabezadoSeccion'

export default function Equipo() {
  const { slug = '' } = useParams()
  const equipo = useEquipo(slug)
  const invitar = useInvitarEmpleado(slug)
  const [email, setEmail] = useState('')
  const [link, setLink] = useState<{ email: string; link: string } | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    invitar.mutate(email, {
      onSuccess: (r) => {
        setLink({ email: r.integrante.email, link: r.link })
        setEmail('')
      },
    })
  }

  return (
    <div className="grid gap-6">
      <EncabezadoSeccion
        titulo="Equipo"
        bajada="Las personas que manejan la agenda. Ven y cargan reservas, pero no tocan precios, horarios ni cobros."
      />
      <Tarjeta titulo="Sumar a alguien">
        <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Campo etiqueta="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Boton type="submit" cargando={invitar.isPending}>
            Invitar
          </Boton>
        </form>
        {invitar.error && (
          <div className="mt-3">
            <Aviso>{mensaje(invitar.error)}</Aviso>
          </div>
        )}
        {link && (
          <div className="mt-4 grid gap-3 rounded-xl bg-white p-4 ring-1 ring-linea">
            <Aviso tipo="ok">
              Listo. Mandale este link a <b>{link.email}</b> para que elija su contraseña.
            </Aviso>
            <CopiarLink link={link.link} />
          </div>
        )}
      </Tarjeta>
      <Tarjeta titulo="Quiénes tienen acceso">
        {equipo.error && <Aviso>{mensaje(equipo.error)}</Aviso>}
        <ul className="divide-y divide-linea">
          {equipo.data?.map((persona) => (
            <FilaIntegrante key={persona.id} slug={slug} persona={persona} />
          ))}
        </ul>
      </Tarjeta>
    </div>
  )
}

function FilaIntegrante({ slug, persona }: { slug: string; persona: Integrante }) {
  const cambiar = useCambiarIntegrante(slug)
  const nuevoLink = useNuevoLink(slug)
  return (
    <li className="grid gap-3 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <b className={persona.activo ? '' : 'text-gris line-through'}>{persona.email}</b>
        <span className="rounded-md bg-crema-oscuro px-2 py-0.5 text-xs font-semibold">{persona.rol === 'dueno' ? 'Dueño' : 'Empleado'}</span>
        {!persona.clave_definida && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Invitación pendiente</span>}
        <span className="ml-auto flex gap-2">
          {!persona.clave_definida && (
            <Boton variante="suave" cargando={nuevoLink.isPending} onClick={() => nuevoLink.mutate(persona.id)}>
              Nuevo link
            </Boton>
          )}
          {persona.rol === 'empleado' && (
            <Boton
              variante={persona.activo ? 'peligro' : 'secundario'}
              cargando={cambiar.isPending}
              onClick={() => cambiar.mutate({ id: persona.id, activo: !persona.activo })}
            >
              {persona.activo ? 'Quitar acceso' : 'Devolver acceso'}
            </Boton>
          )}
        </span>
      </div>
      {nuevoLink.data && <CopiarLink link={nuevoLink.data.link} />}
      {(cambiar.error || nuevoLink.error) && <Aviso>{mensaje(cambiar.error ?? nuevoLink.error)}</Aviso>}
    </li>
  )
}
