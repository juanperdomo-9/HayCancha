import { MessageCircle } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'

import { ErrorApi } from '../../api/client'
import { type ComplejoDetalle, useComplejo, useDisponibilidad } from '../../api/publico'
import { ElegirCancha } from '../../components/complejo/ElegirCancha'
import { GrillaTurnos } from '../../components/complejo/GrillaTurnos'
import { LogoComplejo } from '../../components/complejo/LogoComplejo'
import { MapaComplejo } from '../../components/complejo/MapaComplejo'
import { PortadaComplejo } from '../../components/complejo/PortadaComplejo'
import { ReservaEnCurso } from '../../components/complejo/ReservaEnCurso'
import { TiraDeFechas } from '../../components/complejo/TiraDeFechas'
import { PieComplejo } from '../../components/PieDePagina'
import { TemaComplejo } from '../../theme/TemaComplejo'
import { DIAS_CORTOS, desdeIso, plata } from '../../utils/formato'
import NoEncontrado from './NoEncontrado'
import { BotonModo } from '../../components/BotonModo'

const ENTRADA = [0.2, 0.8, 0.2, 1] as const
const DIAS_EN_LA_TIRA = 14

export default function Complejo() {
  const { slug = '' } = useParams()
  const { data: complejo, isPending, error } = useComplejo(slug)

  if (isPending) return <Cargando />
  if (error) {
    return error instanceof ErrorApi && error.estado === 404 ? (
      <NoEncontrado />
    ) : (
      <div className="grid min-h-dvh place-items-center bg-lienzo p-6 text-center text-tenue">
        No pudimos cargar el complejo. Revisá tu conexión y volvé a intentar.
      </div>
    )
  }
  return <PaginaComplejo complejo={complejo} />
}

function PaginaComplejo({ complejo }: { complejo: ComplejoDetalle }) {
  const [deporte, setDeporte] = useState(complejo.deportes[0]?.codigo)
  const [fecha, setFecha] = useState(complejo.hoy)
  const [inicio, setInicio] = useState<string | null>(null)
  const [canchaId, setCanchaId] = useState<string | null>(null)
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const { data: disponibilidad, isPending } = useDisponibilidad(complejo.slug, deporte, fecha)

  useEffect(() => {
    document.title = `${complejo.nombre} · HayCancha`
  }, [complejo.nombre])

  const deporteActual = complejo.deportes.find((d) => d.codigo === deporte)
  const vigente = disponibilidad?.fecha === fecha && disponibilidad.deporte === deporte
  const turnos = vigente ? disponibilidad.turnos : undefined
  const turno = turnos?.find((t) => t.inicio === inicio && t.libres.length > 0)
  const cancha = turno && (canchaId ? turno.libres.find((c) => c.id === canchaId) : turno.libres[0])

  function limpiarSeleccion() {
    setInicio(null)
    setCanchaId(null)
    setHojaAbierta(false)
  }

  return (
    <TemaComplejo color={complejo.color_primario} secundario={complejo.color_secundario} className="min-h-dvh bg-lienzo text-tinta">
      <header className="border-b border-borde bg-superficie">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
          <span className="flex min-w-0 items-center gap-2.5 font-semibold">
            <LogoComplejo nombre={complejo.nombre} logoUrl={complejo.logo_url} className="w-8 flex-none rounded-lg text-[32px] ring-0" />
            <span className="truncate">{complejo.nombre}</span>
          </span>
          <span className="flex items-center gap-2">
            <a href="#info" className="text-sm font-semibold whitespace-nowrap text-complejo-texto">
              Cómo llegar
            </a>
            <BotonModo className="text-tinta hover:bg-lienzo" />
          </span>
        </div>
      </header>

      <section className="relative isolate overflow-hidden bg-oscuro text-white">
        <PortadaComplejo
          portadaUrl={complejo.portada_url}
          deporte={complejo.deportes[0]?.codigo ?? 'futbol5'}
          animado
          className="absolute inset-0 -z-10"
        />
        <div className="absolute inset-0 -z-10 bg-linear-to-t from-oscuro via-oscuro/60 to-oscuro/10" />
        <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-5 px-4 pt-32 pb-8 sm:px-8 sm:pt-52 sm:pb-10">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: ENTRADA }}>
            <LogoComplejo
              nombre={complejo.nombre}
              logoUrl={complejo.logo_url}
              className="w-20 text-[80px] shadow-[0_10px_24px_rgba(0,0,0,.4)] sm:w-26 sm:text-[104px]"
            />
          </motion.div>
          <motion.div
            className="min-w-0 flex-[1_1_280px]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: ENTRADA, delay: 0.1 }}
          >
            <h1 className="numeros text-[clamp(48px,8.4vw,104px)] leading-[.86] font-extrabold text-balance" style={{ fontStretch: '70%' }}>
              {complejo.nombre}
            </h1>
            {complejo.barrio && <p className="mt-3 text-white/75">{complejo.barrio}</p>}
            <ul className="mt-4 flex flex-wrap gap-2">
              {complejo.deportes.map((d) => (
                <li key={d.codigo} className="rounded-full border border-white/25 bg-superficie/7 px-3 py-1 text-[13px]">
                  <b className="font-semibold">{d.nombre}</b> · {d.canchas.length} {d.canchas.length === 1 ? 'cancha' : 'canchas'} ·
                  turnos de {d.duraciones_min.join(' y ')} min
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl gap-9 px-4 pt-8 pb-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_370px] lg:items-start">
        <section aria-labelledby="reservar" className={`min-w-0 ${turno ? 'max-lg:pb-24' : ''}`}>
          <h2 id="reservar" className="numeros text-[clamp(32px,4vw,42px)] leading-none font-extrabold" style={{ fontStretch: '76%' }}>
            Reservá tu turno
          </h2>
          <p className="mt-1.5 text-tenue">Elegí {complejo.deportes.length > 1 ? 'el deporte, ' : ''}el día y el horario.</p>

          {complejo.deportes.length > 1 && (
            <div className="-mx-0.5 mt-5 flex gap-2 overflow-x-auto p-0.5 [scrollbar-width:none]" aria-label="Deporte">
              {complejo.deportes.map((d) => (
                <button
                  key={d.codigo}
                  type="button"
                  aria-pressed={d.codigo === deporte}
                  onClick={() => {
                    setDeporte(d.codigo)
                    limpiarSeleccion()
                  }}
                  className="grid min-w-[136px] flex-none gap-px rounded-xl border-[1.5px] border-borde bg-superficie px-4 py-2.5 text-left transition-colors hover:border-complejo-linea aria-pressed:border-complejo aria-pressed:bg-complejo-suave aria-pressed:shadow-[inset_0_0_0_1px_var(--complejo)]"
                >
                  <b className="text-[15.5px]">{d.nombre}</b>
                  <span className="text-[12.5px] text-tenue tabular-nums">
                    {d.duraciones_min.join(' y ')} min{d.precio_desde && ` · desde ${plata(d.precio_desde)}`}
                  </span>
                </button>
              ))}
            </div>
          )}

          <TiraDeFechas
            hoy={complejo.hoy}
            dias={Math.min(DIAS_EN_LA_TIRA, complejo.dias_reservables)}
            valor={fecha}
            onCambiar={(nueva) => {
              setFecha(nueva)
              limpiarSeleccion()
            }}
          />

          <div className="mt-5 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-tenue" aria-hidden="true">
            <span>
              <i className="mr-1.5 inline-block h-[5px] w-4 rounded-full bg-complejo align-[2px]" />
              cancha libre
            </span>
            <span>
              <i className="mr-1.5 inline-block h-[5px] w-4 rounded-full bg-borde align-[2px]" />
              cancha ocupada
            </span>
          </div>

          <GrillaTurnos
            key={`${deporte}-${fecha}`}
            turnos={turnos}
            cargando={isPending || !vigente}
            seleccionado={turno?.inicio ?? null}
            onElegir={(nuevo) => {
              setInicio(nuevo === inicio ? null : nuevo)
              setCanchaId(null)
            }}
          />

          {turno && deporteActual && deporteActual.canchas.length > 1 && (
            <ElegirCancha canchas={deporteActual.canchas} turno={turno} elegida={canchaId} onElegir={setCanchaId} />
          )}
        </section>

        <aside className="hidden rounded-[18px] border border-borde bg-superficie p-5.5 shadow-[0_24px_50px_-32px_rgba(20,20,25,.3)] lg:sticky lg:top-6 lg:block">
          {turno && cancha && deporteActual ? (
            <ReservaEnCurso
              slug={complejo.slug}
              turno={turno}
              fecha={fecha}
              deporte={deporteActual}
              cancha={cancha}
              canchaElegida={canchaId !== null}
              reservasOnline={complejo.reservas_online}
              minutosParaPagar={complejo.minutos_para_pagar}
            />
          ) : (
            <SinTurnoElegido complejo={complejo} />
          )}
        </aside>
      </main>

      <section
        id="info"
        className="mx-auto grid max-w-6xl gap-8 border-t border-borde px-4 pt-10 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
      >
        <div className="lg:row-span-2">
          <h3 className="numeros mb-3 text-[23px] font-bold" style={{ fontStretch: '80%' }}>
            Dónde queda
          </h3>
          <MapaComplejo nombre={complejo.nombre} direccion={complejo.direccion} barrio={complejo.barrio} referencia={complejo.referencia} />
          {complejo.whatsapp && (
            <a
              href={`https://wa.me/${complejo.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ring-[1.5px] ring-borde ring-inset hover:ring-tinta"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              Consultar por WhatsApp
            </a>
          )}
        </div>
        {complejo.servicios.length > 0 && (
          <div>
            <h3 className="numeros mb-2 text-[23px] font-bold" style={{ fontStretch: '80%' }}>
              Servicios
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {complejo.servicios.map((s) => (
                <li key={s} className="rounded-full border border-borde bg-superficie px-3 py-1 text-[13.5px]">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h3 className="numeros mb-2 text-[23px] font-bold" style={{ fontStretch: '80%' }}>
            Seña y cancelación
          </h3>
          <p className="mb-2 max-w-[46ch] text-tenue">
            Para reservar pagás una seña {complejo.sena_tipo === 'fija' ? `de ${plata(complejo.sena_valor)}` : `del ${Number(complejo.sena_valor)}% del turno`} con Mercado Pago. El resto lo pagás en la cancha.
          </p>
          <p className="max-w-[46ch] text-tenue">
            Si cancelás con más de {complejo.horas_cancelacion} horas de anticipación, te devolvemos la seña. Con menos, se pierde.
          </p>
        </div>
      </section>

      <PieComplejo nombre={complejo.nombre} direccion={complejo.direccion} barrio={complejo.barrio} referencia={complejo.referencia} />

      {/* En el celular, la reserva sube como una hoja desde abajo. */}
      <AnimatePresence>
        {turno && cancha && deporteActual && (
          <>
            {hojaAbierta && (
              <motion.div
                key="fondo"
                className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setHojaAbierta(false)}
              />
            )}
            <motion.div
              key="hoja"
              className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-[20px] bg-superficie shadow-[0_-14px_40px_-18px_rgba(0,0,0,.35)] lg:hidden"
              initial={{ y: '110%' }}
              animate={{ y: 0 }}
              exit={{ y: '110%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              {hojaAbierta ? (
                <div className="px-4 pt-4 pb-[calc(22px+env(safe-area-inset-bottom))]">
                  <ReservaEnCurso
                    slug={complejo.slug}
                    reservasOnline={complejo.reservas_online}
                    minutosParaPagar={complejo.minutos_para_pagar}
                    turno={turno}
                    fecha={fecha}
                    deporte={deporteActual}
                    cancha={cancha}
                    canchaElegida={canchaId !== null}
                    onCerrar={() => setHojaAbierta(false)}
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                  <div className="min-w-0">
                    <b className="block tabular-nums">
                      {DIAS_CORTOS[desdeIso(fecha).getDay()]} {desdeIso(fecha).getDate()}/{desdeIso(fecha).getMonth() + 1} · {turno.hora}
                    </b>
                    <span className="text-[13px] text-tenue">
                      {deporteActual.nombre} · seña {plata(cancha.sena)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHojaAbierta(true)}
                    className="flex-none rounded-xl bg-complejo px-5 py-3 font-bold text-complejo-sobre"
                  >
                    Continuar
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </TemaComplejo>
  )
}

function textoSena(complejo: ComplejoDetalle): string {
  return complejo.sena_tipo === 'fija' ? plata(complejo.sena_valor) : `el ${Number(complejo.sena_valor)}% del turno`
}

function SinTurnoElegido({ complejo }: { complejo: ComplejoDetalle }) {
  return (
    <div>
      <b className="mb-1 block text-[17px]">Elegí un horario</b>
      <p className="text-tenue">Vas a ver el precio, la seña y a qué cancha vas.</p>
      <p className="mt-4 border-t border-borde pt-3.5 text-[13.5px] text-tenue">
        Seña: {textoSena(complejo)}. Tenés {complejo.minutos_para_pagar} minutos para pagarla con Mercado Pago; si no, el turno se libera.
      </p>
    </div>
  )
}

function Cargando() {
  return (
    <div className="min-h-dvh bg-lienzo" aria-busy="true">
      <div className="h-[52px] border-b border-borde bg-superficie" />
      <div className="h-[300px] animate-pulse bg-oscuro/90 sm:h-[420px]" />
      <div className="mx-auto grid max-w-6xl gap-3 px-4 pt-8 sm:px-8">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-borde" />
        <div className="h-5 w-80 animate-pulse rounded bg-borde/70" />
      </div>
    </div>
  )
}
