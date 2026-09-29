import { DIAS, DIAS_CORTOS, MESES, aIso, desdeIso, sumarDias } from '../../utils/formato'

type Props = {
  hoy: string
  dias: number
  valor: string
  onCambiar: (fecha: string) => void
}

/** Los próximos días, en una tira que se desliza con el dedo. */
export function TiraDeFechas({ hoy, dias, valor, onCambiar }: Props) {
  const inicio = desdeIso(hoy)
  return (
    <div className="-mx-1 mt-4 flex snap-x gap-2 overflow-x-auto px-1 pt-0.5 pb-1.5 [scrollbar-width:none]" aria-label="Día">
      {Array.from({ length: dias }, (_, i) => {
        const fecha = sumarDias(inicio, i)
        const iso = aIso(fecha)
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onCambiar(iso)}
            aria-pressed={iso === valor}
            aria-label={`${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`}
            className="grid w-[60px] flex-none snap-start justify-items-center rounded-xl border-[1.5px] border-borde bg-superficie pt-2 pb-2.5 transition-colors hover:border-tinta aria-pressed:border-tinta aria-pressed:bg-tinta aria-pressed:text-superficie"
          >
            <small className="text-[11px] font-semibold tracking-[.08em] uppercase opacity-70">
              {i === 0 ? 'Hoy' : DIAS_CORTOS[fecha.getDay()]}
            </small>
            <b className="numeros text-[26px] leading-[1.1] font-bold">{fecha.getDate()}</b>
          </button>
        )
      })}
    </div>
  )
}
