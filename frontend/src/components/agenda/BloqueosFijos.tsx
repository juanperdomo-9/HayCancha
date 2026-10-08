import { Repeat, Trash2, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { type CanchaEnAgenda, useBloqueosFijos, useBorrarBloqueoFijo, useCrearBloqueoFijo } from '../../api/agenda'
import { mensaje } from '../../api/client'
import { Aviso, Boton } from '../ui/Formulario'

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const HORAS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

const corta = (hora: string) => hora.slice(0, 5)

/** Bloqueos que se repiten todas las semanas ("todos los martes de 23 a 00, liga"). */
export function BloqueosFijos({ slug, canchas, onCerrar }: { slug: string; canchas: CanchaEnAgenda[]; onCerrar: () => void }) {
  const lista = useBloqueosFijos(slug)
  const crear = useCrearBloqueoFijo(slug)
  const borrar = useBorrarBloqueoFijo(slug)
  const [datos, setDatos] = useState({ dia_semana: '1', desde: '23:00', hasta: '00:00', recurso_id: '', motivo: '' })
  const [aviso, setAviso] = useState<string | null>(null)

  function agregar(e: FormEvent) {
    e.preventDefault()
    setAviso(null)
    crear.mutate(
      { dia_semana: Number(datos.dia_semana), desde: datos.desde, hasta: datos.hasta, recurso_id: datos.recurso_id || null, motivo: datos.motivo },
      {
        onSuccess: ({ bloqueo, reservas_existentes }) => {
          setDatos({ ...datos, motivo: '' })
          const cuando = `todos los ${DIAS[bloqueo.dia_semana].toLowerCase()} de ${corta(bloqueo.desde)} a ${corta(bloqueo.hasta)}`
          setAviso(
            reservas_existentes
              ? `Listo: quedó bloqueado ${cuando}. Ojo: ya hay ${reservas_existentes} ${reservas_existentes === 1 ? 'reserva' : 'reservas'} en ese horario en las próximas semanas; no se cancelan solas, revisalas en la agenda.`
              : `Listo: quedó bloqueado ${cuando}. Nadie va a poder reservar en ese horario.`,
          )
        },
      },
    )
  }

  const campo = 'w-full rounded-xl border-[1.5px] border-linea bg-superficie px-3 py-2.5 text-[16px] focus:border-cesped focus:outline-none'
  return (
    <section aria-labelledby="bloqueos-fijos" className="grid gap-4 rounded-2xl bg-cal p-4 ring-1 ring-linea sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="bloqueos-fijos" className="flex items-center gap-2 text-lg font-bold">
            <Repeat className="size-5 text-cesped" aria-hidden="true" />
            Bloqueos fijos
          </h2>
          <p className="text-sm text-gris">Para horarios que se cierran todas las semanas: una liga, una escuelita, mantenimiento. Se carga una vez y vale para siempre, hasta que lo borres.</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-9 flex-none place-items-center rounded-full hover:bg-crema-oscuro">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={agregar} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_1fr_1.4fr_auto] lg:items-end">
        <label className="grid gap-1 text-[13px] font-semibold">
          Todos los
          <select value={datos.dia_semana} onChange={(e) => setDatos({ ...datos, dia_semana: e.target.value })} className={campo}>
            {DIAS.map((d, i) => (
              <option key={d} value={i}>
                {d.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          De
          <select value={datos.desde} onChange={(e) => setDatos({ ...datos, desde: e.target.value })} className={campo}>
            {HORAS.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          A
          <select value={datos.hasta} onChange={(e) => setDatos({ ...datos, hasta: e.target.value })} className={campo}>
            {HORAS.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          Cancha
          <select value={datos.recurso_id} onChange={(e) => setDatos({ ...datos, recurso_id: e.target.value })} className={campo}>
            <option value="">Todas las canchas</option>
            {canchas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} · {c.deporte_nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-[13px] font-semibold">
          Motivo
          <input required minLength={2} maxLength={80} placeholder="Liga de los martes" value={datos.motivo} onChange={(e) => setDatos({ ...datos, motivo: e.target.value })} className={campo} />
        </label>
        <Boton type="submit" cargando={crear.isPending} disabled={datos.desde === datos.hasta}>
          Bloquear
        </Boton>
      </form>
      {datos.desde === datos.hasta && <p className="text-sm text-gris">Elegí un horario de inicio y uno de fin distintos.</p>}
      {aviso && <Aviso tipo={aviso.includes('Ojo') ? 'info' : 'ok'}>{aviso}</Aviso>}
      {(crear.error || borrar.error) && <Aviso>{mensaje(crear.error ?? borrar.error)}</Aviso>}

      <div className="grid gap-2">
        <b className="text-sm">Bloqueos activos</b>
        {lista.data?.length === 0 && <p className="text-sm text-gris">Todavía no hay bloqueos fijos.</p>}
        <ul className="grid gap-2">
          {lista.data?.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 rounded-xl bg-superficie px-3.5 py-2.5 ring-1 ring-linea">
              <span className="min-w-0">
                <b>
                  Todos los {DIAS[b.dia_semana].toLowerCase()} · {corta(b.desde)} a {corta(b.hasta)}
                </b>
                <span className="block truncate text-sm text-gris">
                  {b.cancha ?? 'Todas las canchas'} · {b.motivo}
                </span>
              </span>
              <button
                type="button"
                onClick={() => borrar.mutate(b.id)}
                disabled={borrar.isPending}
                aria-label={`Borrar el bloqueo de los ${DIAS[b.dia_semana].toLowerCase()}`}
                className="grid size-9 flex-none place-items-center rounded-lg text-gris hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
