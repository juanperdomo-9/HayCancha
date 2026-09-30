import { Moon, Sun } from 'lucide-react'

import { cambiarModo, useModo } from '../theme/modo'

/** Botón del navbar para pasar de modo claro a oscuro y al revés. */
export function BotonModo({ className = '' }: { className?: string }) {
  const modo = useModo()
  const oscuro = modo === 'oscuro'
  return (
    <button
      type="button"
      onClick={() => cambiarModo(oscuro ? 'claro' : 'oscuro')}
      aria-label={oscuro ? 'Pasar a modo claro' : 'Pasar a modo oscuro'}
      title={oscuro ? 'Modo claro' : 'Modo oscuro'}
      className={`grid size-9 flex-none place-items-center rounded-full transition-colors ${className}`}
    >
      {oscuro ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon className="size-[18px]" aria-hidden="true" />}
    </button>
  )
}
