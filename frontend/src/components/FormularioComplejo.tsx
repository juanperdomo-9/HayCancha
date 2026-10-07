import { ArrowRight, CalendarCheck, CheckCircle2, Gift, Wrench } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type FormEvent, type ReactNode, useState } from 'react'

import { enviar, mensaje } from '../api/client'

type Datos = { nombre: string; complejo: string; zona: string; whatsapp: string; canchas: string; como_reserva: string }
const VACIO: Datos = { nombre: '', complejo: '', zona: '', whatsapp: '', canchas: '', como_reserva: '' }

const COMO_RESERVA = ['WhatsApp o teléfono', 'Otro sistema', 'Otra forma']

const BENEFICIOS = [
  { icono: Gift, titulo: 'El primer mes es gratis', texto: 'Probalo con tus canchas y tus jugadores. Después decidís.' },
  { icono: Wrench, titulo: 'Te dejamos todo configurado', texto: 'Cargamos canchas, horarios y precios por vos.' },
  { icono: CalendarCheck, titulo: 'Reservas con seña, solas', texto: 'Los jugadores pagan la seña con Mercado Pago y el turno queda en tu agenda.' },
]

/** "Tengo un complejo": el dueño deja su contacto y el equipo lo ve en /admin. */
export function FormularioComplejo() {
  const [datos, setDatos] = useState<Datos>(VACIO)
  const [trampa, setTrampa] = useState('')
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'ok' | 'error'>('listo')
  const [error, setError] = useState('')

  async function mandar(e: FormEvent) {
    e.preventDefault()
    setEstado('enviando')
    try {
      await enviar('/publico/interesados', 'POST', { ...datos, sitio_web: trampa || null })
      setEstado('ok')
    } catch (falla) {
      setError(mensaje(falla))
      setEstado('error')
    }
  }

  const set = (k: keyof Datos) => (e: { target: { value: string } }) => setDatos({ ...datos, [k]: e.target.value })

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-14">
      <div>
        <p className="text-xs font-semibold tracking-[.12em] text-cesped-claro uppercase">Sumá tu complejo</p>
        <h3 className="mt-2 font-titulo text-[clamp(34px,5vw,56px)] leading-[.92] font-extrabold uppercase">Empezá a recibir reservas este mes</h3>
        <ul className="mt-7 grid gap-5">
          {BENEFICIOS.map(({ icono: Icono, titulo, texto }) => (
            <li key={titulo} className="flex gap-3.5">
              <span className="grid size-10 flex-none place-items-center rounded-xl bg-cesped-claro/15 text-cesped-claro">
                <Icono className="size-5" aria-hidden="true" />
              </span>
              <span>
                <b className="block">{titulo}</b>
                <span className="text-cal/70">{texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[22px] bg-[#F6F1E6] p-5 text-[#14231A] shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)] sm:p-7">
        <AnimatePresence mode="wait" initial={false}>
          {estado === 'ok' ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="grid min-h-[360px] content-center justify-items-center gap-3 text-center"
            >
              <CheckCircle2 className="size-14 text-[#1E7A3E]" aria-hidden="true" />
              <b className="font-titulo text-4xl uppercase">¡Listo, {datos.nombre.split(' ')[0]}!</b>
              <p className="max-w-[30ch] text-[#5d6660]">
                Te escribimos por WhatsApp al <b className="text-[#14231A]">{datos.whatsapp}</b> en menos de 24 horas.
              </p>
            </motion.div>
          ) : (
            <motion.form key="form" onSubmit={mandar} exit={{ opacity: 0 }} className="grid gap-4">
              <div>
                <b className="text-xl">Dejanos tus datos</b>
                <p className="text-sm text-[#5d6660]">Te contactamos nosotros. Son 30 segundos.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo etiqueta="Tu nombre">
                  <input required minLength={2} maxLength={120} autoComplete="name" placeholder="Juan Pérez" value={datos.nombre} onChange={set('nombre')} />
                </Campo>
                <Campo etiqueta="WhatsApp">
                  <input required minLength={6} maxLength={40} type="tel" autoComplete="tel" placeholder="221 555 1234" value={datos.whatsapp} onChange={set('whatsapp')} />
                </Campo>
                <Campo etiqueta="Nombre del complejo">
                  <input required minLength={2} maxLength={120} placeholder="El Potrero" value={datos.complejo} onChange={set('complejo')} />
                </Campo>
                <Campo etiqueta="Barrio o zona" opcional>
                  <input maxLength={200} placeholder="City Bell" value={datos.zona} onChange={set('zona')} />
                </Campo>
              </div>
              <Campo etiqueta="Canchas" opcional>
                <input maxLength={200} placeholder="Ej. 3 de fútbol 5 y 1 de pádel" value={datos.canchas} onChange={set('canchas')} />
              </Campo>
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-[13px] font-semibold">
                  ¿Cómo tomás las reservas hoy? <span className="font-normal text-[#5d6660]">(opcional)</span>
                </legend>
                <div className="flex flex-wrap gap-2">
                  {COMO_RESERVA.map((opcion) => (
                    <button
                      key={opcion}
                      type="button"
                      aria-pressed={datos.como_reserva === opcion}
                      onClick={() => setDatos({ ...datos, como_reserva: datos.como_reserva === opcion ? '' : opcion })}
                      className="rounded-full px-3.5 py-2 text-sm font-semibold ring-[1.5px] ring-[#E6DAC2] transition-colors ring-inset hover:ring-[#14231A] aria-pressed:bg-[#14231A] aria-pressed:text-[#F6F1E6] aria-pressed:ring-[#14231A]"
                    >
                      {opcion}
                    </button>
                  ))}
                </div>
              </fieldset>
              {/* Trampa para bots: oculto para las personas. */}
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={trampa} onChange={(e) => setTrampa(e.target.value)} className="hidden" name="sitio_web" />
              {estado === 'error' && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
              <button
                type="submit"
                disabled={estado === 'enviando'}
                className="group mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E7A3E] px-6 py-3.5 text-[17px] font-bold text-white transition hover:bg-[#1E7A3E]/90 disabled:opacity-60"
              >
                {estado === 'enviando' ? 'Enviando…' : 'Quiero sumarme'}
                <ArrowRight className="size-5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
              <p className="text-center text-xs text-[#5d6660]">Sin compromiso. No compartimos tus datos.</p>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Campo({ etiqueta, opcional, children }: { etiqueta: string; opcional?: boolean; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-[13px] font-semibold [&_input]:w-full [&_input]:rounded-xl [&_input]:border-[1.5px] [&_input]:border-[#E6DAC2] [&_input]:bg-white [&_input]:px-3.5 [&_input]:py-3 [&_input]:text-[16px] [&_input]:font-normal [&_input]:text-[#14231A] [&_input]:placeholder:text-[#14231A]/35 [&_input]:focus:border-[#1E7A3E] [&_input]:focus:outline-none">
      <span>
        {etiqueta} {opcional && <span className="font-normal text-[#5d6660]">(opcional)</span>}
      </span>
      {children}
    </label>
  )
}
