import type { Cancha, Turno } from '../../api/publico'

type Props = {
  canchas: Cancha[]
  turno: Turno
  elegida: string | null
  onElegir: (id: string | null) => void
}

/** Para quien quiere una cancha en particular (la techada, la de blindex…). */
export function ElegirCancha({ canchas, turno, elegida, onElegir }: Props) {
  const libres = new Set(turno.libres.map((c) => c.id))
  const clase =
    'grid gap-px rounded-[11px] border-[1.5px] border-borde bg-superficie px-3 py-2.5 text-left transition-colors hover:enabled:border-complejo-linea disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:border-complejo aria-pressed:bg-complejo-suave aria-pressed:shadow-[inset_0_0_0_1px_var(--complejo)]'
  return (
    <div className="mt-6 animate-sube">
      <h3 className="font-semibold">¿Querés una cancha en particular?</h3>
      <p className="mb-3 text-sm text-tenue">Si no elegís, te damos la primera libre.</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,190px),1fr))] gap-2">
        <button type="button" className={clase} aria-pressed={elegida === null} onClick={() => onElegir(null)}>
          <b>Cualquiera</b>
          <span className="text-[12.5px] text-tenue">La primera libre</span>
        </button>
        {canchas.map((cancha) => {
          const libre = libres.has(cancha.id)
          return (
            <button
              key={cancha.id}
              type="button"
              className={clase}
              disabled={!libre}
              aria-pressed={elegida === cancha.id}
              onClick={() => onElegir(cancha.id)}
            >
              <b>{cancha.nombre}</b>
              <span className="text-[12.5px] text-tenue">{libre ? (cancha.caracteristicas ?? 'Libre') : 'Ocupada'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
