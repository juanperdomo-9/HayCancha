import { type FormEvent, useState } from 'react'
import { Link } from 'react-router'

import { mensaje } from '../../api/client'
import { type AltaDeComplejo, useAltaDeComplejo } from '../../api/panel'
import { Aviso, Boton, Campo, CopiarLink, Tarjeta } from '../../components/ui/Formulario'

const SERVICIOS = ['Vestuarios', 'Duchas', 'Estacionamiento', 'Bufé', 'Parrilla', 'Wi-Fi', 'Alquiler de pelotas', 'Alquiler de paletas']

/** "Pádel Norte & Co." -> "padel-norte-co" (igual que sugerir_slug en el backend). */
function sugerirSlug(nombre: string): string {
  return nombre
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

/** Alta de un complejo, en el mismo orden que el formulario que completa el dueño. */
export default function NuevoComplejo() {
  const alta = useAltaDeComplejo()
  const [slugTocado, setSlugTocado] = useState(false)
  const [datos, setDatos] = useState({
    nombre: '',
    slug: '',
    direccion: '',
    barrio: '',
    referencia: '',
    servicios: [] as string[],
    dueno_email: '',
    sena_tipo: 'porcentaje' as AltaDeComplejo['sena_tipo'],
    sena_valor: '20',
    horas_cancelacion: '',
    minutos_para_pagar: '10',
    color_primario: '#1E7A3E',
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    alta.mutate({
      ...datos,
      direccion: datos.direccion || undefined,
      barrio: datos.barrio || undefined,
      referencia: datos.referencia || undefined,
      sena_valor: datos.sena_valor || '0',
      horas_cancelacion: Number(datos.horas_cancelacion),
      minutos_para_pagar: Number(datos.minutos_para_pagar),
      color_primario: datos.color_primario.toUpperCase(),
    })
  }

  if (alta.data) {
    const { complejo, link_dueno } = alta.data
    return (
      <div className="grid max-w-2xl gap-5">
        <h1 className="font-titulo text-[clamp(40px,6vw,60px)] leading-[.9] font-extrabold uppercase">¡{complejo.nombre} ya está adentro!</h1>
        <Aviso tipo="ok">
          Creamos el complejo y la cuenta de <b>{complejo.dueno_email}</b>. Mandale este link para que elija su contraseña.
        </Aviso>
        <CopiarLink link={link_dueno} />
        <Tarjeta titulo="Siguiente paso" descripcion="Cargá sus canchas y horarios con las respuestas del formulario.">
          <div className="flex flex-wrap gap-2">
            <Link to={`/panel/${complejo.slug}/canchas`} className="rounded-xl bg-noche px-4 py-2.5 font-semibold text-crema hover:bg-noche/90">
              Cargar canchas y horarios
            </Link>
            <Link to="/admin" className="rounded-xl px-4 py-2.5 font-semibold ring-[1.5px] ring-noche ring-inset hover:bg-noche hover:text-crema">
              Volver a complejos
            </Link>
          </div>
        </Tarjeta>
      </div>
    )
  }

  return (
    <form onSubmit={enviar} className="grid max-w-3xl gap-6">
      <div>
        <Link to="/admin" className="text-sm font-semibold text-gris hover:text-noche">
          ← Complejos
        </Link>
        <h1 className="mt-2 font-titulo text-[clamp(40px,6vw,60px)] leading-[.9] font-extrabold uppercase">Alta de complejo</h1>
        <p className="mt-2 text-gris">En el mismo orden que el formulario de alta. Las canchas y los horarios se cargan después, desde su panel.</p>
      </div>

      <Tarjeta titulo="1. El complejo">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Nombre"
            required
            className="sm:col-span-2"
            value={datos.nombre}
            onChange={(e) => setDatos({ ...datos, nombre: e.target.value, slug: slugTocado ? datos.slug : sugerirSlug(e.target.value) })}
          />
          <Campo
            etiqueta="Dirección de su página"
            prefijo="haycancha.com.ar/"
            required
            className="sm:col-span-2"
            value={datos.slug}
            onChange={(e) => {
              setSlugTocado(true)
              setDatos({ ...datos, slug: e.target.value.toLowerCase() })
            }}
            ayuda="Minúsculas, números y guiones. Por ejemplo, el-potrero."
          />
          <Campo etiqueta="Dirección" value={datos.direccion} onChange={(e) => setDatos({ ...datos, direccion: e.target.value })} />
          <Campo etiqueta="Barrio o ciudad" value={datos.barrio} onChange={(e) => setDatos({ ...datos, barrio: e.target.value })} />
          <Campo
            etiqueta="Referencia para llegar"
            placeholder="Al lado de la YPF"
            className="sm:col-span-2"
            value={datos.referencia}
            onChange={(e) => setDatos({ ...datos, referencia: e.target.value })}
          />
        </div>
        <fieldset className="mt-4">
          <legend className="mb-2 text-[13px] font-semibold">Servicios</legend>
          <div className="flex flex-wrap gap-2">
            {SERVICIOS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={datos.servicios.includes(s)}
                onClick={() =>
                  setDatos({ ...datos, servicios: datos.servicios.includes(s) ? datos.servicios.filter((x) => x !== s) : [...datos.servicios, s] })
                }
                className="rounded-full bg-white px-3.5 py-1.5 text-sm ring-1 ring-linea aria-pressed:bg-noche aria-pressed:text-crema aria-pressed:ring-noche"
              >
                {s}
              </button>
            ))}
          </div>
        </fieldset>
      </Tarjeta>

      <Tarjeta titulo="2. El dueño" descripcion="Con este email entra a su panel. Le vas a pasar un link para que elija su contraseña.">
        <Campo etiqueta="Email del dueño" type="email" required value={datos.dueno_email} onChange={(e) => setDatos({ ...datos, dueno_email: e.target.value })} />
      </Tarjeta>

      <Tarjeta titulo="3. Seña y cancelación" descripcion="Lo habitual es 20% de seña. La cancelación se acuerda con cada complejo.">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-[13px] font-semibold">
            Tipo de seña
            <select
              value={datos.sena_tipo}
              onChange={(e) => setDatos({ ...datos, sena_tipo: e.target.value as AltaDeComplejo['sena_tipo'] })}
              className="rounded-[10px] border-[1.5px] border-linea bg-white px-3 py-[11px] text-[16px] font-normal"
            >
              <option value="porcentaje">Porcentaje del turno</option>
              <option value="fija">Monto fijo</option>
            </select>
          </label>
          <Campo
            etiqueta={datos.sena_tipo === 'porcentaje' ? 'Porcentaje' : 'Monto'}
            prefijo={datos.sena_tipo === 'porcentaje' ? '%' : '$'}
            type="number"
            min={0}
            required
            value={datos.sena_valor}
            onChange={(e) => setDatos({ ...datos, sena_valor: e.target.value })}
          />
          <Campo
            etiqueta="Horas para cancelar con devolución"
            type="number"
            min={0}
            required
            placeholder="Acordalo con el complejo"
            value={datos.horas_cancelacion}
            onChange={(e) => setDatos({ ...datos, horas_cancelacion: e.target.value })}
          />
          <Campo
            etiqueta="Minutos para pagar la seña"
            type="number"
            min={1}
            max={120}
            required
            value={datos.minutos_para_pagar}
            onChange={(e) => setDatos({ ...datos, minutos_para_pagar: e.target.value })}
          />
        </div>
      </Tarjeta>

      <Tarjeta titulo="4. Color" descripcion="El logo y la portada los sube el dueño (o vos) desde su panel.">
        <div className="flex items-center gap-3">
          <input
            type="color"
            aria-label="Color del complejo"
            value={datos.color_primario}
            onChange={(e) => setDatos({ ...datos, color_primario: e.target.value })}
            className="size-11 cursor-pointer rounded-lg border-[1.5px] border-linea bg-white p-1"
          />
          <code className="text-sm text-gris">{datos.color_primario.toUpperCase()}</code>
        </div>
      </Tarjeta>

      <div className="grid gap-3">
        {alta.error && <Aviso>{mensaje(alta.error)}</Aviso>}
        <Boton type="submit" cargando={alta.isPending} className="justify-self-start px-6 py-3 text-base">
          Dar de alta
        </Boton>
      </div>
    </form>
  )
}
