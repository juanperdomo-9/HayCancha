import type { DiaDeLaSemana } from '../../api/agenda'
import { DIAS_CORTOS, desdeIso } from '../../utils/formato'

type Props = { dias: DiaDeLaSemana[]; hoy: string | undefined; onElegir: (fecha: string) => void }

/** Cuántos turnos libres y ocupados tiene cada día. Tocando un día se abre su agenda. */
export function VistaSemana({ dias, hoy, onElegir }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
      {dias.map((dia) => {
        const fecha = desdeIso(dia.fecha)
        const total = dia.ocupados + dia.libres + dia.bloqueados
        const ancho = (n: number) => `${total ? (n / total) * 100 : 0}%`
        return (
          <li key={dia.fecha}>
            <button
              type="button"
              onClick={() => onElegir(dia.fecha)}
              className={`grid w-full gap-2 rounded-2xl bg-cal p-3.5 text-left ring-1 transition hover:-translate-y-0.5 hover:ring-noche ${dia.fecha === hoy ? 'ring-2 ring-complejo' : 'ring-linea'}`}
            >
              <span className="flex items-baseline justify-between">
                <span className="text-xs font-semibold tracking-[.08em] text-gris uppercase">{dia.fecha === hoy ? 'Hoy' : DIAS_CORTOS[fecha.getDay()]}</span>
                <b className="numeros text-2xl leading-none">{fecha.getDate()}</b>
              </span>
              <span className="flex h-2 overflow-hidden rounded-full bg-linea" aria-hidden="true">
                <i className="bg-noche" style={{ width: ancho(dia.ocupados) }} />
                <i className="bg-crema-oscuro bg-[repeating-linear-gradient(135deg,var(--color-gris)_0_2px,transparent_2px_5px)]" style={{ width: ancho(dia.bloqueados) }} />
              </span>
              <span className="text-[13px] tabular-nums">
                <b>{dia.ocupados}</b> <span className="text-gris">ocupados</span> · <b>{dia.libres}</b> <span className="text-gris">libres</span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
