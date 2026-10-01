import { ArrowUp, MessageCircle, X } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'

import { mensaje } from '../../api/client'
import { type MensajeDelChat, type RespuestaDelComplejo, useCharlarConComplejo } from '../../api/asistente'
import { plata } from '../../utils/formato'

/** El asistente de IA del complejo: una burbuja abajo a la derecha que abre el chat. */
export function ChatComplejo({ slug, nombre, bienvenida }: { slug: string; nombre: string; bienvenida: string }) {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<MensajeDelChat[]>([])
  const [ultima, setUltima] = useState<RespuestaDelComplejo | null>(null)
  const [texto, setTexto] = useState('')
  const charlar = useCharlarConComplejo(slug)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const limpio = texto.trim()
    if (!limpio || charlar.isPending) return
    const nuevos: MensajeDelChat[] = [...mensajes, { rol: 'usuario', texto: limpio }]
    setMensajes(nuevos)
    setTexto('')
    charlar.mutate(nuevos, {
      onSuccess: (r) => {
        setMensajes([...nuevos, { rol: 'asistente', texto: r.respuesta }])
        setUltima(r)
      },
    })
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-complejo px-4 py-3 font-semibold text-complejo-sobre shadow-lg sm:right-6 sm:bottom-6"
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        Preguntale a {nombre}
      </button>
    )
  }

  return (
    <div
      role="dialog"
      aria-label={`Chat con ${nombre}`}
      className="fixed inset-x-2 bottom-2 z-40 flex max-h-[80dvh] flex-col overflow-hidden rounded-2xl bg-superficie shadow-2xl ring-1 ring-borde sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px]"
    >
      <div className="flex items-center justify-between bg-complejo px-4 py-3 text-complejo-sobre">
        <b>{nombre}</b>
        <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="grid size-8 place-items-center rounded-full hover:bg-black/10">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="grid flex-1 content-start gap-2 overflow-y-auto p-3" aria-live="polite">
        <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-lienzo px-3.5 py-2 text-[15px] text-tinta">{bienvenida}</p>
        {mensajes.map((m, i) => (
          <p
            key={i}
            className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] whitespace-pre-line ${m.rol === 'usuario' ? 'justify-self-end rounded-br-md bg-complejo text-complejo-sobre' : 'rounded-bl-md bg-lienzo text-tinta'}`}
          >
            {m.texto}
          </p>
        ))}
        {charlar.isPending && <p className="rounded-2xl bg-lienzo px-3.5 py-2 text-[15px] text-tenue">Escribiendo…</p>}
        {charlar.error && <p className="text-sm text-red-700">{mensaje(charlar.error)}</p>}
        {ultima?.reserva && (
          <a href={ultima.reserva.url_pago ?? ultima.reserva.link} className="rounded-xl bg-complejo px-4 py-3 text-center font-bold text-complejo-sobre">
            Pagar la seña y confirmar
          </a>
        )}
        {ultima && !ultima.reserva && ultima.turnos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {ultima.turnos.slice(0, 8).map((t) => (
              <Link
                key={`${t.cancha}-${t.fecha}-${t.hora}`}
                to={`/${slug}?deporte=${t.deporte_codigo}&fecha=${t.fecha}`}
                onClick={() => setAbierto(false)}
                className="rounded-full bg-complejo-suave px-3 py-1.5 text-sm font-semibold text-complejo-texto"
              >
                {t.hora} · {plata(t.precio)}
              </Link>
            ))}
          </div>
        )}
      </div>
      <form onSubmit={enviar} className="flex gap-2 border-t border-borde p-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={600}
          placeholder="Escribí tu pregunta"
          aria-label="Tu pregunta"
          className="min-w-0 flex-1 rounded-xl bg-lienzo px-3 py-2 text-[16px] text-tinta focus:outline-none"
        />
        <button
          type="submit"
          disabled={!texto.trim() || charlar.isPending}
          aria-label="Enviar"
          className="grid size-10 place-items-center rounded-xl bg-complejo text-complejo-sobre disabled:opacity-40"
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}
