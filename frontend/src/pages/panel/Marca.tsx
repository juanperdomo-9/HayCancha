import { ImageUp, Plus, X } from 'lucide-react'
import { type FormEvent, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'

import { mensaje } from '../../api/client'
import { type Configuracion, useConfiguracion, useGuardarConfiguracion, useSubirImagen } from '../../api/panel'
import { LogoComplejo } from '../../components/complejo/LogoComplejo'
import { PortadaComplejo } from '../../components/complejo/PortadaComplejo'
import { Aviso, Boton, Campo, Tarjeta } from '../../components/ui/Formulario'
import { TemaComplejo } from '../../theme/TemaComplejo'
import { EncabezadoSeccion } from './EncabezadoSeccion'

const SERVICIOS_COMUNES = ['Vestuarios', 'Duchas', 'Estacionamiento', 'Bufé', 'Parrilla', 'Wi-Fi', 'Alquiler de pelotas', 'Alquiler de paletas']

export default function Marca() {
  const { slug = '' } = useParams()
  const configuracion = useConfiguracion(slug)
  if (configuracion.error) return <Aviso>{mensaje(configuracion.error)}</Aviso>
  if (!configuracion.data) return <p className="text-gris">Cargando…</p>
  return <FormularioMarca slug={slug} c={configuracion.data} />
}

function FormularioMarca({ slug, c }: { slug: string; c: Configuracion }) {
  const guardar = useGuardarConfiguracion(slug)
  const [datos, setDatos] = useState({
    nombre: c.nombre,
    direccion: c.direccion ?? '',
    barrio: c.barrio ?? '',
    color_primario: c.color_primario,
    servicios: c.servicios,
  })
  const [otroServicio, setOtroServicio] = useState('')
  const [ok, setOk] = useState(false)

  function alternar(servicio: string) {
    setOk(false)
    setDatos((d) => ({ ...d, servicios: d.servicios.includes(servicio) ? d.servicios.filter((s) => s !== servicio) : [...d.servicios, servicio] }))
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    setOk(false)
    guardar.mutate(
      { nombre: datos.nombre, direccion: datos.direccion || null, barrio: datos.barrio || null, color_primario: datos.color_primario.toUpperCase(), servicios: datos.servicios },
      { onSuccess: () => setOk(true) },
    )
  }

  const servicios = [...new Set([...SERVICIOS_COMUNES, ...datos.servicios])]

  return (
    <form onSubmit={enviar} className="grid gap-6">
      <EncabezadoSeccion
        titulo="Tu página"
        bajada={
          <>
            Lo que ven los jugadores en{' '}
            <Link to={`/${slug}`} className="font-semibold text-noche underline underline-offset-3">
              haycancha.com.ar/{slug}
            </Link>
            .
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="grid gap-6">
          <Tarjeta titulo="Datos del complejo">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre" required value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} className="sm:col-span-2" />
              <Campo etiqueta="Dirección" placeholder="Av. Triunvirato 4820" value={datos.direccion} onChange={(e) => setDatos({ ...datos, direccion: e.target.value })} />
              <Campo etiqueta="Barrio" placeholder="Villa Urquiza" value={datos.barrio} onChange={(e) => setDatos({ ...datos, barrio: e.target.value })} />
            </div>
          </Tarjeta>
          <Tarjeta titulo="Servicios" descripcion="Tocá los que tiene tu complejo.">
            <div className="flex flex-wrap gap-2">
              {servicios.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={datos.servicios.includes(s)}
                  onClick={() => alternar(s)}
                  className="rounded-full bg-white px-3.5 py-1.5 text-sm ring-1 ring-linea aria-pressed:bg-complejo aria-pressed:text-complejo-sobre aria-pressed:ring-complejo"
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={otroServicio}
                onChange={(e) => setOtroServicio(e.target.value)}
                placeholder="Otro servicio"
                aria-label="Otro servicio"
                className="w-full max-w-xs rounded-[10px] border-[1.5px] border-linea bg-white px-3 py-2 text-[15px]"
              />
              <Boton
                variante="suave"
                disabled={!otroServicio.trim()}
                onClick={() => {
                  alternar(otroServicio.trim())
                  setOtroServicio('')
                }}
              >
                <Plus className="size-4" aria-hidden="true" />
                Sumar
              </Boton>
            </div>
          </Tarjeta>
          <Tarjeta titulo="Logo, portada y color">
            <div className="grid gap-5 sm:grid-cols-2">
              <SubirImagen slug={slug} tipo="logo" titulo="Logo" ayuda="Cuadrado, en PNG con fondo transparente." url={c.logo_url} />
              <SubirImagen slug={slug} tipo="portada" titulo="Foto de portada" ayuda="Horizontal, de día y con buena luz." url={c.portada_url} />
              <div className="grid gap-1.5 sm:col-span-2">
                <label htmlFor="color" className="text-[13px] font-semibold">
                  Color del complejo
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="color"
                    type="color"
                    value={datos.color_primario}
                    onChange={(e) => setDatos({ ...datos, color_primario: e.target.value })}
                    className="size-11 cursor-pointer rounded-lg border-[1.5px] border-linea bg-white p-1"
                  />
                  <code className="text-sm text-gris">{datos.color_primario.toUpperCase()}</code>
                  <span className="text-[12.5px] text-gris">Se usa en botones y detalles; la página se ajusta sola para que se lea bien.</span>
                </div>
              </div>
            </div>
          </Tarjeta>
          <div className="grid gap-3">
            {guardar.error && <Aviso>{mensaje(guardar.error)}</Aviso>}
            {ok && <Aviso tipo="ok">Guardado. Ya se ve en tu página.</Aviso>}
            <Boton type="submit" cargando={guardar.isPending} className="justify-self-start px-6 py-3 text-base">
              Guardar cambios
            </Boton>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6" aria-label="Vista previa">
          <p className="mb-2 text-xs font-semibold tracking-[.1em] text-gris uppercase">Así se ve</p>
          <TemaComplejo color={datos.color_primario} className="overflow-hidden rounded-2xl bg-lienzo text-tinta ring-1 ring-linea">
            <div className="relative isolate h-40 bg-oscuro">
              <PortadaComplejo portadaUrl={c.portada_url} deporte="futbol7" className="absolute inset-0 -z-10" />
              <div className="absolute inset-0 -z-10 bg-linear-to-t from-oscuro/90 to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-end gap-2.5">
                <LogoComplejo nombre={datos.nombre || c.nombre} logoUrl={c.logo_url} className="w-12 text-[48px]" />
                <b className="numeros text-2xl leading-none text-white" style={{ fontStretch: '72%' }}>
                  {datos.nombre || c.nombre}
                </b>
              </div>
            </div>
            <div className="grid gap-3 p-4">
              <div className="grid grid-cols-3 gap-2">
                {['20:00', '21:00', '22:00'].map((hora, i) => (
                  <span
                    key={hora}
                    className={`numeros rounded-lg border-[1.5px] px-2 py-2 text-lg font-bold ${i === 1 ? 'border-complejo bg-complejo text-complejo-sobre' : 'border-borde bg-superficie'}`}
                  >
                    {hora}
                  </span>
                ))}
              </div>
              <span className="rounded-lg bg-complejo px-3 py-2.5 text-center text-sm font-bold text-complejo-sobre">Reservar</span>
              <span className="text-sm font-semibold text-complejo-texto">Seña para reservar</span>
            </div>
          </TemaComplejo>
        </aside>
      </div>
    </form>
  )
}

function SubirImagen({ slug, tipo, titulo, ayuda, url }: { slug: string; tipo: 'logo' | 'portada'; titulo: string; ayuda: string; url: string | null }) {
  const subir = useSubirImagen(slug, tipo)
  const entrada = useRef<HTMLInputElement>(null)
  return (
    <div className="grid content-start gap-2">
      <span className="text-[13px] font-semibold">{titulo}</span>
      <button
        type="button"
        onClick={() => entrada.current?.click()}
        className={`group relative grid place-items-center overflow-hidden rounded-xl border-[1.5px] border-dashed border-linea bg-white text-sm text-gris hover:border-noche ${tipo === 'logo' ? 'aspect-square max-w-40' : 'aspect-[16/9]'}`}
      >
        {url ? (
          <img src={url} alt="" className={`absolute inset-0 size-full ${tipo === 'logo' ? 'object-contain p-2' : 'object-cover'}`} />
        ) : (
          <span className="flex flex-col items-center gap-1.5 p-3 text-center">
            <ImageUp className="size-6" aria-hidden="true" />
            {subir.isPending ? 'Subiendo…' : 'Elegir imagen'}
          </span>
        )}
        {url && (
          <span className="absolute inset-x-0 bottom-0 bg-noche/70 py-1.5 text-center text-xs font-semibold text-cal opacity-0 transition-opacity group-hover:opacity-100">
            {subir.isPending ? 'Subiendo…' : 'Cambiar'}
          </span>
        )}
      </button>
      <input
        ref={entrada}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          if (archivo) subir.mutate(archivo)
          e.target.value = ''
        }}
      />
      <span className="text-[12.5px] text-gris">{ayuda}</span>
      {subir.error && (
        <p role="alert" className="flex items-center gap-1 text-[12.5px] text-red-700">
          <X className="size-3.5" aria-hidden="true" />
          {mensaje(subir.error)}
        </p>
      )}
    </div>
  )
}
