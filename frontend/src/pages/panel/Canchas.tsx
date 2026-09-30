import { Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router'

import { mensaje } from '../../api/client'
import { type CanchaPanel, useCambiarCancha, useCanchas, useCrearCancha, useDeportes } from '../../api/panel'
import { Aviso, Boton, Campo, Tarjeta } from '../../components/ui/Formulario'
import { EncabezadoSeccion } from './EncabezadoSeccion'

export default function Canchas() {
  const { slug = '' } = useParams()
  const canchas = useCanchas(slug)
  const deportes = useDeportes(slug)
  const crear = useCrearCancha(slug)
  const [nueva, setNueva] = useState({ nombre: '', deporte: 'futbol5', caracteristicas: '' })

  function agregar(e: FormEvent) {
    e.preventDefault()
    crear.mutate(
      { nombre: nueva.nombre, deporte: nueva.deporte, caracteristicas: nueva.caracteristicas || undefined },
      { onSuccess: () => setNueva({ ...nueva, nombre: '', caracteristicas: '' }) },
    )
  }

  const porDeporte = new Map<string, CanchaPanel[]>()
  canchas.data?.forEach((c) => porDeporte.set(c.deporte_nombre, [...(porDeporte.get(c.deporte_nombre) ?? []), c]))

  return (
    <div className="grid gap-6">
      <EncabezadoSeccion titulo="Canchas" bajada="Cada cancha con su deporte. Las que desactivás dejan de aparecer en tu página." />
      {canchas.error && <Aviso>{mensaje(canchas.error)}</Aviso>}

      <Tarjeta titulo="Agregar una cancha">
        <form onSubmit={agregar} className="grid gap-3 sm:grid-cols-[1fr_180px_1fr_auto] sm:items-end">
          <Campo
            etiqueta="Nombre"
            placeholder="Cancha 1"
            required
            value={nueva.nombre}
            onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
          />
          <div className="grid gap-1.5">
            <label htmlFor="deporte-nueva" className="text-[13px] font-semibold">
              Deporte
            </label>
            <select
              id="deporte-nueva"
              value={nueva.deporte}
              onChange={(e) => setNueva({ ...nueva, deporte: e.target.value })}
              className="rounded-[10px] border-[1.5px] border-linea bg-superficie px-3 py-[11px] text-[16px]"
            >
              {deportes.data?.map((d) => (
                <option key={d.codigo} value={d.codigo}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
          <Campo
            etiqueta="Características"
            placeholder="Sintético, techada"
            value={nueva.caracteristicas}
            onChange={(e) => setNueva({ ...nueva, caracteristicas: e.target.value })}
          />
          <Boton type="submit" cargando={crear.isPending}>
            <Plus className="size-4" aria-hidden="true" />
            Agregar
          </Boton>
        </form>
        {crear.error && (
          <div className="mt-3">
            <Aviso>{mensaje(crear.error)}</Aviso>
          </div>
        )}
      </Tarjeta>

      {canchas.data && canchas.data.length === 0 && (
        <Aviso tipo="info">Todavía no hay canchas. Agregá la primera arriba.</Aviso>
      )}
      {[...porDeporte.entries()].map(([deporte, lista]) => (
        <Tarjeta key={deporte} titulo={deporte} descripcion={`${lista.length} ${lista.length === 1 ? 'cancha' : 'canchas'}`}>
          <ul className="divide-y divide-linea">
            {lista.map((cancha) => (
              <FilaCancha key={cancha.id} slug={slug} cancha={cancha} />
            ))}
          </ul>
        </Tarjeta>
      ))}

      {canchas.data && canchas.data.length > 0 && (
        <Link to={`/panel/${slug}/horarios`} className="justify-self-start font-semibold text-complejo-texto underline underline-offset-3">
          Siguiente: horarios y precios →
        </Link>
      )}
    </div>
  )
}

function FilaCancha({ slug, cancha }: { slug: string; cancha: CanchaPanel }) {
  const cambiar = useCambiarCancha(slug)
  const [editando, setEditando] = useState(false)
  const [datos, setDatos] = useState({ nombre: cancha.nombre, caracteristicas: cancha.caracteristicas ?? '' })

  if (editando) {
    return (
      <li className="grid gap-3 py-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
        <Campo etiqueta="Nombre" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
        <Campo
          etiqueta="Características"
          value={datos.caracteristicas}
          onChange={(e) => setDatos({ ...datos, caracteristicas: e.target.value })}
        />
        <Boton
          cargando={cambiar.isPending}
          onClick={() =>
            cambiar.mutate(
              { id: cancha.id, nombre: datos.nombre, caracteristicas: datos.caracteristicas || null },
              { onSuccess: () => setEditando(false) },
            )
          }
        >
          Guardar
        </Boton>
        <Boton variante="suave" onClick={() => setEditando(false)}>
          Cancelar
        </Boton>
        {cambiar.error && (
          <div className="sm:col-span-4">
            <Aviso>{mensaje(cambiar.error)}</Aviso>
          </div>
        )}
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <b className={cancha.activo ? '' : 'text-gris line-through'}>{cancha.nombre}</b>
        <span className="ml-2 text-sm text-gris">{cancha.caracteristicas}</span>
        {!cancha.activo && <span className="ml-2 rounded-md bg-crema-oscuro px-2 py-0.5 text-xs font-semibold">Desactivada</span>}
      </div>
      <Boton variante="suave" onClick={() => setEditando(true)}>
        Editar
      </Boton>
      <Boton
        variante={cancha.activo ? 'peligro' : 'secundario'}
        cargando={cambiar.isPending}
        onClick={() => cambiar.mutate({ id: cancha.id, activo: !cancha.activo })}
      >
        {cancha.activo ? 'Desactivar' : 'Activar'}
      </Boton>
    </li>
  )
}
