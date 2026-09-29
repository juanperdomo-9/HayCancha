import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useEffect } from 'react'

type Props = {
  abierta: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
}

/** Panel que se abre sobre la página: sube desde abajo en el celular y entra por la
 * derecha en la compu. Se cierra con Escape o tocando afuera. */
export function Hoja({ abierta, titulo, onCerrar, children }: Props) {
  useEffect(() => {
    if (!abierta) return
    const cerrarConEscape = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [abierta, onCerrar])

  return (
    <AnimatePresence>
      {abierta && (
        <>
          <motion.div
            key="fondo"
            className="fixed inset-0 z-40 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCerrar}
          />
          <motion.aside
            key="hoja"
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[22px] bg-crema text-noche shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-l-[22px]"
            initial={{ y: '100%', x: 0 }}
            animate={{ y: 0, x: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-crema/95 px-5 pt-4 pb-3 backdrop-blur">
              <h2 className="text-lg font-bold">{titulo}</h2>
              <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-9 place-items-center rounded-full bg-crema-oscuro hover:bg-linea">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="px-5 pb-[calc(24px+env(safe-area-inset-bottom))]">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
