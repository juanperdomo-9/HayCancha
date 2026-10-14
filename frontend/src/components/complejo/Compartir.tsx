import { Check, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'

/** El link para compartir un complejo: /c/{slug} muestra en WhatsApp e Instagram la vista
 * previa de ese complejo (su nombre y su foto) y lleva a su página. */
function linkParaCompartir(slug: string) {
  return `${window.location.origin}/c/${slug}`
}

/** Botón "Compartir": en el celular abre el menú para compartir; en la compu copia el link. */
export function BotonCompartir({ slug, nombre, className = '' }: { slug: string; nombre: string; className?: string }) {
  const [copiado, setCopiado] = useState(false)

  async function compartir() {
    const url = linkParaCompartir(slug)
    if (navigator.share) {
      try {
        await navigator.share({ title: nombre, text: `Reservá tu cancha en ${nombre}`, url })
        return
      } catch {
        // Lo cerró sin compartir, o el navegador no pudo: se copia el link.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      window.prompt('Copiá el link:', url)
    }
  }

  return (
    <button type="button" onClick={compartir} className={`inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap ${className}`}>
      {copiado ? <Check className="size-4" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
      {copiado ? 'Link copiado' : 'Compartir'}
    </button>
  )
}

/** Panel: el link para compartir, con botón de copiar. */
export function LinkParaCompartir({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false)
  const url = linkParaCompartir(slug)
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 rounded-xl border-[1.5px] border-linea bg-superficie p-1.5 pl-3.5">
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{url.replace(/^https?:\/\//, '')}</span>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
          }}
          className="inline-flex flex-none items-center gap-1.5 rounded-lg bg-noche px-3 py-2 text-sm font-semibold text-crema"
        >
          {copiado ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <p className="text-[12.5px] text-gris">
        Usá este link en tu Instagram, tus estados y el grupo de tus clientes: en WhatsApp se ve con el nombre y la portada de tu complejo.
      </p>
    </div>
  )
}
