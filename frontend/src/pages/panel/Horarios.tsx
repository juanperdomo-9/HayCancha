import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'

import { mensaje } from '../../api/client'
import { type CanchaPanel, type Franja, useCanchas, useDeportes, useGuardarHorarios, useHorarios } from '../../api/panel'
import { Aviso, Boton, Tarjeta } from '../../components/ui/Formulario'
import { plata } from '../../utils/formato'
import { EncabezadoSeccion } from './EncabezadoSeccion'

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DIAS_LARGOS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const DURACIONES = [30, 45, 60, 90, 120]

type FranjaEditable = Franja & { clave: number }

function minutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/** Cuántos turnos entran en la franja (si hasta <= desde, termina al día siguiente). */
function turnosEnFranja(f: Pick<Franja, 'desde' | 'hasta' | 'duracion_turno_min'>): number {
  const largo = (minutos(f.hasta) - minutos(f.desde) + 1440) % 1440
  return f.duracion_turno_min > 0 ? Math.floor(largo / f.duracion_turno_min) : 0
}

let siguienteClave = 1
const conClave = (f: Franja): FranjaEditable => ({ ...f, desde: f.desde.slice(0, 5), hasta: f.hasta.slice(0, 5), clave: siguienteClave++ })

export default function Horarios() {
  const { slug = '' } = useParams()
  const canchas = useCanchas(slug)
  const deportes = useDeportes(slug)
  const activas = useMemo(() => canchas.data?.filter((c) => c.activo) ?? [], [canchas.data])

  const deportesConCanchas = useMemo(() => {
    const vistos = new Map<string, string>()
    activas.forEach((c) => vistos.set(c.deporte, c.deporte_nombre))
    return [...vistos.entries()]
  }, [activas])

  const [deporte, setDeporte] = useState<string | null>(null)
  const deporteActual = deporte ?? deportesConCanchas[0]?.[0]

  if (canchas.isPending) return <p className="text-gris">Cargando…</p>
  if (canchas.error) return <Aviso>{mensaje(canchas.error)}</Aviso>
  if (!activas.length) {
    return (
      <div className="grid gap-5">
        <EncabezadoSeccion titulo="Horarios y precios" bajada="Primero cargá tus canchas." />
        <Link to={`/panel/${slug}/canchas`} className="font-semibold text-complejo-texto underline underline-offset-3">
          Ir a canchas →
        </Link>
      </div>
    )
  }

  const canchasDelDeporte = activas.filter((c) => c.deporte === deporteActual)
  const sugerida = deportes.data?.find((d) => d.codigo === deporteActual)?.duracion_sugerida_min ?? 60

  return (
    <div className="grid gap-6">
      <EncabezadoSeccion
        titulo="Horarios y precios"
        bajada="Cargá las franjas en que se alquila cada cancha. Si una franja termina después de medianoche (18 a 02), poné la hora de cierre y listo."
      />
      {deportesConCanchas.length > 1 && (
        <div className="flex flex-wrap gap-2" aria-label="Deporte">
          {deportesConCanchas.map(([codigo, nombre]) => (
            <button
              key={codigo}
              type="button"
              aria-pressed={codigo === deporteActual}
              onClick={() => setDeporte(codigo)}
              className="rounded-full border-[1.5px] border-linea bg-white px-4 py-2 text-sm font-semibold aria-pressed:border-noche aria-pressed:bg-noche aria-pressed:text-crema"
            >
              {nombre}
            </button>
          ))}
        </div>
      )}
      {deporteActual && (
        <EditorDeHorarios key={deporteActual} slug={slug} canchas={canchasDelDeporte} duracionSugerida={sugerida} />
      )}
    </div>
  )
}

function EditorDeHorarios({ slug, canchas, duracionSugerida }: { slug: string; canchas: CanchaPanel[]; duracionSugerida: number }) {
  // Arranca con los horarios de la primera cancha (si ya tiene).
  const existentes = useHorarios(slug, canchas[0]?.id)
  if (existentes.error) return <Aviso>{mensaje(existentes.error)}</Aviso>
  if (!existentes.data) return <p className="text-gris">Cargando…</p>
  const iniciales = existentes.data.length
    ? existentes.data
    : [{ dias: [0, 1, 2, 3, 4, 5, 6], desde: '09:00', hasta: '00:00', duracion_turno_min: duracionSugerida, precio: '' }]
  return <FormularioHorarios slug={slug} canchas={canchas} duracionSugerida={duracionSugerida} iniciales={iniciales} />
}

function FormularioHorarios({
  slug,
  canchas,
  duracionSugerida,
  iniciales,
}: {
  slug: string
  canchas: CanchaPanel[]
  duracionSugerida: number
  iniciales: Franja[]
}) {
  const [elegidas, setElegidas] = useState<string[]>(canchas.map((c) => c.id))
  const guardar = useGuardarHorarios(slug)
  const [franjas, setFranjas] = useState<FranjaEditable[]>(() => iniciales.map(conClave))
  const [ok, setOk] = useState<string | null>(null)

  function cambiar(clave: number, cambios: Partial<Franja>) {
    setOk(null)
    setFranjas((actuales) => actuales.map((f) => (f.clave === clave ? { ...f, ...cambios } : f)))
  }

  function alternarDia(franja: FranjaEditable, dia: number) {
    const dias = franja.dias.includes(dia) ? franja.dias.filter((d) => d !== dia) : [...franja.dias, dia].sort()
    cambiar(franja.clave, { dias })
  }

  function enviar() {
    setOk(null)
    guardar.mutate(
      { canchas: elegidas, franjas: franjas.map(({ clave: _clave, ...f }) => ({ ...f, precio: f.precio || '0' })) },
      {
        onSuccess: (r) =>
          setOk(`Listo: ${r.franjas} ${r.franjas === 1 ? 'franja guardada' : 'franjas guardadas'} en ${r.canchas} ${r.canchas === 1 ? 'cancha' : 'canchas'}.`),
      },
    )
  }

  return (
    <>
      <Tarjeta titulo="¿A qué canchas se aplican?" descripcion="Se reemplazan los horarios de las canchas que marques.">
        <div className="flex flex-wrap gap-2">
          {canchas.map((c) => {
            const marcada = elegidas.includes(c.id)
            return (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-linea has-checked:ring-2 has-checked:ring-complejo">
                <input
                  type="checkbox"
                  checked={marcada}
                  onChange={() => {
                    setOk(null)
                    setElegidas(marcada ? elegidas.filter((id) => id !== c.id) : [...elegidas, c.id])
                  }}
                  className="size-4 accent-[var(--complejo)]"
                />
                <span className="font-semibold">{c.nombre}</span>
                {c.caracteristicas && <span className="text-sm text-gris">{c.caracteristicas}</span>}
              </label>
            )
          })}
        </div>
      </Tarjeta>

      <Tarjeta titulo="Franjas" descripcion="Una fila por cada horario con su precio. Por ejemplo: de 9 a 18 a un precio y de 18 a 24 a otro.">
          <div className="grid gap-3">
            {franjas.map((franja) => {
              const turnos = turnosEnFranja(franja)
              return (
                <div key={franja.clave} className="grid gap-3 rounded-xl bg-white p-3.5 ring-1 ring-linea lg:grid-cols-[auto_1fr_auto] lg:items-center">
                  <fieldset className="flex gap-1">
                    <legend className="sr-only">Días</legend>
                    {DIAS.map((letra, dia) => (
                      <button
                        key={dia}
                        type="button"
                        aria-pressed={franja.dias.includes(dia)}
                        aria-label={DIAS_LARGOS[dia]}
                        onClick={() => alternarDia(franja, dia)}
                        className="size-9 rounded-lg bg-crema-oscuro/60 text-sm font-bold text-gris aria-pressed:bg-complejo aria-pressed:text-complejo-sobre"
                      >
                        {letra}
                      </button>
                    ))}
                  </fieldset>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <label className="flex items-center gap-1.5">
                      de
                      <input
                        type="time"
                        value={franja.desde}
                        onChange={(e) => cambiar(franja.clave, { desde: e.target.value })}
                        className="rounded-lg border-[1.5px] border-linea px-2 py-1.5 text-[15px] tabular-nums"
                      />
                    </label>
                    <label className="flex items-center gap-1.5">
                      a
                      <input
                        type="time"
                        value={franja.hasta}
                        onChange={(e) => cambiar(franja.clave, { hasta: e.target.value })}
                        className="rounded-lg border-[1.5px] border-linea px-2 py-1.5 text-[15px] tabular-nums"
                      />
                    </label>
                    <label className="flex items-center gap-1.5">
                      turnos de
                      <select
                        value={franja.duracion_turno_min}
                        onChange={(e) => cambiar(franja.clave, { duracion_turno_min: Number(e.target.value) })}
                        className="rounded-lg border-[1.5px] border-linea bg-white px-2 py-1.5 text-[15px]"
                      >
                        {[...new Set([...DURACIONES, franja.duracion_turno_min])].sort((a, b) => a - b).map((d) => (
                          <option key={d} value={d}>
                            {d} min
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex items-center gap-1.5">
                      a
                      <span className="flex items-center rounded-lg border-[1.5px] border-linea bg-white">
                        <span className="pl-2 text-gris">$</span>
                        <input
                          type="number"
                          min={0}
                          step={500}
                          inputMode="numeric"
                          placeholder="85000"
                          value={franja.precio === '' ? '' : Number(franja.precio)}
                          onChange={(e) => cambiar(franja.clave, { precio: e.target.value })}
                          className="w-28 rounded-lg px-1.5 py-1.5 text-[15px] tabular-nums outline-none"
                          aria-label="Precio del turno"
                        />
                      </span>
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <span className="text-[13px] text-gris">
                      {turnos} {turnos === 1 ? 'turno' : 'turnos'}
                      {franja.precio ? ` de ${plata(franja.precio)}` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFranjas(franjas.filter((f) => f.clave !== franja.clave))}
                      className="grid size-9 place-items-center rounded-lg text-gris hover:bg-red-50 hover:text-red-700"
                      aria-label="Quitar franja"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )
            })}
            <Boton
              variante="suave"
              className="justify-self-start"
              onClick={() => {
                const ultima = franjas.at(-1)
                setFranjas([
                  ...franjas,
                  conClave({
                    dias: ultima?.dias ?? [0, 1, 2, 3, 4, 5, 6],
                    desde: ultima?.hasta ?? '18:00',
                    hasta: '00:00',
                    duracion_turno_min: ultima?.duracion_turno_min ?? duracionSugerida,
                    precio: '',
                  }),
                ])
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Agregar franja
            </Boton>
          </div>
      </Tarjeta>

      <div className="grid gap-3">
        {guardar.error && <Aviso>{mensaje(guardar.error)}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        <Boton onClick={enviar} cargando={guardar.isPending} disabled={!elegidas.length} className="justify-self-start px-6 py-3 text-base">
          Guardar horarios en {elegidas.length} {elegidas.length === 1 ? 'cancha' : 'canchas'}
        </Boton>
      </div>
    </>
  )
}
