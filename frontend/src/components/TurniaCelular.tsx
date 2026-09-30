import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

const TURNIA = 'https://landing-marca.onrender.com/'

/** Abre la web de Turnia (la marca de HayCancha) dentro de un celular, sin salir de la página:
 * el fondo se difumina y el celular aparece en el medio. */
export function BotonTurnia({ className = '', children }: { className?: string; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className={className}>
        {children}
      </button>
      {createPortal(
        <AnimatePresence>{abierto && <CelularTurnia onCerrar={() => setAbierto(false)} />}</AnimatePresence>,
        document.body,
      )}
    </>
  )
}

function CelularTurnia({ onCerrar }: { onCerrar: () => void }) {
  const [cargado, setCargado] = useState(false)
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    const scroll = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', alTeclear)
    return () => {
      document.body.style.overflow = scroll
      window.removeEventListener('keydown', alTeclear)
    }
  }, [onCerrar])

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Turnia"
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/40 p-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCerrar}
    >
      <motion.div
        className="relative flex flex-col items-center gap-3"
        initial={{ opacity: 0, y: 40, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute -top-2 -right-2 z-10 grid size-10 place-items-center rounded-full bg-white text-noche shadow-lg sm:-right-14 sm:top-0"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
        {/* El celular */}
        <div className="relative h-[min(760px,82dvh)] w-[min(372px,88vw)] rounded-[48px] bg-[#0d0f14] p-[10px] shadow-[0_40px_90px_-20px_rgba(0,0,0,.7),inset_0_0_0_2px_rgba(255,255,255,.08)]">
          <div className="absolute top-[18px] left-1/2 z-10 h-[26px] w-[104px] -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
          {!cargado && (
            <div className="absolute inset-[10px] grid place-content-center justify-items-center gap-3 rounded-[38px] bg-white text-sm text-gris">
              <span className="size-7 animate-spin rounded-full border-3 border-linea border-t-noche" aria-hidden="true" />
              Cargando Turnia…
            </div>
          )}
          <iframe title="Turnia" src={TURNIA} onLoad={() => setCargado(true)} className="size-full rounded-[38px] border-0 bg-white" />
        </div>
        <a href={TURNIA} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-white/85 underline underline-offset-3 hover:text-white">
          Abrir Turnia en otra pestaña
        </a>
      </motion.div>
    </motion.div>
  )
}
