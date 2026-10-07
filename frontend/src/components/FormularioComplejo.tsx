import { CheckCircle2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { enviar, mensaje } from '../api/client'

type Datos = { nombre: string; complejo: string; zona: string; whatsapp: string; canchas: string; como_reserva: string }
const VACIO: Datos = { nombre: '', complejo: '', zona: '', whatsapp: '', canchas: '', como_reserva: '' }

/** "Tengo un complejo": el dueño deja su contacto y lo ve el equipo en /admin. */
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

  if (estado === 'ok') {
    return (
      <div className="grid justify-items-start gap-2 rounded-2xl bg-cal/10 p-6 ring-1 ring-cal/20">
        <CheckCircle2 className="size-8 text-cesped-claro" aria-hidden="true" />
        <b className="text-xl">¡Listo, {datos.nombre.split(' ')[0]}!</b>
        <p className="text-cal/80">Te escribimos por WhatsApp en menos de 24 horas.</p>
      </div>
    )
  }

  const campo = 'w-full rounded-xl bg-cal px-3.5 py-3 text-[16px] text-noche placeholder:text-noche/45 focus:outline-none focus:ring-2 focus:ring-cesped-claro'
  const set = (k: keyof Datos) => (e: { target: { value: string } }) => setDatos({ ...datos, [k]: e.target.value })
  return (
    <form onSubmit={mandar} className="grid gap-3 rounded-2xl bg-cal/10 p-5 ring-1 ring-cal/20 sm:p-6">
      <b className="text-xl">Sumá tu complejo</b>
      <p className="-mt-1 text-sm text-cal/70">Dejanos tus datos y te escribimos. El primer mes es gratis.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required minLength={2} maxLength={120} placeholder="Tu nombre" aria-label="Tu nombre" value={datos.nombre} onChange={set('nombre')} className={campo} />
        <input required minLength={2} maxLength={120} placeholder="Nombre del complejo" aria-label="Nombre del complejo" value={datos.complejo} onChange={set('complejo')} className={campo} />
        <input required minLength={6} maxLength={40} inputMode="tel" placeholder="WhatsApp" aria-label="WhatsApp" value={datos.whatsapp} onChange={set('whatsapp')} className={campo} />
        <input maxLength={200} placeholder="Barrio o zona" aria-label="Barrio o zona" value={datos.zona} onChange={set('zona')} className={campo} />
        <input maxLength={200} placeholder="Canchas (ej. 3 de fútbol 5)" aria-label="Canchas" value={datos.canchas} onChange={set('canchas')} className={campo} />
        <select value={datos.como_reserva} onChange={set('como_reserva')} aria-label="Cómo tomás las reservas hoy" className={campo}>
          <option value="">¿Cómo tomás las reservas hoy?</option>
          <option>Por WhatsApp o teléfono</option>
          <option>Con otro sistema (ATC, Canchero…)</option>
          <option>Otra forma</option>
        </select>
      </div>
      {/* Trampa para bots: oculto para las personas. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={trampa} onChange={(e) => setTrampa(e.target.value)} className="hidden" name="sitio_web" />
      {estado === 'error' && <p className="text-sm text-red-300">{error}</p>}
      <button
        type="submit"
        disabled={estado === 'enviando'}
        className="justify-self-start rounded-full bg-cesped-claro px-6 py-3 font-semibold text-noche transition-transform hover:-translate-y-px disabled:opacity-60"
      >
        {estado === 'enviando' ? 'Enviando…' : 'Quiero sumarme'}
      </button>
    </form>
  )
}
