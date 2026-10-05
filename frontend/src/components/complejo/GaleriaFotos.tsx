import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** Fotos del complejo: una tira que se desliza con el dedo; tocando una se ve en grande. */
export function GaleriaFotos({ fotos, nombre }: { fotos: string[]; nombre: string }) {
  const [abierta, setAbierta] = useState<number | null>(null)
  if (fotos.length === 0) return null
  return (
    <section aria-labelledby="fotos" className="mx-auto max-w-6xl px-4 pb-10 sm:px-8">
      <h3 id="fotos" className="numeros mb-3 text-[23px] font-bold" style={{ fontStretch: '80%' }}>
        Fotos
      </h3>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {fotos.map((url, i) => (
          <li key={url} className="flex-none snap-start">
            <button
              type="button"
              onClick={() => setAbierta(i)}
              aria-label={`Ver la foto ${i + 1} de ${fotos.length}`}
              className="block h-44 w-64 overflow-hidden rounded-xl ring-1 ring-borde sm:h-52 sm:w-80"
            >
              <img src={url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 hover:scale-[1.03]" />
            </button>
          </li>
        ))}
      </ul>
      {createPortal(
        <AnimatePresence>
          {abierta !== null && <FotoEnGrande fotos={fotos} nombre={nombre} indice={abierta} onCambiar={setAbierta} onCerrar={() => setAbierta(null)} />}
        </AnimatePresence>,
        document.body,
      )}
    </section>
  )
}

function FotoEnGrande({
  fotos,
  nombre,
  indice,
  onCambiar,
  onCerrar,
}: {
  fotos: string[]
  nombre: string
  indice: number
  onCambiar: (i: number) => void
  onCerrar: () => void
}) {
  const mover = (paso: number) => onCambiar((indice + paso + fotos.length) % fotos.length)
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
      if (e.key === 'ArrowRight') onCambiar((indice + 1) % fotos.length)
      if (e.key === 'ArrowLeft') onCambiar((indice - 1 + fotos.length) % fotos.length)
    }
    const scroll = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', alTeclear)
    return () => {
      document.body.style.overflow = scroll
      window.removeEventListener('keydown', alTeclear)
    }
  }, [indice, fotos.length, onCambiar, onCerrar])

  const flecha = 'absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70'
  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={`Fotos de ${nombre}`}
      className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCerrar}
    >
      <img
        src={fotos[indice]}
        alt={`Foto ${indice + 1} de ${fotos.length} de ${nombre}`}
        className="max-h-[88dvh] max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <button type="button" onClick={onCerrar} aria-label="Cerrar" className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70">
        <X className="size-6" aria-hidden="true" />
      </button>
      {fotos.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            className={`${flecha} left-3`}
            onClick={(e) => {
              e.stopPropagation()
              mover(-1)
            }}
          >
            <ChevronLeft className="size-6" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Foto siguiente"
            className={`${flecha} right-3`}
            onClick={(e) => {
              e.stopPropagation()
              mover(1)
            }}
          >
            <ChevronRight className="size-6" aria-hidden="true" />
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/80">
            {indice + 1} / {fotos.length}
          </p>
        </>
      )}
    </motion.div>
  )
}
