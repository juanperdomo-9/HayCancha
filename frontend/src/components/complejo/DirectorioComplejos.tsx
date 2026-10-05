import { useState } from 'react'
import { Link } from 'react-router'

import { VIA_HAYCANCHA } from '../../utils/llegada'

import { type ComplejoResumen, type Deporte, useComplejos } from '../../api/publico'
import { TemaComplejo } from '../../theme/TemaComplejo'
import { diaRelativo } from '../../utils/formato'
import { LogoComplejo } from './LogoComplejo'
import { PortadaComplejo } from './PortadaComplejo'

/** El listado de complejos de la página principal, con filtro por deporte. */
export function DirectorioComplejos() {
  const { data: complejos, isPending, isError } = useComplejos()
  const [filtro, setFiltro] = useState<string | null>(null)

  const deportes = new Map<string, Deporte>()
  complejos?.forEach((c) => c.deportes.forEach((d) => deportes.set(d.codigo, d)))
  const visibles = complejos?.filter((c) => !filtro || c.deportes.some((d) => d.codigo === filtro))

  return (
    <>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-titulo text-[clamp(42px,6.4vw,80px)] leading-[.9] font-extrabold uppercase">Complejos</h2>
        {deportes.size > 1 && (
          <div className="flex flex-wrap gap-2" aria-label="Filtrar por deporte">
            {[{ codigo: null, nombre: 'Todos' }, ...deportes.values()].map((d) => (
              <button
                key={d.codigo ?? 'todos'}
                type="button"
                aria-pressed={filtro === d.codigo}
                onClick={() => setFiltro(d.codigo)}
                className="rounded-full border-[1.5px] border-linea px-3.5 py-1.5 text-sm font-medium transition-colors hover:border-noche aria-pressed:border-noche aria-pressed:bg-noche aria-pressed:text-crema"
              >
                {d.nombre}
              </button>
            ))}
          </div>
        )}
      </div>

      {isPending && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-5" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[330px] animate-pulse rounded-[18px] bg-crema-oscuro" />
          ))}
        </div>
      )}
      {isError && <p className="text-lg text-gris">No pudimos cargar los complejos. Probá de nuevo en un rato.</p>}
      {visibles && visibles.length === 0 && (
        <p className="text-lg text-gris">Todavía no hay complejos {filtro ? 'con ese deporte' : 'para mostrar'}.</p>
      )}
      {visibles && visibles.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-5">
          {visibles.map((complejo, i) => (
            <li key={complejo.slug} className="animate-sube" style={{ animationDelay: `${i * 50}ms` }}>
              <TarjetaComplejo complejo={complejo} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function TarjetaComplejo({ complejo }: { complejo: ComplejoResumen }) {
  const proximo = complejo.proximo_turno
  return (
    <TemaComplejo color={complejo.color_primario} secundario={complejo.color_secundario} className="h-full">
      <Link
        to={`/${complejo.slug}?${VIA_HAYCANCHA}`}
        className="group flex h-full flex-col overflow-hidden rounded-[18px] bg-cal transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_-26px_rgba(30,25,10,.45)]"
      >
        <PortadaComplejo
          portadaUrl={complejo.portada_url}
          deporte={complejo.deportes[0]?.codigo ?? 'futbol5'}
          className="relative aspect-[16/8] max-w-full"
        />
        <div className="grid flex-1 content-start gap-1.5 px-4.5 pb-4.5">
          <LogoComplejo
            nombre={complejo.nombre}
            logoUrl={complejo.logo_url}
            className="relative z-10 -mt-8 w-15 text-[60px] shadow-[0_6px_12px_rgba(0,0,0,.25)]"
          />
          <span className="numeros mt-1 text-[26px] leading-[1.02] font-extrabold" style={{ fontStretch: '78%' }}>
            {complejo.nombre}
          </span>
          {complejo.barrio && <span className="text-sm text-gris">{complejo.barrio}</span>}
          <span className="mt-1 flex flex-wrap gap-1.5">
            {complejo.deportes.map((d) => (
              <span key={d.codigo} className="rounded-md bg-crema-oscuro px-2 py-0.5 text-[12.5px]">
                {d.nombre}
              </span>
            ))}
          </span>
          <span className="mt-auto flex justify-between gap-2.5 border-t border-linea pt-3 text-sm text-gris">
            <span>Próximo turno libre</span>
            <b className="text-noche tabular-nums">
              {proximo ? `${diaRelativo(proximo.fecha, complejo.hoy)} ${proximo.hora}` : 'sin turnos esta semana'}
            </b>
          </span>
        </div>
      </Link>
    </TemaComplejo>
  )
}
