import { ChevronLeft, ChevronRight, Images, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/** Botón sobre la portada: "Ver fotos · 8". */
export function BotonVerFotos({ cantidad, onAbrir }: { cantidad: number; onAbrir: () => void }) {
  if (cantidad === 0) return null
  return (
    <button
      type="button"
      onClick={onAbrir}
      className="inline-flex items-center gap-2 rounded-full bg-white/92 px-4 py-2.5 text-sm font-semibold text-[#14231A] shadow-[0_8px_24px_rgba(0,0,0,.35)] backdrop-blur transition-transform hover:-translate-y-0.5"
    >
      <Images className="size-4" aria-hidden="true" />
      Ver fotos · {cantidad}
    </button>
  )
}

const VISIBLES = 5

/** Las fotos del complejo: mosaico en la compu (una grande y cuatro chicas) y carrusel
 * grande en el celular. Tocando cualquiera se abre el visor. */
export function GaleriaFotos({ fotos, nombre, onAbrir }: { fotos: string[]; nombre: string; onAbrir: (indice: number) => void }) {
  if (fotos.length === 0) return null
  const resto = fotos.length - VISIBLES
  return (
    <section aria-labelledby="fotos" className="mx-auto max-w-6xl px-4 pt-2 pb-12 sm:px-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <h3 id="fotos" className="numeros text-[clamp(26px,4vw,34px)] leading-none font-bold" style={{ fontStretch: '78%' }}>
          Conocé el complejo
        </h3>
        <button type="button" onClick={() => onAbrir(0)} className="text-sm font-semibold whitespace-nowrap text-complejo-texto hover:underline">
          Ver las {fotos.length} fotos
        </button>
      </div>

      {/* Celular: carrusel de fotos grandes. */}
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:hidden">
        {fotos.map((url, i) => (
          <li key={url} className="relative w-[86%] flex-none snap-center">
            <button type="button" onClick={() => onAbrir(i)} aria-label={`Ver la foto ${i + 1} de ${fotos.length}`} className="block w-full">
              <img src={url} alt="" loading="lazy" className="aspect-[4/3] w-full rounded-2xl object-cover ring-1 ring-borde" />
            </button>
            <span className="pointer-events-none absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white tabular-nums">
              {i + 1}/{fotos.length}
            </span>
          </li>
        ))}
      </ul>

      {/* Compu: mosaico. */}
      <div className={`hidden h-[clamp(320px,38vw,460px)] gap-2.5 sm:grid ${mosaico(fotos.length)}`}>
        {fotos.slice(0, VISIBLES).map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => onAbrir(i)}
            aria-label={`Ver la foto ${i + 1} de ${fotos.length}`}
            className={`group relative overflow-hidden ring-1 ring-borde ${celda(fotos.length, i)}`}
          >
            <img src={url} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-[1.04]" />
            <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            {i === VISIBLES - 1 && resto > 0 && (
              <span className="absolute inset-0 grid place-content-center bg-black/55 text-white">
                <b className="numeros text-3xl" style={{ fontStretch: '80%' }}>
                  +{resto}
                </b>
                <span className="text-sm font-semibold">fotos</span>
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="sr-only">Fotos de {nombre}</p>
    </section>
  )
}

function mosaico(n: number) {
  if (n === 1) return 'grid-cols-1 rounded-3xl overflow-hidden'
  if (n === 2) return 'grid-cols-2 rounded-3xl overflow-hidden'
  return 'grid-cols-4 grid-rows-2 rounded-3xl overflow-hidden'
}

function celda(n: number, i: number) {
  if (n <= 2) return ''
  if (i === 0) return 'col-span-2 row-span-2'
  if (n === 3) return 'col-span-2'
  if (n === 4 && i === 1) return 'col-span-2'
  return ''
}

/** Visor a pantalla completa: se desliza con el dedo, flechas y teclado, miniaturas abajo. */
export function VisorDeFotos({
  fotos,
  nombre,
  indice,
  onCambiar,
  onCerrar,
}: {
  fotos: string[]
  nombre: string
  indice: number | null
  onCambiar: (i: number) => void
  onCerrar: () => void
}) {
  return createPortal(
    <AnimatePresence>
      {indice !== null && <Visor fotos={fotos} nombre={nombre} indice={indice} onCambiar={onCambiar} onCerrar={onCerrar} />}
    </AnimatePresence>,
    document.body,
  )
}

function Visor({ fotos, nombre, indice, onCambiar, onCerrar }: { fotos: string[]; nombre: string; indice: number; onCambiar: (i: number) => void; onCerrar: () => void }) {
  const quieto = useReducedMotion()
  const total = fotos.length
  const ir = (paso: number) => onCambiar((indice + paso + total) % total)

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowRight') onCambiar((indice + 1) % total)
      if (e.key === 'ArrowLeft') onCambiar((indice - 1 + total) % total)
    }
    const scroll = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', alTeclear)
    return () => {
      document.body.style.overflow = scroll
      window.removeEventListener('keydown', alTeclear)
    }
  }, [indice, total, onCambiar, onCerrar])

  const flecha = 'absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/12 text-white backdrop-blur hover:bg-white/25 sm:grid'
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${nombre}`}
      className="fixed inset-0 z-50 flex flex-col bg-[#0b120e]/95 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-semibold tabular-nums text-white/80">
          {nombre} · {indice + 1} / {total}
        </span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-11 place-items-center rounded-full bg-white/12 hover:bg-white/25">
          <X className="size-6" aria-hidden="true" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1" onClick={onCerrar}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.img
            key={fotos[indice]}
            src={fotos[indice]}
            alt={`Foto ${indice + 1} de ${total} de ${nombre}`}
            className="absolute inset-0 m-auto max-h-full max-w-full touch-pan-y object-contain px-2 select-none sm:px-20"
            initial={quieto ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            drag={total > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) ir(1)
              else if (info.offset.x > 60) ir(-1)
            }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </AnimatePresence>
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto anterior"
              className={`${flecha} left-4`}
              onClick={(e) => {
                e.stopPropagation()
                ir(-1)
              }}
            >
              <ChevronLeft className="size-7" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Foto siguiente"
              className={`${flecha} right-4`}
              onClick={(e) => {
                e.stopPropagation()
                ir(1)
              }}
            >
              <ChevronRight className="size-7" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <ul className="mx-auto flex max-w-full gap-2 overflow-x-auto px-4 py-4 [scrollbar-width:none]">
          {fotos.map((url, i) => (
            <li key={url} className="flex-none">
              <button
                type="button"
                onClick={() => onCambiar(i)}
                aria-label={`Ir a la foto ${i + 1}`}
                aria-current={i === indice}
                className={`block h-14 w-20 overflow-hidden rounded-lg transition sm:h-16 sm:w-24 ${i === indice ? 'opacity-100 ring-2 ring-white' : 'opacity-45 hover:opacity-80'}`}
              >
                <img src={url} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}
