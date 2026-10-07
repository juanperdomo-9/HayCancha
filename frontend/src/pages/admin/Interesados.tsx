import { MessageCircle } from 'lucide-react'

import { mensaje } from '../../api/client'
import { type Interesado, useCambiarInteresado, useInteresados } from '../../api/panel'
import { Aviso } from '../../components/ui/Formulario'

const ESTADOS: Record<Interesado['estado'], string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  se_sumo: 'Se sumó',
  no_interesado: 'No le interesó',
}

/** Admin: dueños que dejaron su contacto en "Tengo un complejo". */
export function Interesados() {
  const lista = useInteresados()
  const cambiar = useCambiarInteresado()
  const nuevos = lista.data?.filter((i) => i.estado === 'nuevo').length ?? 0
  return (
    <section className="grid gap-3">
      <h2 className="font-titulo text-[clamp(30px,4.5vw,44px)] leading-[.9] font-extrabold uppercase">
        Interesados {nuevos > 0 && <span className="ml-1 rounded-full bg-cesped px-2.5 py-0.5 align-middle font-sans text-base text-white">{nuevos} nuevos</span>}
      </h2>
      <p className="-mt-1 text-gris">Dueños que dejaron su contacto en la página principal.</p>
      {lista.error && <Aviso>{mensaje(lista.error)}</Aviso>}
      {lista.data?.length === 0 && <p className="text-sm text-gris">Todavía nadie dejó su contacto.</p>}
      <ul className="grid gap-2">
        {lista.data?.map((i) => (
          <li key={i.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-cal p-4 ring-1 ring-linea ${i.estado === 'nuevo' ? 'ring-cesped' : ''}`}>
            <div className="min-w-0 flex-1">
              <b>{i.complejo}</b>
              <span className="text-gris">{i.zona ? ` · ${i.zona}` : ''}</span>
              <p className="text-sm">
                {i.nombre} · {i.whatsapp}
                {i.canchas ? ` · ${i.canchas}` : ''}
              </p>
              <p className="text-xs text-gris">
                {new Date(i.creado_a).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                {i.como_reserva ? ` · Hoy reserva: ${i.como_reserva}` : ''}
              </p>
            </div>
            <a
              href={`https://wa.me/${i.whatsapp.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ring-[1.5px] ring-noche ring-inset hover:bg-noche hover:text-crema"
            >
              <MessageCircle className="size-4" aria-hidden="true" />
              WhatsApp
            </a>
            <select
              value={i.estado}
              disabled={cambiar.isPending}
              onChange={(e) => cambiar.mutate({ id: i.id, estado: e.target.value as Interesado['estado'] })}
              aria-label={`Estado de ${i.complejo}`}
              className="rounded-lg border-[1.5px] border-linea bg-superficie px-2.5 py-1.5 text-sm font-semibold"
            >
              {Object.entries(ESTADOS).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  )
}
