import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'

import { mensaje } from '../api/client'
import { inicioDe, useIngresar, useYo } from '../api/panel'
import { PantallaDeAcceso } from '../components/PantallaDeAcceso'
import { Aviso, Boton, Campo } from '../components/ui/Formulario'

/** Ingreso de dueños, empleados y del equipo de HayCanchas. Los jugadores no necesitan cuenta. */
export default function Ingresar() {
  const { data: yo } = useYo()
  const ingresar = useIngresar()
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')

  const volver = parametros.get('volver')
  const destinoSeguro = volver?.startsWith('/') && !volver.startsWith('//') ? volver : null

  if (yo) return <Navigate to={destinoSeguro ?? inicioDe(yo)} replace />

  function enviar(e: FormEvent) {
    e.preventDefault()
    ingresar.mutate(
      { email, clave },
      { onSuccess: (usuario) => navegar(destinoSeguro ?? inicioDe(usuario), { replace: true }) },
    )
  }

  return (
    <PantallaDeAcceso titulo="Ingresá a tu panel" bajada="Para dueños y equipos de los complejos. Para reservar una cancha no hace falta cuenta.">
      <form onSubmit={enviar} className="grid gap-4">
        <Campo
          etiqueta="Email o usuario"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Campo
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
        />
        {ingresar.error && <Aviso>{mensaje(ingresar.error)}</Aviso>}
        <Boton type="submit" cargando={ingresar.isPending} className="mt-1 py-3 text-base">
          Ingresar
        </Boton>
        <p className="text-center text-[13px] text-gris">
          ¿No tenés contraseña? Pedile a quien te dio de alta el link para elegirla.
        </p>
      </form>
    </PantallaDeAcceso>
  )
}
