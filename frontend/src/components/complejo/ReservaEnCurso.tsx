import { X } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { useNavigate } from 'react-router'

import { llegadaDe } from '../../utils/llegada'

import { mensaje } from '../../api/client'
import { type CanchaLibre, type DeporteDelComplejo, type Turno, useCrearReserva } from '../../api/publico'
import { fechaLarga, plata } from '../../utils/formato'

type Props = {
  slug: string
  turno: Turno
  fecha: string
  deporte: DeporteDelComplejo
  cancha: CanchaLibre
  canchaElegida: boolean
  reservasOnline: boolean
  minutosParaPagar: number
  onCerrar?: () => void
}

type Datos = { nombre: string; telefono: string; email: string }

function validar(datos: Datos): Partial<Record<keyof Datos, string>> {
  const errores: Partial<Record<keyof Datos, string>> = {}
  if (datos.nombre.trim().length < 2) errores.nombre = 'Escribí tu nombre.'
  if (datos.telefono.replace(/\D/g, '').length < 8) errores.telefono = 'Revisá el teléfono: tiene que tener al menos 8 números.'
  if (datos.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email.trim())) errores.email = 'Revisá el email (o dejalo vacío).'
  return errores
}

/** Resumen del turno elegido y los datos del jugador. Los montos vienen del backend. */
export function ReservaEnCurso({ slug, turno, fecha, deporte, cancha, canchaElegida, reservasOnline, minutosParaPagar, onCerrar }: Props) {
  const id = useId()
  const navegar = useNavigate()
  const crear = useCrearReserva(slug)
  const [datos, setDatos] = useState<Datos>({ nombre: '', telefono: '', email: '' })
  const [errores, setErrores] = useState<Partial<Record<keyof Datos, string>>>({})
  const saldo = Number(cancha.precio) - Number(cancha.sena)
  const canchaTexto = canchaElegida ? `${cancha.nombre}${cancha.caracteristicas ? ` (${cancha.caracteristicas.toLowerCase()})` : ''}` : 'te asignamos la primera libre'

  function enviar(e: FormEvent) {
    e.preventDefault()
    const encontrados = validar(datos)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) return
    crear.mutate(
      {
        deporte: deporte.codigo,
        inicio: turno.inicio,
        recurso_id: canchaElegida ? cancha.id : undefined,
        nombre: datos.nombre.trim(),
        telefono: datos.telefono.trim(),
        email: datos.email.trim() || undefined,
        llegada: llegadaDe(slug),
      },
      {
        onSuccess: ({ url_pago, link }) => {
          // Con Mercado Pago se va a pagar afuera; al volver, cae en el link de la reserva.
          if (url_pago) window.location.assign(url_pago)
          else navegar(link)
        },
      },
    )
  }

  const campo = (nombre: keyof Datos, etiqueta: string, tipo: string, autocompletar: string) => (
    <div className="grid gap-1.5">
      <label htmlFor={`${id}-${nombre}`} className="text-[13px] font-semibold">
        {etiqueta}
      </label>
      <input
        id={`${id}-${nombre}`}
        type={tipo}
        autoComplete={autocompletar}
        value={datos[nombre]}
        aria-invalid={Boolean(errores[nombre])}
        onChange={(e) => setDatos({ ...datos, [nombre]: e.target.value })}
        className="w-full rounded-[10px] border-[1.5px] border-borde bg-lienzo px-3 py-2.5 text-[16px] text-tinta transition focus:border-complejo focus:shadow-[0_0_0_3px_var(--complejo-suave)] focus:outline-none aria-invalid:border-red-600"
      />
      {errores[nombre] && <p className="text-[12.5px] text-red-700">{errores[nombre]}</p>}
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-[.1em] text-tenue uppercase">Tu turno</p>
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full bg-lienzo">
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="numeros mt-2 text-5xl leading-[.95] font-extrabold" style={{ fontStretch: '74%' }}>
        {turno.hora} a {turno.hora_fin}
      </p>
      <p className="mt-1 font-semibold">{fechaLarga(fecha)}</p>
      <p className="mt-0.5 mb-4 text-[14.5px] text-tenue">
        {deporte.nombre} · {canchaTexto}
      </p>

      <dl className="mb-4 grid gap-2 border-y border-borde py-3.5 tabular-nums">
        <div className="flex justify-between gap-3">
          <dt className="text-tenue">Turno de {turno.duracion_min} min</dt>
          <dd>{plata(cancha.precio)}</dd>
        </div>
        <div className="flex justify-between gap-3 text-[17px] font-bold">
          <dt>Seña para reservar</dt>
          <dd className="text-complejo-texto">{plata(cancha.sena)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-tenue">En la cancha pagás</dt>
          <dd>{plata(saldo)}</dd>
        </div>
      </dl>

      {reservasOnline ? (
        <form className="grid gap-3" onSubmit={enviar} noValidate>
          {campo('nombre', 'Nombre y apellido', 'text', 'name')}
          {campo('telefono', 'Teléfono', 'tel', 'tel')}
          {campo('email', 'Email (opcional)', 'email', 'email')}
          {crear.error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800 ring-1 ring-red-200">
              {mensaje(crear.error)}
            </p>
          )}
          <button
            type="submit"
            disabled={crear.isPending}
            className="mt-1 rounded-xl bg-complejo px-4 py-[15px] font-bold text-complejo-sobre transition hover:brightness-105 active:scale-[.98] disabled:opacity-60"
          >
            {crear.isPending ? 'Reservando…' : `Pagar seña de ${plata(cancha.sena)}`}
          </button>
          <p className="text-center text-[12.5px] text-tenue">
            Te guardamos el turno {minutosParaPagar} minutos para que pagues la seña con Mercado Pago. No hace falta crear una cuenta.
          </p>
          <p className="text-center text-[12.5px] text-tenue">
            Después de pagar te damos <b className="text-tinta">el link de tu reserva: guardalo</b>, lo vas a necesitar para cancelar o cambiar el horario.
          </p>
        </form>
      ) : (
        <p className="rounded-xl bg-complejo-suave px-4 py-3 text-sm">
          Este complejo todavía no toma reservas online. Muy pronto vas a poder reservar y pagar la seña desde acá.
        </p>
      )}
    </div>
  )
}
