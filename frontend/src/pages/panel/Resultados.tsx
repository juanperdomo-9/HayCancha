import { ArrowDownRight, ArrowUpRight, Lock } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'

import { mensaje } from '../../api/client'
import { usePanel, useResultados } from '../../api/panel'
import { Aviso, Tarjeta } from '../../components/ui/Formulario'
import { plata } from '../../utils/formato'
import { EncabezadoSeccion } from './EncabezadoSeccion'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function mesesParaElegir() {
  const hoy = new Date()
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const nombre = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    return { valor, nombre: nombre[0].toUpperCase() + nombre.slice(1) }
  })
}

/** Pestaña Resultados (Plan Pro): los números del mes y cuánto trajo HayCancha. */
export default function Resultados() {
  const { slug = '' } = useParams()
  const panel = usePanel(slug)
  if (panel.data && !panel.data.plan_pro) return <SinPlanPro />
  return <ResultadosDelMes slug={slug} />
}

function SinPlanPro() {
  return (
    <div className="grid gap-6">
      <EncabezadoSeccion titulo="Resultados" bajada="Cuántas reservas, cuánta plata y cuántos jugadores nuevos te trajo HayCancha, mes a mes." />
      <div className="grid justify-items-start gap-3 rounded-2xl bg-cal p-6 ring-1 ring-linea">
        <Lock className="size-6 text-cesped" aria-hidden="true" />
        <b className="text-lg">Es parte del Plan Pro</b>
        <p className="max-w-prose text-gris">
          Facturación, ocupación por día, horarios más pedidos y las reservas que te llegaron por HayCancha. Pedíselo a tu contacto de HayCancha y lo
          activamos.
        </p>
      </div>
    </div>
  )
}

function ResultadosDelMes({ slug }: { slug: string }) {
  const [meses] = useState(mesesParaElegir)
  const [mes, setMes] = useState(meses[0].valor)
  const resultados = useResultados(slug, mes)
  const r = resultados.data
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <EncabezadoSeccion titulo="Resultados" bajada="Los números de tu complejo. Cada uno se compara con el mes anterior." />
        <select
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          aria-label="Mes"
          className="rounded-xl border-[1.5px] border-linea bg-superficie px-3 py-2.5 text-[16px] font-semibold"
        >
          {meses.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>
      {resultados.error && <Aviso>{mensaje(resultados.error)}</Aviso>}
      {!r && !resultados.error && <p className="text-gris">Cargando…</p>}
      {r && (
        <>
          <div className="bloque-oscuro grid gap-1 rounded-2xl bg-bloque p-5 text-cal sm:p-6">
            <span className="text-sm font-semibold tracking-[.08em] text-cesped-claro uppercase">Te trajo HayCancha</span>
            <b className="numeros text-4xl" style={{ fontStretch: '80%' }}>
              {r.actual.de_haycancha} {r.actual.de_haycancha === 1 ? 'reserva' : 'reservas'} · {plata(r.actual.facturacion_haycancha)}
            </b>
            <span className="text-sm text-cal/70">Jugadores que te encontraron en la página principal, el mapa o el buscador de HayCancha.</span>
          </div>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Numero titulo="Reservas" valor={r.actual.reservas} antes={r.anterior.reservas} />
            <Numero titulo="Facturación" valor={r.actual.facturacion} antes={r.anterior.facturacion} plataje />
            <Numero titulo="Señas cobradas online" valor={r.actual.senas_online} antes={r.anterior.senas_online} plataje />
            <Numero titulo="Ocupación" valor={r.actual.ocupacion} antes={r.anterior.ocupacion} sufijo="%" />
            <Numero
              titulo="Sin que intervengas"
              valor={r.actual.sin_intervencion}
              antes={r.anterior.sin_intervencion}
              nota={`${r.actual.a_mano} cargadas a mano`}
            />
            <Numero titulo="Faltas" valor={r.actual.faltas} antes={r.anterior.faltas} alReves />
          </ul>
          <div className="grid gap-4 lg:grid-cols-2">
            <Tarjeta titulo="Ocupación por día">
              <ul className="grid gap-2">
                {r.ocupacion_por_dia.map((p, i) => (
                  <Barra key={DIAS[i]} etiqueta={DIAS[i]} porcentaje={p} texto={`${p}%`} />
                ))}
              </ul>
            </Tarjeta>
            <Tarjeta titulo="Horarios más pedidos">
              {r.horarios_top.length ? (
                <ul className="grid gap-2">
                  {r.horarios_top.map((h) => (
                    <Barra
                      key={h.hora}
                      etiqueta={h.hora}
                      porcentaje={(100 * h.reservas) / r.horarios_top[0].reservas}
                      texto={`${h.reservas} ${h.reservas === 1 ? 'reserva' : 'reservas'}`}
                    />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gris">Todavía no hay reservas este mes.</p>
              )}
            </Tarjeta>
          </div>
        </>
      )}
    </div>
  )
}

function Numero({
  titulo,
  valor,
  antes,
  plataje,
  sufijo = '',
  nota,
  alReves,
}: {
  titulo: string
  valor: number | string
  antes: number | string
  plataje?: boolean
  sufijo?: string
  nota?: string
  alReves?: boolean
}) {
  const actual = Number(valor)
  const previo = Number(antes)
  const cambio = previo ? Math.round((100 * (actual - previo)) / previo) : null
  const bueno = cambio !== null && (alReves ? cambio < 0 : cambio > 0)
  return (
    <li className="grid content-start gap-1 rounded-2xl bg-cal p-4 ring-1 ring-linea">
      <span className="text-[13px] font-semibold text-gris">{titulo}</span>
      <b className="numeros text-3xl" style={{ fontStretch: '80%' }}>
        {plataje ? plata(String(valor)) : `${actual}${sufijo}`}
      </b>
      {cambio !== null && cambio !== 0 ? (
        <span className={`flex items-center gap-0.5 text-[13px] font-semibold ${bueno ? 'text-cesped' : 'text-red-700'}`}>
          {cambio > 0 ? <ArrowUpRight className="size-4" aria-hidden="true" /> : <ArrowDownRight className="size-4" aria-hidden="true" />}
          {Math.abs(cambio)}% contra el mes anterior
        </span>
      ) : (
        <span className="text-[13px] text-gris">{previo ? 'Igual que el mes anterior' : 'Sin datos del mes anterior'}</span>
      )}
      {nota && <span className="text-[13px] text-gris">{nota}</span>}
    </li>
  )
}

function Barra({ etiqueta, porcentaje, texto }: { etiqueta: string; porcentaje: number; texto: string }) {
  return (
    <li className="grid grid-cols-[3.2rem_1fr_auto] items-center gap-3 text-sm">
      <span className="numeros font-semibold">{etiqueta}</span>
      <span className="h-3 overflow-hidden rounded-full bg-crema-oscuro">
        <span className="block h-full rounded-full bg-cesped" style={{ width: `${Math.max(2, Math.min(100, porcentaje))}%` }} />
      </span>
      <span className="text-gris">{texto}</span>
    </li>
  )
}
