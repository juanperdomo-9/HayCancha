import { Cake, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router'

import { mensaje } from '../../api/client'
import {
  type CanchaPanel,
  type FranjaCumpleanos,
  type ReservaQueSePisa,
  useAdicionales,
  useCambiarAdicional,
  useCambiarCumpleanos,
  useCambiarCancha,
  useCambiarPartes,
  useCanchas,
  useCrearAdicional,
  useCrearCumpleanos,
  useCumpleanos,
  useCrearCancha,
  useDeportes,
  useQuitarAdicional,
  useQuitarCumpleanos,
} from '../../api/panel'
import { Aviso, Boton, Campo, Tarjeta } from '../../components/ui/Formulario'
import { plata } from '../../utils/formato'
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

      {canchas.data && canchas.data.filter((c) => c.activo).length > 2 && <CanchasUnidas slug={slug} canchas={canchas.data.filter((c) => c.activo)} />}

      {canchas.data && canchas.data.length > 0 && <Adicionales slug={slug} deportes={[...new Map(canchas.data.map((c) => [c.deporte, c.deporte_nombre])).entries()]} />}
      {canchas.data && canchas.data.length > 0 && <Cumpleanos slug={slug} deportes={[...new Map(canchas.data.map((c) => [c.deporte, c.deporte_nombre])).entries()]} />}

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

/** Canchas unidas: por ejemplo, la de fútbol 7 se arma juntando dos de fútbol 5. Al
 * reservar una, las otras se bloquean solas (y al revés). */
function CanchasUnidas({ slug, canchas }: { slug: string; canchas: CanchaPanel[] }) {
  const [editando, setEditando] = useState<string | null>(null)
  const combinadas = canchas.filter((c) => c.partes.length > 0)
  const nombre = (id: string) => canchas.find((c) => c.id === id)?.nombre ?? 'otra cancha'
  const cancha = canchas.find((c) => c.id === editando)

  return (
    <Tarjeta
      titulo="Canchas unidas"
      descripcion="Si una cancha se arma juntando otras (dos de fútbol 5 forman una de fútbol 7), marcalo acá. Al reservar la grande se bloquean sus partes, y al reservar una parte se bloquea la grande."
    >
      {combinadas.length > 0 && (
        <ul className="mb-3 divide-y divide-linea">
          {combinadas.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <b>{c.nombre}</b> = {c.partes.map(nombre).join(' + ')}
              </span>
              <Boton variante="suave" onClick={() => setEditando(c.id)}>
                Cambiar
              </Boton>
            </li>
          ))}
        </ul>
      )}
      {cancha ? (
        <FilaUnida key={cancha.id} slug={slug} cancha={cancha} otras={canchas.filter((c) => c.id !== cancha.id)} onListo={() => setEditando(null)} />
      ) : (
        <div className="grid max-w-sm gap-1.5">
          <label htmlFor="unir-cancha" className="text-[13px] font-semibold">
            Unir canchas
          </label>
          <select
            id="unir-cancha"
            value=""
            onChange={(e) => setEditando(e.target.value || null)}
            className="rounded-[10px] border-[1.5px] border-linea bg-superficie px-3 py-[11px] text-[16px]"
          >
            <option value="">Elegí la cancha que se arma uniendo otras…</option>
            {canchas
              .filter((c) => c.partes.length === 0)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.deporte_nombre})
                </option>
              ))}
          </select>
        </div>
      )}
    </Tarjeta>
  )
}

const cuando = (inicio: string) => {
  const fecha = new Date(inicio)
  const dia = fecha.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'numeric' })
  return `${dia} ${fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

function FilaUnida({ slug, cancha, otras, onListo }: { slug: string; cancha: CanchaPanel; otras: CanchaPanel[]; onListo: () => void }) {
  const cambiar = useCambiarPartes(slug)
  const [elegidas, setElegidas] = useState<string[]>(cancha.partes)
  const [sePisan, setSePisan] = useState<ReservaQueSePisa[]>([])
  const cambio = elegidas.length !== cancha.partes.length || elegidas.some((id) => !cancha.partes.includes(id))
  const alternar = (id: string) => setElegidas((actuales) => (actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id]))

  return (
    <div className="grid gap-2.5 rounded-xl bg-superficie p-3.5 ring-1 ring-linea">
      <p className="text-[15px]">
        <b>{cancha.nombre}</b> <span className="text-gris">({cancha.deporte_nombre})</span> se arma uniendo:
      </p>
      <div className="flex flex-wrap gap-2">
        {otras.map((otra) => (
          <button
            key={otra.id}
            type="button"
            aria-pressed={elegidas.includes(otra.id)}
            onClick={() => alternar(otra.id)}
            className="rounded-full bg-lienzo px-3.5 py-1.5 text-sm ring-1 ring-linea aria-pressed:bg-complejo aria-pressed:text-complejo-sobre aria-pressed:ring-complejo"
          >
            {otra.nombre}
          </button>
        ))}
      </div>
      {cambiar.error && <Aviso>{mensaje(cambiar.error)}</Aviso>}
      {sePisan.length > 0 ? (
        <>
          <Aviso>
            Quedó guardado, pero estas reservas ya se pisaban y hay que resolverlas a mano (mover o cancelar una):{' '}
            {sePisan.map((r) => `${r.cancha} el ${cuando(r.inicio)}${r.nombre ? ` (${r.nombre})` : ''}`).join(' · ')}
          </Aviso>
          <Boton variante="suave" className="justify-self-start" onClick={onListo}>
            Entendido
          </Boton>
        </>
      ) : (
        <div className="flex gap-2">
          <Boton
            disabled={!cambio}
            cargando={cambiar.isPending}
            onClick={() =>
              cambiar.mutate(
                { id: cancha.id, partes: elegidas },
                {
                  onSuccess: (r) => {
                    if (r.reservas_que_se_pisan.length) setSePisan(r.reservas_que_se_pisan)
                    else onListo()
                  },
                },
              )
            }
          >
            {elegidas.length || !cancha.partes.length ? 'Guardar' : 'Separar'}
          </Boton>
          <Boton variante="suave" onClick={onListo}>
            Cancelar
          </Boton>
        </div>
      )}
    </div>
  )
}

/** Lo que el complejo alquila aparte: paletas, pelotas, parrilla. El jugador lo suma al
 * reservar y lo paga en la cancha, con el resto del turno (la seña no cambia). */
function Adicionales({ slug, deportes }: { slug: string; deportes: [string, string][] }) {
  const adicionales = useAdicionales(slug)
  const crear = useCrearAdicional(slug)
  const cambiar = useCambiarAdicional(slug)
  const quitar = useQuitarAdicional(slug)
  const [nuevo, setNuevo] = useState({ nombre: '', precio: '', deporte: '' })
  const nombreDeporte = (codigo: string | null) => deportes.find(([c]) => c === codigo)?.[1]

  function agregar(e: FormEvent) {
    e.preventDefault()
    crear.mutate(
      { nombre: nuevo.nombre.trim(), precio: nuevo.precio || '0', deporte: nuevo.deporte || null },
      { onSuccess: () => setNuevo({ nombre: '', precio: '', deporte: '' }) },
    )
  }

  const error = crear.error ?? cambiar.error ?? quitar.error ?? adicionales.error
  return (
    <Tarjeta
      titulo="Adicionales (opcional)"
      descripcion="Lo que alquilás aparte: paletas, pelotas, parrilla. El jugador lo elige al reservar y lo paga en la cancha con el resto del turno: la seña no cambia."
    >
      {adicionales.data && adicionales.data.length > 0 && (
        <ul className="mb-4 divide-y divide-linea">
          {adicionales.data.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <b className={a.activo ? '' : 'text-gris line-through'}>{a.nombre}</b>
                <span className="ml-2 text-sm text-gris tabular-nums">{plata(a.precio)}</span>
                {a.deporte && <span className="ml-2 rounded-md bg-crema-oscuro px-2 py-0.5 text-xs font-semibold">Solo {nombreDeporte(a.deporte) ?? a.deporte}</span>}
              </span>
              {!a.activo && (
                <Boton variante="suave" onClick={() => cambiar.mutate({ id: a.id, activo: true })}>
                  Activar
                </Boton>
              )}
              {a.activo && (
                <button type="button" onClick={() => quitar.mutate(a.id)} aria-label={`Quitar ${a.nombre}`} className="grid size-9 place-items-center rounded-full text-gris hover:bg-crema-oscuro">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={agregar} className="grid gap-3 sm:grid-cols-[1fr_140px_180px_auto] sm:items-end">
        <Campo etiqueta="Qué alquilás" placeholder="Paleta, pelota, parrilla" required minLength={2} maxLength={60} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <Campo etiqueta="Precio" inputMode="numeric" placeholder="3000" required value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value.replace(/[^0-9]/g, '') })} />
        <div className="grid gap-1.5">
          <label htmlFor="deporte-adicional" className="text-[13px] font-semibold">
            Para
          </label>
          <select
            id="deporte-adicional"
            value={nuevo.deporte}
            onChange={(e) => setNuevo({ ...nuevo, deporte: e.target.value })}
            className="rounded-[10px] border-[1.5px] border-linea bg-superficie px-3 py-[11px] text-[16px]"
          >
            <option value="">Todos los deportes</option>
            {deportes.map(([codigo, nombre]) => (
              <option key={codigo} value={codigo}>
                Solo {nombre}
              </option>
            ))}
          </select>
        </div>
        <Boton type="submit" cargando={crear.isPending}>
          <Plus className="size-4" aria-hidden="true" />
          Agregar
        </Boton>
      </form>
      {error && <Aviso>{mensaje(error)}</Aviso>}
    </Tarjeta>
  )
}

const DURACIONES = [60, 90, 120, 150, 180]
const vacio = { nombre: '', deporte: '', duracion_min: 120, precio: '', incluye: '', condiciones: '', franjas: [] as FranjaCumpleanos[] }
const DIAS_CUMPLE = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const HORAS_CUMPLE = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const textoFranja = (f: FranjaCumpleanos) => `${DIAS_CUMPLE[f.dia_semana]} de ${f.desde.slice(0, 5)} a ${f.hasta.slice(0, 5)}`
const claseTexto = 'w-full rounded-[10px] border-[1.5px] border-linea bg-superficie px-3 py-2.5 text-[16px]'

/** Cumpleaños (opcional): una cancha por un tiempo fijo, a precio cerrado y sin seña. El
 * jugador lo reserva desde la página y después le avisa al complejo por WhatsApp para
 * arreglar los detalles. */
function Cumpleanos({ slug, deportes }: { slug: string; deportes: [string, string][] }) {
  const cumpleanos = useCumpleanos(slug)
  const crear = useCrearCumpleanos(slug)
  const cambiar = useCambiarCumpleanos(slug)
  const quitar = useQuitarCumpleanos(slug)
  const [nuevo, setNuevo] = useState({ ...vacio, deporte: deportes[0]?.[0] ?? '' })
  const nombreDeporte = (codigo: string) => deportes.find(([c]) => c === codigo)?.[1] ?? codigo

  function agregar(e: FormEvent) {
    e.preventDefault()
    crear.mutate(
      {
        nombre: nuevo.nombre.trim(),
        deporte: nuevo.deporte,
        duracion_min: nuevo.duracion_min,
        precio: nuevo.precio || '0',
        incluye: nuevo.incluye.trim() || null,
        condiciones: nuevo.condiciones.trim() || null,
        franjas: nuevo.franjas,
      },
      { onSuccess: () => setNuevo({ ...vacio, deporte: nuevo.deporte }) },
    )
  }

  const error = crear.error ?? cambiar.error ?? quitar.error ?? cumpleanos.error
  return (
    <Tarjeta
      titulo="Cumpleaños (opcional)"
      descripcion="Si festejás cumpleaños, el jugador los reserva desde tu página: una cancha por el tiempo que elijas, a precio cerrado y sin seña. Después te escribe por WhatsApp para arreglar los detalles."
    >
      {cumpleanos.data && cumpleanos.data.length > 0 && (
        <ul className="mb-4 divide-y divide-linea">
          {cumpleanos.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start gap-3 py-2.5">
              <Cake className="mt-1 size-4 flex-none text-cesped" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <b className={c.activo ? '' : 'text-gris line-through'}>{c.nombre}</b>
                <span className="ml-2 text-sm text-gris tabular-nums">
                  {nombreDeporte(c.deporte)} · {c.duracion_min} min · {plata(c.precio)}
                </span>
                {c.incluye && <span className="block text-sm text-gris">Incluye: {c.incluye}</span>}
                {c.condiciones && <span className="block text-sm text-gris">Condiciones: {c.condiciones}</span>}
                <span className="block text-sm text-gris">{c.franjas.length ? `Se festeja: ${c.franjas.map(textoFranja).join(', ')}` : 'En cualquier turno de la cancha'}</span>
                {c.activo && (
                  <EditarFranjas franjas={c.franjas} cargando={cambiar.isPending} onGuardar={(franjas) => cambiar.mutate({ id: c.id, franjas })} />
                )}
              </span>
              {!c.activo && (
                <Boton variante="suave" onClick={() => cambiar.mutate({ id: c.id, activo: true })}>
                  Activar
                </Boton>
              )}
              {c.activo && (
                <button type="button" onClick={() => quitar.mutate(c.id)} aria-label={`Quitar ${c.nombre}`} className="grid size-9 place-items-center rounded-full text-gris hover:bg-crema-oscuro">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={agregar} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_140px_140px] sm:items-end">
          <Campo etiqueta="Nombre" placeholder="Cumpleaños en fútbol 5" required minLength={2} maxLength={60} value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
          <div className="grid gap-1.5">
            <label htmlFor="deporte-cumple" className="text-[13px] font-semibold">
              Cancha de
            </label>
            <select id="deporte-cumple" value={nuevo.deporte} onChange={(e) => setNuevo({ ...nuevo, deporte: e.target.value })} className="rounded-[10px] border-[1.5px] border-linea bg-superficie px-3 py-[11px] text-[16px]">
              {deportes.map(([codigo, nombre]) => (
                <option key={codigo} value={codigo}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="duracion-cumple" className="text-[13px] font-semibold">
              Duración
            </label>
            <select id="duracion-cumple" value={nuevo.duracion_min} onChange={(e) => setNuevo({ ...nuevo, duracion_min: Number(e.target.value) })} className="rounded-[10px] border-[1.5px] border-linea bg-superficie px-3 py-[11px] text-[16px]">
              {DURACIONES.map((d) => (
                <option key={d} value={d}>
                  {d % 60 ? `${d} min` : `${d / 60} ${d === 60 ? 'hora' : 'horas'}`}
                </option>
              ))}
            </select>
          </div>
          <Campo etiqueta="Precio" inputMode="numeric" placeholder="150000" required value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value.replace(/[^0-9]/g, '') })} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="incluye-cumple" className="text-[13px] font-semibold">
              Qué incluye (opcional)
            </label>
            <textarea id="incluye-cumple" rows={3} maxLength={1000} placeholder="Pelota, pecheras y un profe que arma el partido." value={nuevo.incluye} onChange={(e) => setNuevo({ ...nuevo, incluye: e.target.value })} className={claseTexto} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="condiciones-cumple" className="text-[13px] font-semibold">
              Condiciones para festejar (opcional)
            </label>
            <textarea id="condiciones-cumple" rows={3} maxLength={1000} placeholder="Máximo 20 chicos. Se puede traer torta y bebidas. No se permite cotillón con papel picado." value={nuevo.condiciones} onChange={(e) => setNuevo({ ...nuevo, condiciones: e.target.value })} className={claseTexto} />
          </div>
        </div>
        <Franjas franjas={nuevo.franjas} onCambiar={(franjas) => setNuevo({ ...nuevo, franjas })} />
        <div>
          <Boton type="submit" cargando={crear.isPending}>
            <Plus className="size-4" aria-hidden="true" />
            Agregar cumpleaños
          </Boton>
        </div>
      </form>
      {error && <Aviso>{mensaje(error)}</Aviso>}
    </Tarjeta>
  )
}

/** Días y horarios en que se festejan cumpleaños. Sin ninguno: en cualquier turno. */
function Franjas({ franjas, onCambiar }: { franjas: FranjaCumpleanos[]; onCambiar: (franjas: FranjaCumpleanos[]) => void }) {
  const cambiar = (i: number, cambios: Partial<FranjaCumpleanos>) => onCambiar(franjas.map((f, j) => (j === i ? { ...f, ...cambios } : f)))
  const select = 'rounded-[10px] border-[1.5px] border-linea bg-superficie px-2.5 py-2 text-[15px]'
  return (
    <div className="grid gap-2">
      <span className="text-[13px] font-semibold">Días y horarios (opcional)</span>
      <span className="text-sm text-gris">Si no cargás ninguno, se puede reservar en cualquier turno de la cancha.</span>
      {franjas.map((f, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select aria-label="Día" value={f.dia_semana} onChange={(e) => cambiar(i, { dia_semana: Number(e.target.value) })} className={select}>
            {DIAS_CUMPLE.map((d, n) => (
              <option key={d} value={n}>
                {d}
              </option>
            ))}
          </select>
          de
          <select aria-label="Desde" value={f.desde.slice(0, 5)} onChange={(e) => cambiar(i, { desde: e.target.value })} className={select}>
            {HORAS_CUMPLE.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
          a
          <select aria-label="Hasta" value={f.hasta.slice(0, 5)} onChange={(e) => cambiar(i, { hasta: e.target.value })} className={select}>
            {HORAS_CUMPLE.map((h) => (
              <option key={h}>{h}</option>
            ))}
          </select>
          <button type="button" onClick={() => onCambiar(franjas.filter((_, j) => j !== i))} aria-label="Quitar este horario" className="grid size-9 place-items-center rounded-full text-gris hover:bg-crema-oscuro">
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onCambiar([...franjas, { dia_semana: 5, desde: '14:00', hasta: '20:00' }])}
        className="justify-self-start text-sm font-semibold text-cesped underline-offset-2 hover:underline"
      >
        + Agregar día y horario
      </button>
    </div>
  )
}

/** Cambiar los días y horarios de un cumpleaños que ya existe. */
function EditarFranjas({ franjas, cargando, onGuardar }: { franjas: FranjaCumpleanos[]; cargando: boolean; onGuardar: (franjas: FranjaCumpleanos[]) => void }) {
  const [abierto, setAbierto] = useState(false)
  const [lista, setLista] = useState(franjas)
  if (!abierto) {
    return (
      <button type="button" onClick={() => { setLista(franjas); setAbierto(true) }} className="mt-1 text-sm font-semibold text-cesped underline-offset-2 hover:underline">
        Editar días y horarios
      </button>
    )
  }
  return (
    <div className="mt-2 grid gap-2 rounded-xl bg-cal p-3 ring-1 ring-linea">
      <Franjas franjas={lista} onCambiar={setLista} />
      <div className="flex gap-2">
        <Boton cargando={cargando} onClick={() => { onGuardar(lista); setAbierto(false) }}>
          Guardar
        </Boton>
        <Boton variante="suave" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
      </div>
    </div>
  )
}
