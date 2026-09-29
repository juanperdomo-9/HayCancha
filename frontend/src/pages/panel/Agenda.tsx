import { Link, useParams } from 'react-router'

import { usePanel } from '../../api/panel'
import { Tarjeta } from '../../components/ui/Formulario'

/** La agenda del día llega en el bloque 1D. Mientras, atajos para dejar el complejo listo. */
export default function Agenda() {
  const { slug = '' } = useParams()
  const { data: panel } = usePanel(slug)
  const esDueno = panel?.rol !== 'empleado'

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="font-titulo text-[clamp(40px,6vw,60px)] leading-[.9] font-extrabold uppercase">Agenda</h1>
        <p className="mt-2 text-gris">Muy pronto vas a ver acá los turnos del día, cancha por cancha, y cargar reservas por teléfono.</p>
      </div>
      {esDueno && (
        <Tarjeta titulo="Dejá tu complejo listo" descripcion="Con esto tu página ya muestra horarios y precios.">
          <ol className="grid gap-2.5 sm:grid-cols-3">
            {[
              ['canchas', '1. Cargá tus canchas'],
              ['horarios', '2. Poné horarios y precios'],
              ['marca', '3. Sumá tu logo y colores'],
            ].map(([ruta, texto]) => (
              <li key={ruta}>
                <Link
                  to={`/panel/${slug}/${ruta}`}
                  className="block rounded-xl bg-white px-4 py-3 font-semibold ring-1 ring-linea transition hover:-translate-y-0.5 hover:ring-complejo"
                >
                  {texto}
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm text-gris">
            Tu página pública:{' '}
            <Link to={`/${slug}`} className="font-semibold text-complejo-texto underline underline-offset-3">
              haycancha.com.ar/{slug}
            </Link>
          </p>
        </Tarjeta>
      )}
    </div>
  )
}
