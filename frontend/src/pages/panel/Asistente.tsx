import { type FormEvent, useState } from 'react'
import { useParams } from 'react-router'

import { useConsultas, useResolverConsulta } from '../../api/asistente'
import { mensaje } from '../../api/client'
import { type Configuracion, useConfiguracion, useGuardarConfiguracion } from '../../api/panel'
import { Aviso, Boton, Campo, Tarjeta } from '../../components/ui/Formulario'
import { EncabezadoSeccion } from './EncabezadoSeccion'

/** Pestaña Asistente: cómo se llama, qué sabe y las preguntas que no supo contestar. */
export default function Asistente() {
  const { slug = '' } = useParams()
  const configuracion = useConfiguracion(slug)
  if (configuracion.error) return <Aviso>{mensaje(configuracion.error)}</Aviso>
  if (!configuracion.data) return <p className="text-gris">Cargando…</p>
  return <FormularioAsistente slug={slug} c={configuracion.data} />
}

function FormularioAsistente({ slug, c }: { slug: string; c: Configuracion }) {
  const guardar = useGuardarConfiguracion(slug)
  const consultas = useConsultas(slug)
  const resolver = useResolverConsulta(slug)
  const [datos, setDatos] = useState({
    activo: c.asistente_activo,
    nombre: c.asistente_nombre ?? '',
    bienvenida: c.asistente_bienvenida ?? '',
    conocimiento: c.asistente_conocimiento ?? '',
  })
  const [ok, setOk] = useState(false)

  function enviar(e: FormEvent) {
    e.preventDefault()
    setOk(false)
    guardar.mutate(
      {
        asistente_activo: datos.activo,
        asistente_nombre: datos.nombre || null,
        asistente_bienvenida: datos.bienvenida || null,
        asistente_conocimiento: datos.conocimiento || null,
      },
      { onSuccess: () => setOk(true) },
    )
  }

  return (
    <form onSubmit={enviar} className="grid gap-6">
      <EncabezadoSeccion
        titulo="Asistente"
        bajada="Un chat en tu página que responde preguntas y deja turnos reservados esperando la seña. Nunca confirma pagos: eso lo hace Mercado Pago."
      />
      <Tarjeta titulo="Cómo se presenta">
        <div className="grid gap-4">
          <label className="flex items-center gap-2.5 font-semibold">
            <input
              type="checkbox"
              checked={datos.activo}
              onChange={(e) => setDatos({ ...datos, activo: e.target.checked })}
              className="size-4 accent-[var(--complejo)]"
            />
            Mostrar el asistente en mi página
          </label>
          <Campo etiqueta="Nombre" placeholder="Rulo" maxLength={40} value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
          <Campo
            etiqueta="Saludo"
            placeholder="¡Hola! Soy Rulo, ¿te busco un turno?"
            maxLength={200}
            value={datos.bienvenida}
            onChange={(e) => setDatos({ ...datos, bienvenida: e.target.value })}
          />
        </div>
      </Tarjeta>
      <Tarjeta
        titulo="Lo que sabe"
        descripcion="Contale todo lo que preguntan los jugadores: reglas, si se puede llevar pelota, estacionamiento, cumpleaños, promos. Lo que no sepa, lo anota abajo para vos."
      >
        <textarea
          value={datos.conocimiento}
          onChange={(e) => setDatos({ ...datos, conocimiento: e.target.value })}
          maxLength={6000}
          rows={10}
          placeholder="Hay estacionamiento gratis en la puerta. Los martes, 2x1 en fútbol 5 antes de las 18. Se pueden festejar cumpleaños con reserva previa."
          className="w-full rounded-xl border-[1.5px] border-linea bg-superficie p-3 text-[16px] text-noche focus:border-cesped focus:outline-none"
        />
        <p className="mt-1 text-right text-xs text-gris">{datos.conocimiento.length}/6000</p>
      </Tarjeta>
      {guardar.error && <Aviso>{mensaje(guardar.error)}</Aviso>}
      {ok && <Aviso tipo="ok">Listo, el asistente ya usa estos datos.</Aviso>}
      <Boton type="submit" cargando={guardar.isPending} className="justify-self-start">
        Guardar
      </Boton>

      <Tarjeta titulo="Preguntas sin responder" descripcion="Lo que te preguntaron y el asistente no supo. Sumá la respuesta en «Lo que sabe» y marcala como respondida.">
        {consultas.data?.length ? (
          <ul className="grid gap-2">
            {consultas.data.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 rounded-xl bg-superficie px-3.5 py-2.5 ring-1 ring-linea">
                <span>{q.pregunta}</span>
                <Boton variante="suave" className="flex-none" onClick={() => resolver.mutate(q.id)}>
                  Respondida
                </Boton>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gris">No hay preguntas pendientes.</p>
        )}
      </Tarjeta>
    </form>
  )
}
