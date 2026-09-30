import { Check, Copy } from 'lucide-react'
import { motion } from 'motion/react'
import { type ReactNode, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { ErrorApi, mensaje } from '../../api/client'
import { type ReservaPublica, useReservaPublica, useSimularPago } from '../../api/publico'
import { GestionReserva } from '../../components/complejo/GestionReserva'
import { LogoComplejo } from '../../components/complejo/LogoComplejo'
import { PieComplejo } from '../../components/PieDePagina'
import { TemaComplejo } from '../../theme/TemaComplejo'
import { fechaLarga, plata } from '../../utils/formato'
import NoEncontrado from './NoEncontrado'

/** A dónde vuelve el jugador después de pagar: espera el pago y confirma el turno. */
export default function EstadoReserva() {
  const { slug = '', id = '' } = useParams()
  const { data: reserva, error, isPending } = useReservaPublica(slug, id)

  if (isPending) {
    return (
      <div className="grid min-h-dvh place-items-center bg-lienzo" aria-busy="true">
        <span className="size-8 animate-spin rounded-full border-3 border-borde border-t-tinta" />
      </div>
    )
  }
  if (error) {
    if (error instanceof ErrorApi && error.estado === 404) return <NoEncontrado />
    return <div className="grid min-h-dvh place-items-center bg-lienzo p-6 text-center text-tenue">{mensaje(error)}</div>
  }
  return <Pagina reserva={reserva} />
}

function Pagina({ reserva: r }: { reserva: ReservaPublica }) {
  useEffect(() => {
    document.title = `${r.estado === 'confirmada' ? 'Turno confirmado' : 'Tu reserva'} · ${r.complejo}`
  }, [r.estado, r.complejo])

  return (
    <TemaComplejo color={r.color_primario} secundario={r.color_secundario} className="flex min-h-dvh flex-col bg-lienzo text-tinta">
      <header className="border-b border-borde bg-superficie">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-8">
          <Link to={`/${r.slug}`} className="flex min-w-0 items-center gap-2.5 font-semibold">
            <LogoComplejo nombre={r.complejo} logoUrl={r.logo_url} className="w-8 flex-none rounded-lg text-[32px] ring-0" />
            <span className="truncate">{r.complejo}</span>
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 py-8 sm:py-14">
        <div className="mx-auto max-w-[560px] rounded-[22px] bg-superficie p-6 text-center shadow-[0_30px_60px_-40px_rgba(20,20,25,.35)] ring-1 ring-borde sm:p-9">
          <Sello estado={r.estado} />
          <Contenido r={r} />
          <dl className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 border-y border-borde py-4 text-left tabular-nums">
            {[
              ['Complejo', r.complejo],
              ['Deporte', r.deporte],
              ['Cancha', r.cancha],
              ['Día', fechaLarga(r.fecha)],
              ['Horario', `${r.hora} a ${r.hora_fin}`],
              ['Seña', plata(r.sena)],
              ['En la cancha', plata(r.saldo)],
            ].map(([dt, dd]) => (
              <div key={dt} className="contents">
                <dt className="text-sm text-tenue">{dt}</dt>
                <dd className="m-0 text-right font-semibold">{dd}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            <Link to={`/${r.slug}`} className="rounded-xl px-4 py-3 font-semibold ring-[1.5px] ring-borde ring-inset hover:ring-tinta">
              Volver a {r.complejo}
            </Link>
          </div>
        </div>
      </main>
      <PieComplejo nombre={r.complejo} direccion={r.direccion} barrio={r.barrio} referencia={r.referencia} />
    </TemaComplejo>
  )
}

function Contenido({ r }: { r: ReservaPublica }) {
  if (r.estado === 'pendiente_pago') return <EsperandoPago r={r} />
  if (r.estado === 'confirmada') {
    return (
      <>
        <Pastilla color="bg-complejo">Confirmado</Pastilla>
        <Titulo>¡Listo, {r.jugador}! El turno es tuyo</Titulo>
        <p className="mx-auto max-w-[42ch] text-tenue">
          El resto, <b className="text-tinta">{plata(r.saldo)}</b>, lo pagás en la cancha.
        </p>
        <GuardarLink />
        <GestionReserva r={r} />
      </>
    )
  }
  if (r.estado === 'vencida') {
    return (
      <>
        <Pastilla color="bg-tenue">Vencida</Pastilla>
        <Titulo>Se terminó el tiempo para pagar</Titulo>
        <p className="mx-auto max-w-[42ch] text-tenue">
          El turno se liberó. Si sigue libre, podés reservarlo de nuevo desde la página del complejo.
        </p>
      </>
    )
  }
  return (
    <>
      <Pastilla color="bg-red-600">Cancelada</Pastilla>
      <Titulo>Esta reserva está cancelada</Titulo>
      <p className="mx-auto max-w-[44ch] text-tenue">
        {r.devolucion === 'hecha'
          ? `Te devolvimos ${plata(r.monto_devuelto ?? r.sena)} en el mismo medio con el que pagaste. Según tu banco o tarjeta, puede tardar unos días en verse.`
          : r.devolucion === 'pendiente'
            ? `Estamos devolviéndote ${plata(r.monto_devuelto ?? r.sena)}. No tenés que hacer nada: te avisa Mercado Pago cuando salga.`
            : r.sena_pagada
              ? 'Se canceló fuera del plazo de la política del complejo, así que la seña quedó para el complejo.'
              : 'El turno quedó libre para otro jugador.'}
      </p>
    </>
  )
}

function EsperandoPago({ r }: { r: ReservaPublica }) {
  const simular = useSimularPago(r.slug, r.id)
  const restante = useSegundosHasta(r.vence_a)
  const minutos = Math.floor(restante / 60)
  const segundos = String(restante % 60).padStart(2, '0')
  return (
    <>
      <Pastilla color="bg-amber-500" latiendo>
        Esperando el pago
      </Pastilla>
      <Titulo>Terminá de pagar la seña</Titulo>
      <p className="mx-auto max-w-[42ch] text-tenue">
        Te guardamos el turno{' '}
        <b className="numeros text-lg text-tinta" aria-live="off">
          {minutos}:{segundos}
        </b>{' '}
        minutos. Cuando se acredite el pago, esta página se actualiza sola.
      </p>
      <div className="mt-5 grid justify-center gap-2.5">
        {r.url_pago && (
          <a href={r.url_pago} className="rounded-xl bg-complejo px-6 py-3.5 font-bold text-complejo-sobre hover:brightness-105">
            Pagar {plata(r.sena)} con Mercado Pago
          </a>
        )}
        {r.pago_simulado && (
          <>
            <button
              type="button"
              onClick={() => simular.mutate()}
              disabled={simular.isPending}
              className="rounded-xl bg-complejo px-6 py-3.5 font-bold text-complejo-sobre hover:brightness-105 disabled:opacity-60"
            >
              {simular.isPending ? 'Pagando…' : `Simular pago de ${plata(r.sena)}`}
            </button>
            <span className="text-xs text-tenue">Modo de prueba: no se cobra nada.</span>
          </>
        )}
        {simular.error && <p className="text-sm text-red-700">{mensaje(simular.error)}</p>}
      </div>
    </>
  )
}

/** Segundos que faltan hasta `momento`, actualizados cada segundo. */
function useSegundosHasta(momento: string | null): number {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(reloj)
  }, [])
  return momento ? Math.max(0, Math.floor((new Date(momento).getTime() - ahora) / 1000)) : 0
}

function Titulo({ children }: { children: ReactNode }) {
  return (
    <h1 className="numeros mt-3.5 mb-2.5 text-[clamp(34px,5vw,46px)] leading-[.98] font-extrabold text-balance" style={{ fontStretch: '74%' }}>
      {children}
    </h1>
  )
}

function Pastilla({ color, latiendo = false, children }: { color: string; latiendo?: boolean; children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-lienzo px-3.5 py-1.5 text-[13px] font-semibold ring-1 ring-borde" role="status">
      <span className={`size-2 rounded-full ${color} ${latiendo ? 'motion-safe:animate-pulse' : ''}`} />
      {children}
    </p>
  )
}

/** El círculo de arriba: gira mientras espera y festeja cuando se confirma. */
function Sello({ estado }: { estado: ReservaPublica['estado'] }) {
  const confirmada = estado === 'confirmada'
  const rayos = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2)
  return (
    <svg viewBox="0 0 120 120" className="mx-auto mb-2 block size-32 overflow-visible" aria-hidden="true">
      {confirmada &&
        [42, 54].map((r, i) => (
          <motion.circle
            key={r}
            cx="60"
            cy="60"
            r={r}
            className="fill-none stroke-complejo"
            strokeWidth="2"
            initial={{ opacity: 0.8, scale: 0.7 }}
            animate={{ opacity: 0, scale: 1.6 }}
            transition={{ duration: 1.2, delay: 0.1 + i * 0.18, ease: 'easeOut' }}
            style={{ transformOrigin: '60px 60px' }}
          />
        ))}
      <motion.circle
        cx="60"
        cy="60"
        r="32"
        className={confirmada ? 'fill-complejo' : estado === 'pendiente_pago' ? 'fill-complejo-suave' : 'fill-borde'}
        initial={false}
        animate={{ scale: confirmada ? 1.3 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 14 }}
        style={{ transformOrigin: '60px 60px' }}
      />
      {estado === 'pendiente_pago' && (
        <motion.circle
          cx="60"
          cy="60"
          r="38"
          className="fill-none stroke-complejo"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="46 200"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '60px 60px' }}
        />
      )}
      {confirmada && (
        <>
          <motion.path
            d="M47 61 l9 9 l18 -21"
            className="fill-none stroke-complejo-sobre"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.45, delay: 0.25 }}
          />
          {rayos.map((a) => (
            <motion.line
              key={a}
              x1={60 + Math.cos(a) * 60}
              y1={60 + Math.sin(a) * 60}
              x2={60 + Math.cos(a) * 68}
              y2={60 + Math.sin(a) * 68}
              className="stroke-complejo"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ opacity: 1, x: 0, y: 0 }}
              animate={{ opacity: 0, x: Math.cos(a) * 14, y: Math.sin(a) * 14 }}
              transition={{ duration: 0.75, delay: 0.2, ease: 'easeOut' }}
            />
          ))}
        </>
      )}
      {(estado === 'vencida' || estado === 'cancelada') && (
        <path d="M48 48 L72 72 M72 48 L48 72" className="fill-none stroke-tenue" strokeWidth="6" strokeLinecap="round" />
      )}
    </svg>
  )
}

/** Sin cuenta ni email, el link es la forma de volver a la reserva. */
function GuardarLink() {
  const [copiado, setCopiado] = useState(false)
  const link = window.location.href
  return (
    <div className="mt-5 grid gap-2 rounded-xl bg-lienzo p-3.5 text-left ring-1 ring-borde">
      <span className="text-[13px] font-semibold">Guardá el link de tu reserva</span>
      <div className="flex gap-2">
        <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label="Link de tu reserva" className="w-full min-w-0 rounded-lg bg-superficie px-3 py-2 text-[13px] text-tenue ring-1 ring-borde" />
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link)
              setCopiado(true)
              setTimeout(() => setCopiado(false), 2500)
            } catch {
              setCopiado(false)
            }
          }}
          className="inline-flex flex-none items-center gap-1.5 rounded-lg bg-complejo px-3 py-2 text-sm font-semibold text-complejo-sobre"
        >
          {copiado ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
