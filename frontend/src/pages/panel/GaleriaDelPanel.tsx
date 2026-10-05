import { ChevronLeft, ChevronRight, ImageUp, Trash2 } from 'lucide-react'
import { useRef } from 'react'

import { mensaje } from '../../api/client'
import { MAX_FOTOS, useFotos, useOrdenarFotos, useQuitarFoto, useSubirFoto } from '../../api/panel'
import { Aviso, Tarjeta } from '../../components/ui/Formulario'

/** Panel → Marca: la galería de fotos de la página del complejo. */
export function GaleriaDelPanel({ slug }: { slug: string }) {
  const fotos = useFotos(slug)
  const subir = useSubirFoto(slug)
  const quitar = useQuitarFoto(slug)
  const ordenar = useOrdenarFotos(slug)
  const entrada = useRef<HTMLInputElement>(null)
  const lista = fotos.data ?? []
  const lleno = lista.length >= MAX_FOTOS

  function mover(i: number, paso: number) {
    const ids = lista.map((f) => f.id)
    ;[ids[i], ids[i + paso]] = [ids[i + paso], ids[i]]
    ordenar.mutate(ids)
  }

  async function elegir(archivos: FileList | null) {
    // De a una, para no pasarse del tope y mostrar el error de la que falle.
    for (const archivo of Array.from(archivos ?? []).slice(0, MAX_FOTOS - lista.length)) {
      try {
        await subir.mutateAsync(archivo)
      } catch {
        break
      }
    }
  }

  const boton = 'grid size-8 place-items-center rounded-full bg-noche/75 text-cal hover:bg-noche disabled:opacity-30'
  return (
    <Tarjeta titulo="Fotos" descripcion={`Hasta ${MAX_FOTOS}: las canchas, el buffet, los vestuarios. La primera es la que se ve primero.`}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {lista.map((foto, i) => (
          <li key={foto.id} className="relative aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-linea">
            <img src={foto.url} alt={`Foto ${i + 1}`} className="size-full object-cover" />
            <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between">
              <span className="flex gap-1">
                <button type="button" className={boton} aria-label="Mover antes" disabled={i === 0 || ordenar.isPending} onClick={() => mover(i, -1)}>
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={boton}
                  aria-label="Mover después"
                  disabled={i === lista.length - 1 || ordenar.isPending}
                  onClick={() => mover(i, 1)}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </span>
              <button type="button" className={boton} aria-label="Quitar la foto" disabled={quitar.isPending} onClick={() => quitar.mutate(foto.id)}>
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
        {!lleno && (
          <li>
            <button
              type="button"
              onClick={() => entrada.current?.click()}
              disabled={subir.isPending}
              className="grid aspect-[4/3] w-full place-items-center rounded-xl border-[1.5px] border-dashed border-linea bg-superficie text-sm text-gris hover:border-noche"
            >
              <span className="flex flex-col items-center gap-1.5">
                <ImageUp className="size-6" aria-hidden="true" />
                {subir.isPending ? 'Subiendo…' : 'Sumar fotos'}
              </span>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={entrada}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          elegir(e.target.files)
          e.target.value = ''
        }}
      />
      {(subir.error || quitar.error || fotos.error) && <Aviso>{mensaje(subir.error ?? quitar.error ?? fotos.error)}</Aviso>}
    </Tarjeta>
  )
}
