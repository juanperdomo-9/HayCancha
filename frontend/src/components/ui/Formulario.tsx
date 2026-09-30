import { Check, Copy } from 'lucide-react'
import { type ComponentProps, type ReactNode, useId, useState } from 'react'

/** Piezas de formulario del panel y /admin (marca HayCancha: crema, noche, césped). */

type CampoProps = ComponentProps<'input'> & {
  etiqueta: string
  ayuda?: ReactNode
  error?: string | null
  prefijo?: string
}

export function Campo({ etiqueta, ayuda, error, prefijo, className = '', ...props }: CampoProps) {
  const id = useId()
  return (
    <div className={`grid content-start gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-semibold">
        {etiqueta}
      </label>
      <div className="flex items-stretch overflow-hidden rounded-[10px] border-[1.5px] border-linea bg-white focus-within:border-cesped focus-within:shadow-[0_0_0_3px_rgba(30,122,62,.15)] aria-invalid:border-red-600" aria-invalid={Boolean(error)}>
        {prefijo && <span className="flex items-center bg-crema-oscuro/60 px-3 text-[15px] text-gris">{prefijo}</span>}
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error || ayuda ? `${id}-ayuda` : undefined}
          className="w-full min-w-0 bg-transparent px-3 py-2.5 text-[16px] text-noche outline-none"
          {...props}
        />
      </div>
      {(error || ayuda) && (
        <p id={`${id}-ayuda`} className={`text-[12.5px] ${error ? 'text-red-700' : 'text-gris'}`}>
          {error ?? ayuda}
        </p>
      )}
    </div>
  )
}

type BotonProps = ComponentProps<'button'> & {
  variante?: 'principal' | 'secundario' | 'suave' | 'peligro'
  cargando?: boolean
}

const VARIANTES = {
  principal: 'bg-noche text-crema hover:bg-noche/90',
  secundario: 'bg-transparent text-noche ring-[1.5px] ring-inset ring-noche hover:bg-noche hover:text-crema',
  suave: 'bg-crema-oscuro/70 text-noche hover:bg-crema-oscuro',
  peligro: 'bg-transparent text-red-700 ring-[1.5px] ring-inset ring-red-700/40 hover:bg-red-50',
}

export function Boton({ variante = 'principal', cargando = false, className = '', children, disabled, ...props }: BotonProps) {
  return (
    <button
      type="button"
      disabled={disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {cargando ? 'Guardando…' : children}
    </button>
  )
}

export function Aviso({ tipo = 'error', children }: { tipo?: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const estilos = {
    error: 'bg-red-50 text-red-800 ring-red-200',
    ok: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
    info: 'bg-crema-oscuro/60 text-noche ring-linea',
  }[tipo]
  return (
    <p role={tipo === 'error' ? 'alert' : 'status'} className={`rounded-xl px-3.5 py-2.5 text-sm ring-1 ${estilos}`}>
      {children}
    </p>
  )
}

/** Muestra un link y lo copia al portapapeles (para mandarlo por mail o mensaje). */
export function CopiarLink({ link, etiqueta = 'Link para elegir la contraseña' }: { link: string; etiqueta?: string }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2500)
    } catch {
      setCopiado(false)
    }
  }
  return (
    <div className="grid gap-1.5">
      <span className="text-[13px] font-semibold">{etiqueta}</span>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full min-w-0 rounded-[10px] border-[1.5px] border-linea bg-white px-3 py-2 text-[13px] text-gris"
          aria-label={etiqueta}
        />
        <Boton variante="suave" onClick={copiar} className="flex-none" aria-live="polite">
          {copiado ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </Boton>
      </div>
      <span className="text-[12px] text-gris">Ya se lo mandamos por email. Si no le llega, pasale este link. Vence en 7 días y sirve una sola vez.</span>
    </div>
  )
}

export function Tarjeta({ titulo, descripcion, children, className = '' }: { titulo?: string; descripcion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-cal p-5 ring-1 ring-linea sm:p-6 ${className}`}>
      {titulo && <h2 className="text-lg font-bold">{titulo}</h2>}
      {descripcion && <p className="mt-1 text-sm text-gris">{descripcion}</p>}
      <div className={titulo || descripcion ? 'mt-4' : ''}>{children}</div>
    </section>
  )
}
