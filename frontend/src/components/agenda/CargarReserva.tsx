import { type FormEvent, useState } from 'react'

import { type CanchaEnAgenda, type TurnoEnAgenda, useCargarReserva } from '../../api/agenda'
import { mensaje } from '../../api/client'
import { fechaLarga, plata } from '../../utils/formato'
import { Aviso, Boton, Campo } from '../ui/Formulario'

type Props = {
  slug: string
  fecha: string
  cancha: CanchaEnAgenda
  turno: TurnoEnAgenda
  onListo: () => void
}

/** Alguien llamó o vino en persona: la reserva queda confirmada al instante y el turno
 * deja de ofrecerse en la página. */
export function CargarReserva({ slug, fecha, cancha, turno, onListo }: Props) {
  const cargar = useCargarReserva(slug)
  const [datos, setDatos] = useState({ nombre: '', telefono: '', email: '', sena_en_efectivo: false })

  function enviar(e: FormEvent) {
    e.preventDefault()
    cargar.mutate(
      {
        recurso_id: cancha.id,
        inicio: turno.inicio,
        nombre: datos.nombre,
        telefono: datos.telefono,
        email: datos.email || undefined,
        sena_en_efectivo: datos.sena_en_efectivo,
      },
      { onSuccess: onListo },
    )
  }

  return (
    <form onSubmit={enviar} className="grid gap-4">
      <div className="rounded-2xl bg-cal p-4 ring-1 ring-linea">
        <p className="numeros text-4xl leading-none font-extrabold" style={{ fontStretch: '74%' }}>
          {turno.hora} a {turno.hora_fin}
        </p>
        <p className="mt-1 font-semibold">{fechaLarga(fecha)}</p>
        <p className="text-sm text-gris">
          {cancha.nombre} · {cancha.deporte_nombre} · {plata(turno.precio)}
        </p>
      </div>
      <Campo etiqueta="Nombre" required autoFocus value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
      <Campo
        etiqueta="Teléfono"
        type="tel"
        required
        inputMode="tel"
        value={datos.telefono}
        onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
        ayuda="Con el teléfono lo reconocemos si vuelve a reservar."
      />
      <Campo etiqueta="Email (opcional)" type="email" value={datos.email} onChange={(e) => setDatos({ ...datos, email: e.target.value })} />
      <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-white px-3.5 py-3 ring-1 ring-linea has-checked:ring-2 has-checked:ring-complejo">
        <input
          type="checkbox"
          checked={datos.sena_en_efectivo}
          onChange={(e) => setDatos({ ...datos, sena_en_efectivo: e.target.checked })}
          className="size-4 accent-[var(--complejo)]"
        />
        <span>
          <b>Dejó la seña en efectivo</b> <span className="text-gris">({plata(turno.sena)})</span>
        </span>
      </label>
      {cargar.error && <Aviso>{mensaje(cargar.error)}</Aviso>}
      <Boton type="submit" cargando={cargar.isPending} className="py-3 text-base">
        Reservar
      </Boton>
    </form>
  )
}
