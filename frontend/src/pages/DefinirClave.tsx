import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { mensaje } from '../api/client'
import { inicioDe, useDefinirClave, useInvitacion } from '../api/panel'
import { PantallaDeAcceso } from '../components/PantallaDeAcceso'
import { Aviso, Boton, Campo } from '../components/ui/Formulario'

/** A donde lleva el link de invitación: el dueño (o empleado) elige su contraseña. */
export default function DefinirClave() {
  const [parametros] = useSearchParams()
  const token = parametros.get('token') ?? ''
  const invitacion = useInvitacion(token)
  const definir = useDefinirClave()
  const navegar = useNavigate()
  const [clave, setClave] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (clave.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.')
    if (clave !== repetida) return setError('Las dos contraseñas no coinciden.')
    setError(null)
    definir.mutate({ token, clave }, { onSuccess: (usuario) => navegar(inicioDe(usuario), { replace: true }) })
  }

  if (!token || invitacion.isError) {
    return (
      <PantallaDeAcceso titulo="Link vencido" bajada="Este link ya se usó o venció.">
        <Aviso tipo="info">{invitacion.error ? mensaje(invitacion.error) : 'Falta el link de invitación.'}</Aviso>
        <Link to="/ingresar" className="mt-5 inline-block font-semibold text-cesped underline underline-offset-3">
          Ir a ingresar
        </Link>
      </PantallaDeAcceso>
    )
  }

  return (
    <PantallaDeAcceso
      titulo="Elegí tu contraseña"
      bajada={
        invitacion.data
          ? `Vas a entrar como ${invitacion.data.email}${invitacion.data.negocio ? ` al panel de ${invitacion.data.negocio}` : ''}.`
          : 'Revisando tu link…'
      }
    >
      <form onSubmit={enviar} className="grid gap-4">
        <Campo
          etiqueta="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          ayuda="Mínimo 8 caracteres."
        />
        <Campo
          etiqueta="Repetila"
          type="password"
          autoComplete="new-password"
          required
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
        />
        {(error || definir.error) && <Aviso>{error ?? mensaje(definir.error)}</Aviso>}
        <Boton type="submit" cargando={definir.isPending} disabled={!invitacion.data} className="mt-1 py-3 text-base">
          Guardar y entrar
        </Boton>
      </form>
    </PantallaDeAcceso>
  )
}
