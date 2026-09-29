import { useMemo, type CSSProperties, type ReactNode } from 'react'

import { temaComplejo, variablesTema } from './paleta'

type Props = {
  color: string
  secundario?: string | null
  className?: string
  children: ReactNode
}

/** Aplica los colores de un complejo a todo lo que tenga adentro. */
export function TemaComplejo({ color, secundario, className = '', children }: Props) {
  const estilo = useMemo(() => variablesTema(temaComplejo(color, secundario)) as CSSProperties, [color, secundario])
  return (
    <div className={`tema-complejo ${className}`} style={estilo}>
      {children}
    </div>
  )
}
