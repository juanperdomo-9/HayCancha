import { ArrowUp, Sparkles } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { VIA_HAYCANCHA } from '../utils/llegada'

import { mensaje } from '../api/client'
import { type MensajeDelChat, type ResultadoBusqueda, useBuscarConIA } from '../api/asistente'
import { fechaLarga, plata } from '../utils/formato'

const EJEMPLOS = ['Fútbol 5 hoy a las 19 en La Plata, techada', 'Pádel mañana a la tarde', '¿Hay fútbol 7 el sábado a la noche?']

/** El buscador con IA de la página principal: se le escribe como en un chat. */
export function BuscadorIA() {
  const [mensajes, setMensajes] = useState<MensajeDelChat[]>([])
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([])
  const [texto, setTexto] = useState('')
  const buscar = useBuscarConIA()
  const final = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mensajes.length) final.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [mensajes.length, resultados.length])

  function enviar(contenido: string) {
    const limpio = contenido.trim()
    if (!limpio || buscar.isPending) return
    const nuevos: MensajeDelChat[] = [...mensajes, { rol: 'usuario', texto: limpio }]
    setMensajes(nuevos)
    setTexto('')
    buscar.mutate(nuevos, {
      onSuccess: (r) => {
        // Por si el modelo igual usa formato (negritas con asteriscos), se muestra texto plano.
        setMensajes([...nuevos, { rol: 'asistente', texto: r.respuesta.replace(/\*\*|__|`/g, '') }])
        setResultados(r.resultados)
      },
    })
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault()
    enviar(texto)
  }

  return (
    <div className="grid gap-4">
      {mensajes.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {EJEMPLOS.map((ejemplo) => (
            <button key={ejemplo} type="button" onClick={() => enviar(ejemplo)} className="rounded-full bg-cal px-3.5 py-2 text-sm ring-1 ring-linea hover:ring-noche">
              {ejemplo}
            </button>
          ))}
        </div>
      )}

      {mensajes.length > 0 && (
        <div className="grid gap-2.5" aria-live="polite">
          {mensajes.map((m, i) => (
            <p
              key={i}
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[15px] whitespace-pre-line ${m.rol === 'usuario' ? 'justify-self-end rounded-br-md bg-noche text-crema' : 'justify-self-start rounded-bl-md bg-cal ring-1 ring-linea'}`}
            >
              {m.texto}
            </p>
          ))}
          {buscar.isPending && (
            <p className="justify-self-start rounded-2xl rounded-bl-md bg-cal px-4 py-2.5 text-[15px] text-gris ring-1 ring-linea">Buscando canchas…</p>
          )}
          {buscar.error && <p className="justify-self-start rounded-2xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">{mensaje(buscar.error)}</p>}
        </div>
      )}

      <AnimatePresence>
        {resultados.length > 0 && (
          <motion.ul initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {resultados.map((r) => (
              <li key={`${r.slug}-${r.cancha}-${r.fecha}-${r.hora}`}>
                <Link
                  to={`/${r.slug}?deporte=${r.deporte_codigo}&fecha=${r.fecha}&${VIA_HAYCANCHA}`}
                  className="grid gap-1 rounded-2xl bg-superficie p-4 ring-1 ring-linea transition hover:-translate-y-px hover:ring-noche"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="numeros text-3xl leading-none font-extrabold" style={{ fontStretch: '74%' }}>
                      {r.hora}
                    </b>
                    <span className="font-semibold">{plata(r.precio)}</span>
                  </span>
                  <b className="mt-1 truncate">{r.complejo}</b>
                  <span className="truncate text-sm text-gris">{[r.deporte, r.cancha, r.caracteristicas].filter(Boolean).join(' · ')}</span>
                  <span className="text-sm text-gris">
                    {fechaLarga(r.fecha)}
                    {r.barrio && ` · ${r.barrio}`}
                  </span>
                  <span className="mt-1.5 text-sm font-semibold text-cesped">Reservar →</span>
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      <form onSubmit={alEnviar} className="flex items-center gap-2 rounded-2xl bg-superficie p-2 pl-4 ring-1 ring-linea focus-within:ring-2 focus-within:ring-cesped">
        <Sparkles className="size-5 flex-none text-cesped" aria-hidden="true" />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={600}
          placeholder={mensajes.length ? '¿Y a otra hora? ¿Otro día?' : 'Contame qué cancha buscás'}
          aria-label="Qué cancha buscás"
          className="min-w-0 flex-1 bg-transparent py-2 text-[16px] text-noche placeholder:text-gris focus:outline-none"
        />
        <button
          type="submit"
          disabled={!texto.trim() || buscar.isPending}
          aria-label="Buscar"
          className="grid size-10 flex-none place-items-center rounded-xl bg-cesped text-white disabled:opacity-40"
        >
          <ArrowUp className="size-5" aria-hidden="true" />
        </button>
      </form>
      {mensajes.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setMensajes([])
            setResultados([])
            buscar.reset()
          }}
          className="justify-self-start text-sm text-gris underline underline-offset-3 hover:text-noche"
        >
          Empezar otra búsqueda
        </button>
      )}
      <div ref={final} />
    </div>
  )
}
