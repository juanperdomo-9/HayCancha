import type { Turno } from '../../api/publico'

type Props = {
  turnos: Turno[] | undefined
  cargando: boolean
  seleccionado: string | null
  onElegir: (inicio: string) => void
}

function textoLibres(turno: Turno): string {
  const libres = turno.libres.length
  if (libres === 0) return 'completo'
  if (turno.canchas_total === 1) return 'libre'
  return libres === 1 ? 'queda 1' : `quedan ${libres}`
}

/** Un botón por horario, con una rayita por cancha: llena si está libre. */
export function GrillaTurnos({ turnos, cargando, seleccionado, onElegir }: Props) {
  if (cargando && !turnos) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2.5" aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-xl bg-borde/60" />
        ))}
      </div>
    )
  }
  if (!turnos?.length) {
    return (
      <p className="rounded-xl border-[1.5px] border-dashed border-borde p-5 text-center text-tenue">
        Ese día no quedan turnos. Probá con otro.
      </p>
    )
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2.5" aria-live="polite">
      {turnos.map((turno, i) => {
        const elegido = turno.inicio === seleccionado
        const lleno = turno.libres.length === 0
        const ultima = !lleno && turno.libres.length === 1 && turno.canchas_total > 1
        return (
          <button
            key={turno.inicio}
            type="button"
            disabled={lleno}
            aria-pressed={elegido}
            aria-label={`${turno.hora}, ${textoLibres(turno)}`}
            onClick={() => onElegir(turno.inicio)}
            style={{ animationDelay: `${i * 16}ms` }}
            className="grid animate-sube gap-[7px] rounded-xl border-[1.5px] border-borde bg-superficie px-3 pt-3 pb-2.5 text-left transition hover:-translate-y-0.5 hover:border-complejo-linea active:scale-[.96] disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-dashed disabled:bg-transparent aria-pressed:-translate-y-0.5 aria-pressed:border-complejo aria-pressed:bg-complejo aria-pressed:text-complejo-sobre aria-pressed:shadow-[0_12px_24px_-14px_var(--complejo)]"
          >
            <span className={`numeros text-[27px] leading-none font-bold ${lleno ? 'text-tenue/60' : ''}`}>{turno.hora}</span>
            <span className="flex gap-[3px]" aria-hidden="true">
              {Array.from({ length: turno.canchas_total }, (_, k) => {
                const libre = k < turno.libres.length
                const color = elegido
                  ? libre
                    ? 'bg-complejo-sobre'
                    : 'bg-complejo-sobre/30'
                  : libre
                    ? 'bg-complejo'
                    : 'bg-borde'
                return <i key={k} className={`h-[5px] flex-1 rounded-full ${color}`} />
              })}
            </span>
            <span
              className={`text-[12.5px] ${elegido ? 'opacity-85' : ultima ? 'font-bold text-complejo-texto' : 'font-medium text-tenue'}`}
            >
              {textoLibres(turno)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
