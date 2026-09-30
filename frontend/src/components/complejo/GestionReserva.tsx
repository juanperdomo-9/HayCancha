import { type FormEvent, useId, useState } from 'react'

import { mensaje } from '../../api/client'
import { type ReservaPublica, type Turno, useCambiarHorario, useCancelarReserva, useDisponibilidad } from '../../api/publico'
import { aIso, fechaLarga, plata } from '../../utils/formato'
import { TiraDeFechas } from './TiraDeFechas'

type Modo = 'nada' | 'cancelar' | 'cambiar'

/** "¿No podés ir?": el jugador cancela o cambia el horario confirmando con su teléfono. */
export function GestionReserva({ r }: { r: ReservaPublica }) {
  const [modo, setModo] = useState<Modo>('nada')
  const limite = new Date(r.cancelable_hasta)
  const limiteTexto = `${fechaLarga(aIso(limite)).toLowerCase()} a las ${limite.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`

  if (!r.puede_cancelar) return null

  return (
    <div className="mt-6 rounded-2xl bg-lienzo p-4 text-left ring-1 ring-borde">
      <p className="font-semibold">¿No podés ir?</p>
      <p className="mt-1 text-sm text-tenue">
        {r.recupera_sena
          ? `Hasta el ${limiteTexto} podés cancelar y te devolvemos la seña${r.puede_cambiar ? ', o cambiar el horario una vez' : ''}.`
          : r.sena_pagada
            ? `Ya pasó el límite de ${r.horas_cancelacion} horas: si cancelás, la seña queda para el complejo.`
            : 'Si cancelás, el turno se libera para otro jugador.'}
      </p>
      {r.ya_cambio_horario && <p className="mt-1 text-sm text-tenue">Esta reserva ya cambió de horario una vez.</p>}
      {modo === 'nada' && (
        <div className="mt-3 flex flex-wrap gap-2">
          {r.puede_cambiar && (
            <button
              type="button"
              onClick={() => setModo('cambiar')}
              className="rounded-xl bg-superficie px-4 py-2.5 text-sm font-semibold ring-1 ring-borde hover:ring-tinta"
            >
              Cambiar el horario
            </button>
          )}
          <button
            type="button"
            onClick={() => setModo('cancelar')}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-50"
          >
            Cancelar reserva
          </button>
        </div>
      )}
      {modo === 'cancelar' && <Cancelar r={r} onVolver={() => setModo('nada')} />}
      {modo === 'cambiar' && <Cambiar r={r} onVolver={() => setModo('nada')} />}
    </div>
  )
}

function CampoTelefono({ valor, onCambiar }: { valor: string; onCambiar: (v: string) => void }) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold">
        El teléfono con el que reservaste
      </label>
      <input
        id={id}
        type="tel"
        autoComplete="tel"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        className="w-full rounded-[10px] border-[1.5px] border-borde bg-superficie px-3 py-2.5 text-[16px] text-tinta focus:border-complejo focus:outline-none"
      />
    </div>
  )
}

function Cancelar({ r, onVolver }: { r: ReservaPublica; onVolver: () => void }) {
  const [telefono, setTelefono] = useState('')
  const cancelar = useCancelarReserva(r.slug, r.id)
  function enviar(e: FormEvent) {
    e.preventDefault()
    cancelar.mutate(telefono)
  }
  return (
    <form onSubmit={enviar} className="mt-3 grid gap-3">
      <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-900 ring-1 ring-red-200">
        {r.recupera_sena
          ? `Te devolvemos la seña de ${plata(r.sena)} en el mismo medio con el que pagaste.`
          : r.sena_pagada
            ? `Si cancelás ahora, perdés la seña de ${plata(r.sena)}.`
            : 'El turno se libera para otro jugador.'}
      </p>
      <CampoTelefono valor={telefono} onCambiar={setTelefono} />
      {cancelar.error && <p className="text-sm text-red-700">{mensaje(cancelar.error)}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={cancelar.isPending || telefono.replace(/\D/g, '').length < 6}
          className="flex-1 rounded-xl bg-red-700 px-4 py-3 font-bold text-white disabled:opacity-50"
        >
          {cancelar.isPending ? 'Cancelando…' : 'Sí, cancelar'}
        </button>
        <button type="button" onClick={onVolver} className="flex-1 rounded-xl px-4 py-3 font-semibold ring-1 ring-borde">
          No
        </button>
      </div>
    </form>
  )
}

function Cambiar({ r, onVolver }: { r: ReservaPublica; onVolver: () => void }) {
  const [ahora] = useState(() => Date.now())
  const hoy = aIso(new Date(ahora))
  const [fecha, setFecha] = useState(r.fecha)
  const [turno, setTurno] = useState<Turno | null>(null)
  const [telefono, setTelefono] = useState('')
  const disponibilidad = useDisponibilidad(r.slug, r.deporte_codigo, fecha)
  const cambiar = useCambiarHorario(r.slug, r.id)
  const libres = (disponibilidad.data?.turnos ?? []).filter((t) => t.libres.length > 0 && new Date(t.inicio).getTime() > ahora)

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (turno) cambiar.mutate({ telefono, inicio: turno.inicio })
  }
  return (
    <form onSubmit={enviar} className="mt-3 grid gap-3">
      <TiraDeFechas hoy={hoy} dias={14} valor={fecha} onCambiar={(f) => (setFecha(f), setTurno(null))} />
      <div className="grid grid-cols-4 gap-2" aria-label="Horarios libres">
        {libres.map((t) => (
          <button
            key={t.inicio}
            type="button"
            onClick={() => setTurno(t)}
            aria-pressed={turno?.inicio === t.inicio}
            className="numeros rounded-xl bg-superficie py-2.5 font-bold ring-1 ring-borde aria-pressed:bg-complejo aria-pressed:text-complejo-sobre aria-pressed:ring-complejo"
          >
            {t.hora}
          </button>
        ))}
        {!disponibilidad.isPending && libres.length === 0 && <p className="col-span-4 text-sm text-tenue">No quedan turnos libres ese día.</p>}
      </div>
      {turno && (
        <p className="text-sm">
          Nuevo turno:{' '}
          <b>
            {fechaLarga(fecha)}, {turno.hora}
          </b>
          . Tu seña de {plata(r.sena)} se mantiene
          {turno.precio && Number(turno.precio) !== Number(r.precio) ? `; en la cancha pagás ${plata(Math.max(0, Number(turno.precio) - Number(r.sena)))}` : ''}.
        </p>
      )}
      <CampoTelefono valor={telefono} onCambiar={setTelefono} />
      {cambiar.error && <p className="text-sm text-red-700">{mensaje(cambiar.error)}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!turno || cambiar.isPending || telefono.replace(/\D/g, '').length < 6}
          className="flex-1 rounded-xl bg-complejo px-4 py-3 font-bold text-complejo-sobre disabled:opacity-50"
        >
          {cambiar.isPending ? 'Cambiando…' : 'Cambiar el horario'}
        </button>
        <button type="button" onClick={onVolver} className="flex-1 rounded-xl px-4 py-3 font-semibold ring-1 ring-borde">
          Volver
        </button>
      </div>
      <p className="text-xs text-tenue">Se puede cambiar una sola vez.</p>
    </form>
  )
}
