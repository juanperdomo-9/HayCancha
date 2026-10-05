import { Check, MessageCircle, Phone, X } from 'lucide-react'
import { useState } from 'react'

import {
  type Agenda,
  type ReservaDetalle,
  useCambiarReserva,
  useCancelarReserva,
  useMoverReserva,
  useReserva,
} from '../../api/agenda'
import { mensaje } from '../../api/client'
import { fechaLarga, plata } from '../../utils/formato'
import { urlLlamar, urlWhatsapp } from '../../utils/telefono'
import { Aviso, Boton } from '../ui/Formulario'

const ORIGEN = { web: 'Reservó por la página', panel: 'Cargada a mano', bot: 'Reservó con el asistente' }
const ESTADO = {
  confirmada: ['Reservado', 'bg-noche text-crema'],
  pendiente_pago: ['Pendiente de pago', 'bg-amber-100 text-amber-900'],
  bloqueada: ['Bloqueado', 'bg-crema-oscuro text-noche'],
  cancelada: ['Cancelada', 'bg-red-100 text-red-800'],
  vencida: ['Vencida', 'bg-crema-oscuro text-gris'],
} as const

type Props = { slug: string; reservaId: string; agenda: Agenda | undefined; onListo: () => void }

export function DetalleReserva({ slug, reservaId, agenda, onListo }: Props) {
  const { data: r, error, isPending } = useReserva(slug, reservaId)
  if (isPending) return <p className="text-gris">Cargando…</p>
  if (error) return <Aviso>{mensaje(error)}</Aviso>
  return <Detalle slug={slug} r={r} agenda={agenda} onListo={onListo} />
}

function Detalle({ slug, r, agenda, onListo }: { slug: string; r: ReservaDetalle; agenda: Agenda | undefined; onListo: () => void }) {
  const cambiar = useCambiarReserva(slug)
  const cancelar = useCancelarReserva(slug)
  // Si la seña se pagó online, al cancelar se devuelve salvo que el dueño lo destilde.
  const [devolverSena, setDevolverSena] = useState(true)
  const [confirmarCancelacion, setConfirmarCancelacion] = useState(false)
  const [moviendo, setMoviendo] = useState(false)
  const activa = r.estado === 'confirmada' || r.estado === 'pendiente_pago'
  const [etiqueta, colores] = ESTADO[r.estado]
  const error = cambiar.error ?? cancelar.error

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl bg-cal p-4 ring-1 ring-linea">
        <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${colores}`}>
          {etiqueta}
          {r.minutos_para_pagar !== null && ` · quedan ${r.minutos_para_pagar} min`}
        </span>
        <p className="numeros mt-2 text-4xl leading-none font-extrabold" style={{ fontStretch: '74%' }}>
          {r.hora} a {r.hora_fin}
        </p>
        <p className="mt-1 font-semibold">{fechaLarga(r.fecha)}</p>
        <p className="text-sm text-gris">
          {r.cancha} · {r.deporte_nombre}
        </p>
      </div>

      {r.estado === 'bloqueada' ? (
        <p className="rounded-xl bg-superficie px-4 py-3 ring-1 ring-linea">
          <b>Motivo:</b> {r.motivo_bloqueo}
        </p>
      ) : (
        r.cliente && (
          <div className="grid gap-3 rounded-xl bg-superficie p-4 ring-1 ring-linea">
            <div>
              <b className="text-lg">{r.cliente.nombre}</b>
              <p className="text-sm text-gris">
                {r.cliente.telefono}
                {r.cliente.email && ` · ${r.cliente.email}`}
              </p>
              <p className="mt-1 text-xs text-gris">
                {ORIGEN[r.origen]} el {new Date(r.creado_a).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
            <div className="flex gap-2">
              <a href={urlLlamar(r.cliente.telefono)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-crema-oscuro/70 px-3 py-2.5 font-semibold hover:bg-crema-oscuro">
                <Phone className="size-4" aria-hidden="true" />
                Llamar
              </a>
              <a
                href={urlWhatsapp(r.cliente.telefono)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366]/15 px-3 py-2.5 font-semibold text-[#0b6b34] hover:bg-[#25D366]/25"
              >
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp
              </a>
            </div>
          </div>
        )
      )}

      {r.estado !== 'bloqueada' && (
        <dl className="grid gap-1.5 rounded-xl bg-superficie p-4 tabular-nums ring-1 ring-linea">
          <div className="flex justify-between">
            <dt className="text-gris">Turno</dt>
            <dd>{r.precio ? plata(r.precio) : '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gris">Seña</dt>
            <dd>
              {plata(r.sena)}
              {r.sena_en_efectivo && ' (efectivo)'}
              {r.sena_online && ' (Mercado Pago)'}
            </dd>
          </div>
          {r.devolucion && (
            <div className="flex justify-between">
              <dt className="text-gris">Devolución de la seña</dt>
              <dd className={r.devolucion === 'pendiente' ? 'font-semibold text-amber-700' : ''}>
                {r.devolucion === 'hecha' ? 'Devuelta' : 'Pendiente (falta saldo en Mercado Pago; se reintenta sola)'}
              </dd>
            </div>
          )}
          <div className="flex justify-between font-bold">
            <dt>{r.saldo_cobrado ? 'Saldo' : 'Falta cobrar en la cancha'}</dt>
            <dd className="text-right">
              {r.saldo_cobrado ? (r.saldo_en_efectivo ? 'Cobrado en efectivo' : 'Cobrado') : plata(r.saldo)}
              {!r.saldo_cobrado && r.saldo_efectivo && <span className="block text-[13px] font-normal text-gris">{plata(r.saldo_efectivo)} en efectivo</span>}
            </dd>
          </div>
        </dl>
      )}

      {r.estado === 'confirmada' && (
        <div className="grid gap-2">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['vino', 'Vino', Check],
                ['no_vino', 'No vino', X],
              ] as const
            ).map(([valor, texto, Icono]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={r.asistencia === valor}
                disabled={cambiar.isPending}
                onClick={() => cambiar.mutate({ id: r.id, asistencia: r.asistencia === valor ? null : valor })}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-superficie px-3 py-2.5 font-semibold ring-1 ring-linea aria-pressed:bg-noche aria-pressed:text-crema aria-pressed:ring-noche"
              >
                <Icono className="size-4" aria-hidden="true" />
                {texto}
              </button>
            ))}
          </div>
          {r.saldo_cobrado || !r.saldo_efectivo ? (
            <Boton
              variante={r.saldo_cobrado ? 'suave' : 'principal'}
              cargando={cambiar.isPending}
              onClick={() => cambiar.mutate({ id: r.id, saldo_cobrado: !r.saldo_cobrado, saldo_en_efectivo: false })}
            >
              {r.saldo_cobrado ? 'Marcar saldo como no cobrado' : `Cobré ${plata(r.saldo)} en la cancha`}
            </Boton>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Boton cargando={cambiar.isPending} onClick={() => cambiar.mutate({ id: r.id, saldo_cobrado: true, saldo_en_efectivo: true })}>
                Cobré {plata(r.saldo_efectivo)} en efectivo
              </Boton>
              <Boton variante="suave" cargando={cambiar.isPending} onClick={() => cambiar.mutate({ id: r.id, saldo_cobrado: true, saldo_en_efectivo: false })}>
                Cobré {plata(r.saldo)} con otro medio
              </Boton>
            </div>
          )}
        </div>
      )}

      {activa && !moviendo && (
        <Boton variante="secundario" onClick={() => setMoviendo(true)}>
          Mover a otra cancha u horario
        </Boton>
      )}
      {activa && moviendo && <Mover slug={slug} r={r} agenda={agenda} onCancelar={() => setMoviendo(false)} onListo={onListo} />}

      {error && <Aviso>{mensaje(error)}</Aviso>}

      {(activa || r.estado === 'bloqueada') &&
        (confirmarCancelacion ? (
          <div className="grid gap-2 rounded-xl bg-red-50 p-4 ring-1 ring-red-200">
            <p className="text-sm text-red-900">
              {r.estado === 'bloqueada' ? 'El turno vuelve a quedar libre en tu página.' : 'El turno se libera para otro jugador.'}
            </p>
            {r.sena_online && (
              <label className="flex items-center gap-2.5 text-sm font-semibold text-red-950">
                <input type="checkbox" checked={devolverSena} onChange={(e) => setDevolverSena(e.target.checked)} className="size-4 accent-red-700" />
                Devolver la seña de {plata(r.sena)}
              </label>
            )}
            <div className="flex gap-2">
              <Boton variante="peligro" className="flex-1" cargando={cancelar.isPending} onClick={() => cancelar.mutate({ id: r.id, devolverSena }, { onSuccess: onListo })}>
                {r.estado === 'bloqueada' ? 'Sí, desbloquear' : 'Sí, cancelar'}
              </Boton>
              <Boton variante="suave" className="flex-1" onClick={() => setConfirmarCancelacion(false)}>
                No
              </Boton>
            </div>
          </div>
        ) : (
          <Boton variante="peligro" onClick={() => setConfirmarCancelacion(true)}>
            {r.estado === 'bloqueada' ? 'Desbloquear' : 'Cancelar reserva'}
          </Boton>
        ))}
    </div>
  )
}

/** Mover a otra cancha del mismo deporte o a otro horario libre del mismo día. */
function Mover({ slug, r, agenda, onCancelar, onListo }: { slug: string; r: ReservaDetalle; agenda: Agenda | undefined; onCancelar: () => void; onListo: () => void }) {
  const mover = useMoverReserva(slug)
  const mismoDia = agenda?.fecha === r.fecha
  const canchas = mismoDia ? agenda.canchas.filter((c) => c.deporte === r.deporte) : []
  const [canchaId, setCanchaId] = useState(r.cancha_id)
  const cancha = canchas.find((c) => c.id === canchaId)
  const libres = cancha?.turnos.filter((t) => !t.reserva && !t.pasado) ?? []
  const [inicio, setInicio] = useState('')

  if (!mismoDia) return <Aviso tipo="info">Abrí la agenda del día de esta reserva para moverla.</Aviso>

  return (
    <div className="grid gap-3 rounded-xl bg-superficie p-4 ring-1 ring-linea">
      <label className="grid gap-1.5 text-[13px] font-semibold">
        Cancha
        <select
          value={canchaId}
          onChange={(e) => {
            setCanchaId(e.target.value)
            setInicio('')
          }}
          className="rounded-[10px] border-[1.5px] border-linea bg-superficie px-3 py-2.5 text-[16px] font-normal"
        >
          {canchas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">Horario libre</legend>
        {libres.length ? (
          <div className="flex flex-wrap gap-1.5">
            {libres.map((t) => (
              <button
                key={t.inicio}
                type="button"
                aria-pressed={inicio === t.inicio}
                onClick={() => setInicio(t.inicio)}
                className="numeros rounded-lg px-3 py-1.5 font-bold ring-1 ring-linea aria-pressed:bg-noche aria-pressed:text-crema aria-pressed:ring-noche"
              >
                {t.hora}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gris">Esa cancha no tiene horarios libres este día.</p>
        )}
      </fieldset>
      {mover.error && <Aviso>{mensaje(mover.error)}</Aviso>}
      <div className="flex gap-2">
        <Boton className="flex-1" disabled={!inicio} cargando={mover.isPending} onClick={() => mover.mutate({ id: r.id, recurso_id: canchaId, inicio }, { onSuccess: onListo })}>
          Mover
        </Boton>
        <Boton variante="suave" className="flex-1" onClick={onCancelar}>
          Volver
        </Boton>
      </div>
    </div>
  )
}
