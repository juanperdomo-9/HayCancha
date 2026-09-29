import { Ban, Check, Globe, Phone, Plus, X } from 'lucide-react'

import { type CanchaEnAgenda, claveTurno, type TurnoEnAgenda } from '../../api/agenda'
import { plata } from '../../utils/formato'

type Props = {
  titulo: string
  canchas: CanchaEnAgenda[]
  modoBloqueo: boolean
  seleccionados: Set<string>
  onElegirLibre: (cancha: CanchaEnAgenda, turno: TurnoEnAgenda) => void
  onElegirOcupado: (reservaId: string) => void
  onAlternarSeleccion: (clave: string) => void
  onSeleccionarDia: (cancha: CanchaEnAgenda) => void
}

/** Una tabla por deporte: una columna por cancha y una fila por horario. */
export function GrillaAgenda({ titulo, canchas, modoBloqueo, seleccionados, onElegirLibre, onElegirOcupado, onAlternarSeleccion, onSeleccionarDia }: Props) {
  // Las filas son todos los horarios de las canchas de este deporte.
  const horas = new Map<string, string>()
  canchas.forEach((c) => c.turnos.forEach((t) => horas.set(t.inicio, t.hora)))
  const filas = [...horas.entries()].sort(([a], [b]) => a.localeCompare(b))
  const turnoDe = (cancha: CanchaEnAgenda, inicio: string) => cancha.turnos.find((t) => t.inicio === inicio)

  return (
    <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2.5">
      <h2 className="text-lg font-bold">{titulo}</h2>
      {filas.length === 0 ? (
        <p className="rounded-xl bg-cal px-4 py-3 text-sm text-gris ring-1 ring-linea">Este día no hay horarios cargados para estas canchas.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div
            className="grid min-w-max gap-1.5"
            style={{ gridTemplateColumns: `56px repeat(${canchas.length}, minmax(148px, 1fr))` }}
            role="table"
            aria-label={`Agenda de ${titulo}`}
          >
            <div role="row" className="contents">
              <span role="columnheader" className="sticky left-0 z-10 bg-crema" />
              {canchas.map((c) => (
                <div key={c.id} role="columnheader" className="grid gap-0.5 px-1 pb-1">
                  <b className="truncate text-sm">{c.nombre}</b>
                  {modoBloqueo ? (
                    <button type="button" onClick={() => onSeleccionarDia(c)} className="justify-self-start text-xs font-semibold text-complejo-texto underline underline-offset-2">
                      Todo el día
                    </button>
                  ) : (
                    <span className="truncate text-xs text-gris">{c.caracteristicas ?? ' '}</span>
                  )}
                </div>
              ))}
            </div>
            {filas.map(([inicio, hora]) => (
              <div key={inicio} role="row" className="contents">
                <span role="rowheader" className="numeros sticky left-0 z-10 bg-crema pt-2.5 text-[15px] font-bold text-gris">
                  {hora}
                </span>
                {canchas.map((cancha) => {
                  const turno = turnoDe(cancha, inicio)
                  if (!turno) return <span key={cancha.id} role="cell" className="rounded-xl bg-crema-oscuro/40" />
                  const clave = claveTurno(cancha.id, turno.inicio)
                  return (
                    <Celda
                      key={cancha.id}
                      turno={turno}
                      modoBloqueo={modoBloqueo}
                      seleccionado={seleccionados.has(clave)}
                      onLibre={() => (modoBloqueo ? onAlternarSeleccion(clave) : onElegirLibre(cancha, turno))}
                      onOcupado={() => turno.reserva && onElegirOcupado(turno.reserva.id)}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function Celda({ turno, modoBloqueo, seleccionado, onLibre, onOcupado }: { turno: TurnoEnAgenda; modoBloqueo: boolean; seleccionado: boolean; onLibre: () => void; onOcupado: () => void }) {
  const r = turno.reserva
  const base = 'grid min-h-[64px] content-start gap-0.5 rounded-xl px-2.5 py-2 text-left text-[13px] leading-tight transition'

  if (!r) {
    if (turno.pasado) {
      return <span role="cell" className={`${base} bg-crema-oscuro/30 text-gris/60`}>Libre</span>
    }
    return (
      <button
        type="button"
        role="cell"
        onClick={onLibre}
        aria-pressed={modoBloqueo ? seleccionado : undefined}
        aria-label={`${turno.hora}, libre. ${modoBloqueo ? 'Elegir para bloquear' : 'Cargar reserva'}`}
        className={`${base} border-[1.5px] border-dashed border-linea text-gris hover:border-noche hover:text-noche aria-pressed:border-solid aria-pressed:border-noche aria-pressed:bg-noche/10 aria-pressed:text-noche`}
      >
        <span className="flex items-center gap-1 font-semibold">
          {modoBloqueo ? (seleccionado ? <Check className="size-3.5" aria-hidden="true" /> : <Ban className="size-3.5" aria-hidden="true" />) : <Plus className="size-3.5" aria-hidden="true" />}
          {modoBloqueo ? (seleccionado ? 'Elegido' : 'Libre') : 'Cargar'}
        </span>
        <span className="text-[11.5px]">{plata(turno.precio)}</span>
      </button>
    )
  }

  const pasado = turno.pasado ? 'opacity-60' : ''
  if (r.estado === 'bloqueada') {
    return (
      <button type="button" role="cell" onClick={onOcupado} className={`${base} bg-[repeating-linear-gradient(135deg,var(--color-crema-oscuro)_0_6px,transparent_6px_12px)] text-gris ring-1 ring-linea ${pasado}`}>
        <b className="text-noche">Bloqueado</b>
        <span className="truncate">{r.motivo_bloqueo}</span>
      </button>
    )
  }
  if (r.estado === 'pendiente_pago') {
    return (
      <button type="button" role="cell" onClick={onOcupado} className={`${base} bg-amber-100 text-amber-950 ring-[1.5px] ring-amber-400 ${pasado}`}>
        <b className="truncate">{r.cliente}</b>
        <span>Pagando · {r.minutos_para_pagar ?? 0} min</span>
      </button>
    )
  }
  const Icono = r.origen === 'web' ? Globe : Phone
  return (
    <button type="button" role="cell" onClick={onOcupado} className={`${base} bg-noche text-crema hover:bg-noche/90 ${pasado}`}>
      <span className="flex items-center gap-1">
        <b className="truncate">{r.cliente}</b>
        <Icono className="ml-auto size-3 flex-none opacity-60" aria-label={r.origen === 'web' ? 'Reservó por la web' : 'Cargada a mano'} />
      </span>
      <span className="text-crema/75">{r.saldo_cobrado ? 'Pagó todo' : `Falta ${plata(r.saldo)}`}</span>
      {r.asistencia && (
        <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${r.asistencia === 'vino' ? 'text-cesped-claro' : 'text-red-300'}`}>
          {r.asistencia === 'vino' ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
          {r.asistencia === 'vino' ? 'Vino' : 'No vino'}
        </span>
      )}
    </button>
  )
}
