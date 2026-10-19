import { Check, Copy, Download, Share2 } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

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

/** Panel: el QR del link del complejo, para imprimir y pegar en la cancha o en la caja.
 * Se descarga un cartel listo para imprimir, con el nombre del complejo y el link. */
export function QrDelComplejo({ slug, nombre, color }: { slug: string; nombre: string; color: string }) {
  const url = linkParaCompartir(slug)
  const [imagen, setImagen] = useState<string | null>(null)

  useEffect(() => {
    // Corrección de errores alta: se sigue leyendo aunque el papel se gaste o se manche.
    QRCode.toDataURL(url, { errorCorrectionLevel: 'H', margin: 1, width: 480, color: { dark: '#14231A', light: '#FFFFFF' } }).then(setImagen)
  }, [url])

  async function descargarCartel() {
    const ancho = 1240 // A6 a 300 ppp, más o menos
    const alto = 1748
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const c = lienzo.getContext('2d')!
    c.fillStyle = '#FFFFFF'
    c.fillRect(0, 0, ancho, alto)
    c.fillStyle = color
    c.fillRect(0, 0, ancho, 36)
    c.fillStyle = '#14231A'
    c.textAlign = 'center'
    c.font = '800 92px "Big Shoulders Display", "Arial Narrow", sans-serif'
    c.fillText('RESERVÁ TU CANCHA', ancho / 2, 210)
    c.font = '600 58px "Instrument Sans", system-ui, sans-serif'
    c.fillText(nombre, ancho / 2, 300, ancho - 160)
    const qr = document.createElement('canvas')
    await QRCode.toCanvas(qr, url, { errorCorrectionLevel: 'H', margin: 2, width: 900, color: { dark: '#14231A', light: '#FFFFFF' } })
    c.drawImage(qr, (ancho - 900) / 2, 380)
    c.font = '500 44px "Instrument Sans", system-ui, sans-serif'
    c.fillStyle = '#5A6157'
    c.fillText('Escaneá con la cámara del celular', ancho / 2, 1360)
    c.fillStyle = '#1E7A3E'
    c.font = '700 50px "Instrument Sans", system-ui, sans-serif'
    c.fillText(url.replace(/^https?:\/\//, ''), ancho / 2, 1450, ancho - 120)
    c.fillStyle = '#5A6157'
    c.font = '500 36px "Instrument Sans", system-ui, sans-serif'
    c.fillText('Horarios libres y seña online en HayCanchas', ancho / 2, 1640)
    const a = document.createElement('a')
    a.href = lienzo.toDataURL('image/png')
    a.download = `qr-${slug}.png`
    a.click()
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="grid size-36 flex-none place-items-center overflow-hidden rounded-xl bg-white p-1.5 ring-1 ring-linea">
        {imagen ? <img src={imagen} alt={`Código QR de ${nombre}`} className="size-full" /> : <span className="text-xs text-gris">Armando…</span>}
      </div>
      <div className="grid max-w-xs gap-2">
        <p className="text-[13.5px] text-gris">
          Imprimilo y pegalo en la cancha, la caja o el buffet: lo escanean con el celular y llegan a tu página para reservar.
        </p>
        <button
          type="button"
          onClick={descargarCartel}
          disabled={!imagen}
          className="inline-flex items-center gap-1.5 justify-self-start rounded-lg bg-noche px-3.5 py-2 text-sm font-semibold text-crema disabled:opacity-50"
        >
          <Download className="size-4" aria-hidden="true" />
          Descargar cartel para imprimir
        </button>
      </div>
    </div>
  )
}
