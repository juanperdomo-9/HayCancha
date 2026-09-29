import { Ban, CalendarDays, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router'

import { type CanchaEnAgenda, type TurnoEnAgenda, claveTurno, useAgenda, useBloquear, useSemana } from '../../api/agenda'
import { mensaje } from '../../api/client'
import { usePanel } from '../../api/panel'
import { CargarReserva } from '../../components/agenda/CargarReserva'
import { DetalleReserva } from '../../components/agenda/DetalleReserva'
import { GrillaAgenda } from '../../components/agenda/GrillaAgenda'
import { VistaSemana } from '../../components/agenda/VistaSemana'
import { Aviso, Boton } from '../../components/ui/Formulario'
import { Hoja } from '../../components/ui/Hoja'
import { aIso, desdeIso, fechaLarga, plata, sumarDias } from '../../utils/formato'

/** La pantalla principal del panel: los turnos del día, cancha por cancha. */
export default function Agenda() {
  const { slug = '' } = useParams()
  const { data: panel } = usePanel(slug)
  const [fechaElegida, setFechaElegida] = useState<string | null>(null)
  const [vista, setVista] = useState<'dia' | 'semana'>('dia')
  const agenda = useAgenda(slug, fechaElegida)
  const fecha = fechaElegida ?? agenda.data?.fecha ?? null
  const semana = useSemana(slug, fecha, vista === 'semana')

  const [deporte, setDeporte] = useState<string | null>(null)
  const [libre, setLibre] = useState<{ cancha: CanchaEnAgenda; turno: TurnoEnAgenda } | null>(null)
  const [reservaId, setReservaId] = useState<string | null>(null)
  const [modoBloqueo, setModoBloqueo] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [motivo, setMotivo] = useState('')
  const [avisoBloqueo, setAvisoBloqueo] = useState<string | null>(null)
  const bloquear = useBloquear(slug)

  const cerrarLibre = useCallback(() => setLibre(null), [])
  const cerrarDetalle = useCallback(() => setReservaId(null), [])

  function moverFecha(dias: number) {
    if (!fecha) return
    setFechaElegida(aIso(sumarDias(desdeIso(fecha), dias)))
    setSeleccionados(new Set())
  }

  function salirDeBloqueo() {
    setModoBloqueo(false)
    setSeleccionados(new Set())
    setMotivo('')
  }

  function alternar(clave: string) {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(clave)) nuevo.delete(clave)
      else nuevo.add(clave)
      return nuevo
    })
  }

  function todoElDia(cancha: CanchaEnAgenda) {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual)
      cancha.turnos.filter((t) => !t.reserva && !t.pasado).forEach((t) => nuevo.add(claveTurno(cancha.id, t.inicio)))
      return nuevo
    })
  }

  function confirmarBloqueo() {
    const turnos = [...seleccionados].map((clave) => {
      const [recurso_id, inicio] = clave.split('|')
      return { recurso_id, inicio }
    })
    bloquear.mutate(
      { turnos, motivo },
      {
        onSuccess: (r) => {
          setAvisoBloqueo(
            `Bloqueamos ${r.bloqueados} ${r.bloqueados === 1 ? 'turno' : 'turnos'}` +
              (r.omitidos ? `. ${r.omitidos} ya estaban ocupados y quedaron como estaban.` : '.'),
          )
          salirDeBloqueo()
        },
      },
    )
  }

  const datos = agenda.data
  const deportes = [...new Map(datos?.canchas.map((c) => [c.deporte, c.deporte_nombre])).entries()]
  const visibles = datos?.canchas.filter((c) => !deporte || c.deporte === deporte) ?? []
  const grupos = [...new Map(visibles.map((c) => [c.deporte, c.deporte_nombre])).entries()].map(([codigo, nombre]) => ({
    codigo,
    nombre,
    canchas: visibles.filter((c) => c.deporte === codigo),
  }))
  const esHoy = datos && fecha === datos.hoy

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] gap-5 ${modoBloqueo ? 'pb-40' : ''}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-titulo text-[clamp(40px,6vw,60px)] leading-[.9] font-extrabold uppercase">Agenda</h1>
          <p className="mt-1.5 font-semibold">{fecha ? `${esHoy ? 'Hoy, ' : ''}${fechaLarga(fecha).replace(/^./, (l) => (esHoy ? l.toLowerCase() : l))}` : ' '}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl bg-cal ring-1 ring-linea">
            <button type="button" onClick={() => moverFecha(vista === 'semana' ? -7 : -1)} aria-label="Anterior" className="grid size-10 place-items-center rounded-l-xl hover:bg-crema-oscuro">
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setFechaElegida(null)} className="px-3 text-sm font-semibold hover:underline">
              Hoy
            </button>
            <input
              type="date"
              aria-label="Elegir fecha"
              value={fecha ?? ''}
              onChange={(e) => e.target.value && setFechaElegida(e.target.value)}
              className="w-[42px] cursor-pointer bg-transparent text-transparent [color-scheme:light] sm:w-auto sm:px-1 sm:text-sm sm:text-noche"
            />
            <button type="button" onClick={() => moverFecha(vista === 'semana' ? 7 : 1)} aria-label="Siguiente" className="grid size-10 place-items-center rounded-r-xl hover:bg-crema-oscuro">
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex rounded-xl bg-cal p-1 ring-1 ring-linea" role="group" aria-label="Vista">
            {(
              [
                ['dia', 'Día', LayoutGrid],
                ['semana', 'Semana', CalendarDays],
              ] as const
            ).map(([valor, texto, Icono]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={vista === valor}
                onClick={() => setVista(valor)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold aria-pressed:bg-noche aria-pressed:text-crema"
              >
                <Icono className="size-4" aria-hidden="true" />
                {texto}
              </button>
            ))}
          </div>
        </div>
      </div>

      {agenda.error && <Aviso>{mensaje(agenda.error)}</Aviso>}
      {avisoBloqueo && <Aviso tipo="ok">{avisoBloqueo}</Aviso>}

      {vista === 'semana' ? (
        semana.data ? (
          <VistaSemana
            dias={semana.data}
            hoy={datos?.hoy}
            onElegir={(dia) => {
              setFechaElegida(dia)
              setVista('dia')
            }}
          />
        ) : (
          <p className="text-gris">Cargando…</p>
        )
      ) : !datos ? (
        <p className="text-gris">Cargando…</p>
      ) : datos.canchas.length === 0 ? (
        <Aviso tipo="info">
          Todavía no hay canchas.{' '}
          {panel?.rol !== 'empleado' && (
            <Link to={`/panel/${slug}/canchas`} className="font-semibold underline">
              Cargá la primera
            </Link>
          )}
        </Aviso>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ['Ocupados', String(datos.resumen.ocupados)],
              ['Libres', String(datos.resumen.libres)],
              ['Bloqueados', String(datos.resumen.bloqueados)],
              ['Señas cobradas', plata(datos.resumen.senas_cobradas)],
              ['Falta cobrar en la cancha', plata(datos.resumen.saldo_por_cobrar)],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="rounded-xl bg-cal px-3.5 py-2.5 ring-1 ring-linea">
                <span className="block text-xs text-gris">{etiqueta}</span>
                <b className="numeros text-2xl leading-tight">{valor}</b>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {deportes.length > 1 ? (
              <div className="flex flex-wrap gap-1.5" aria-label="Filtrar por deporte">
                {[[null, 'Todos'] as const, ...deportes].map(([codigo, nombre]) => (
                  <button
                    key={codigo ?? 'todos'}
                    type="button"
                    aria-pressed={deporte === codigo}
                    onClick={() => setDeporte(codigo)}
                    className="rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold ring-1 ring-linea aria-pressed:bg-noche aria-pressed:text-crema aria-pressed:ring-noche"
                  >
                    {nombre}
                  </button>
                ))}
              </div>
            ) : (
              <span />
            )}
            {!modoBloqueo && (
              <Boton variante="secundario" onClick={() => { setModoBloqueo(true); setAvisoBloqueo(null) }}>
                <Ban className="size-4" aria-hidden="true" />
                Bloquear horarios
              </Boton>
            )}
          </div>

          {modoBloqueo && (
            <Aviso tipo="info">Tocá los turnos libres que querés cerrar (o "Todo el día" en una cancha) y poné el motivo abajo.</Aviso>
          )}

          <div className={`grid grid-cols-[minmax(0,1fr)] gap-7 transition-opacity ${agenda.isPlaceholderData ? 'opacity-60' : ''}`}>
            {grupos.map((g) => (
              <GrillaAgenda
                key={g.codigo}
                titulo={g.nombre}
                canchas={g.canchas}
                modoBloqueo={modoBloqueo}
                seleccionados={seleccionados}
                onElegirLibre={(cancha, turno) => setLibre({ cancha, turno })}
                onElegirOcupado={setReservaId}
                onAlternarSeleccion={alternar}
                onSeleccionarDia={todoElDia}
              />
            ))}
          </div>
          <p className="text-xs text-gris">Se actualiza sola cada 30 segundos.</p>
        </>
      )}

      {modoBloqueo && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-linea bg-cal/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2.5">
            <b className="tabular-nums">
              {seleccionados.size} {seleccionados.size === 1 ? 'turno elegido' : 'turnos elegidos'}
            </b>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Motivo: torneo, lluvia, mantenimiento…"
              aria-label="Motivo del bloqueo"
              className="min-w-0 flex-1 rounded-[10px] border-[1.5px] border-linea bg-white px-3 py-2 text-[16px]"
            />
            <Boton disabled={!seleccionados.size || !motivo.trim()} cargando={bloquear.isPending} onClick={confirmarBloqueo}>
              Bloquear
            </Boton>
            <Boton variante="suave" onClick={salirDeBloqueo}>
              Cancelar
            </Boton>
            {bloquear.error && <p className="w-full text-sm text-red-700">{mensaje(bloquear.error)}</p>}
          </div>
        </div>
      )}

      <Hoja abierta={Boolean(libre)} titulo="Cargar reserva" onCerrar={cerrarLibre}>
        {libre && fecha && <CargarReserva slug={slug} fecha={fecha} cancha={libre.cancha} turno={libre.turno} onListo={cerrarLibre} />}
      </Hoja>
      <Hoja abierta={Boolean(reservaId)} titulo="Reserva" onCerrar={cerrarDetalle}>
        {reservaId && <DetalleReserva slug={slug} reservaId={reservaId} agenda={datos} onListo={cerrarDetalle} />}
      </Hoja>
    </div>
  )
}
