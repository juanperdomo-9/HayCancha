import { useSalud } from '../api/salud'

/** Indicador para desarrollo: ¿el frontend llega al backend y el backend a la base? */
export function EstadoServidor() {
  const { data, isPending, isError } = useSalud()

  const [color, texto] = isPending
    ? ['bg-gris', 'Buscando el backend…']
    : isError
      ? ['bg-red-600', 'Sin conexión con el backend']
      : data.base === 'ok'
        ? ['bg-cesped-claro', 'Backend y base OK']
        : ['bg-amber-500', 'Backend OK · base sin conexión']

  return (
    <span role="status" className="inline-flex items-center gap-2 rounded-full bg-crema-oscuro px-3 py-1.5 text-xs font-semibold text-noche">
      <span className={`size-2 rounded-full ${color}`} />
      {texto}
    </span>
  )
}
