import { X } from 'lucide-react'
import { useId, useState } from 'react'

import type { CanchaLibre, DeporteDelComplejo, Turno } from '../../api/publico'
import { fechaLarga, plata } from '../../utils/formato'

type Props = {
  turno: Turno
  fecha: string
  deporte: DeporteDelComplejo
  cancha: CanchaLibre
  canchaElegida: boolean
  onCerrar?: () => void
}

/** Resumen del turno elegido y los datos del jugador. Los montos vienen del backend. */
export function ReservaEnCurso({ turno, fecha, deporte, cancha, canchaElegida, onCerrar }: Props) {
  const id = useId()
  const [datos, setDatos] = useState({ nombre: '', telefono: '', email: '' })
  const saldo = Number(cancha.precio) - Number(cancha.sena)
  const canchaTexto = canchaElegida
    ? `${cancha.nombre}${cancha.caracteristicas ? ` (${cancha.caracteristicas.toLowerCase()})` : ''}`
    : 'te asignamos la primera libre'

  const campo = (nombre: keyof typeof datos, etiqueta: string, tipo: string, autocompletar: string) => (
    <div className="grid gap-1.5">
      <label htmlFor={`${id}-${nombre}`} className="text-[13px] font-semibold">
        {etiqueta}
      </label>
      <input
        id={`${id}-${nombre}`}
        type={tipo}
        autoComplete={autocompletar}
        value={datos[nombre]}
        onChange={(e) => setDatos({ ...datos, [nombre]: e.target.value })}
        className="w-full rounded-[10px] border-[1.5px] border-borde bg-base px-3 py-2.5 text-base transition focus:border-complejo focus:shadow-[0_0_0_3px_var(--complejo-suave)] focus:outline-none"
      />
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold tracking-[.1em] text-tenue uppercase">Tu turno</p>
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full bg-base">
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

      <form className="grid gap-3" onSubmit={(e) => e.preventDefault()}>
        {campo('nombre', 'Nombre y apellido', 'text', 'name')}
        {campo('telefono', 'Teléfono', 'tel', 'tel')}
        {campo('email', 'Email', 'email', 'email')}
        <button
          type="submit"
          disabled
          className="mt-1 cursor-not-allowed rounded-xl bg-complejo px-4 py-[15px] font-bold text-complejo-sobre opacity-60"
        >
          Pago online: muy pronto
        </button>
        <p className="text-center text-[12.5px] text-tenue">
          Estamos terminando de conectar Mercado Pago. Muy pronto vas a reservar y pagar la seña desde acá, sin crear una cuenta.
        </p>
      </form>
    </div>
  )
}
