import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import type { ComplejoResumen } from '../api/publico'

// Mapas de OpenStreetMap (gratis, sin clave; piden la atribución).
const CAPAS = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATRIBUCION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const CENTRO_POR_DEFECTO: L.LatLngTuple = [-34.9214, -57.9545] // La Plata

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter((p) => !/^(el|la|los|las|de|del)$/i.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

/** Pin con el color y las iniciales del complejo (sin imágenes: no depende del bundler). */
function pin(color: string, texto: string) {
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -30],
    html: `<div style="width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:grid;place-items:center"><span style="transform:rotate(45deg);color:#fff;font:700 11px/1 Arial,sans-serif">${texto}</span></div>`,
  })
}

function useMapa(contenedor: React.RefObject<HTMLDivElement | null>) {
  const mapa = useRef<L.Map | null>(null)
  useEffect(() => {
    if (!contenedor.current || mapa.current) return
    mapa.current = L.map(contenedor.current, { scrollWheelZoom: false }).setView(CENTRO_POR_DEFECTO, 13)
    L.tileLayer(CAPAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(mapa.current)
    return () => {
      mapa.current?.remove()
      mapa.current = null
    }
  }, [contenedor])
  return mapa
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Página principal: todos los complejos en un mapa, con un buscador. */
export function MapaDeCanchas({ complejos }: { complejos: ComplejoResumen[] }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useMapa(contenedor)
  const [busqueda, setBusqueda] = useState('')
  const encontrados = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return complejos.filter((c) => !q || normalizar([c.nombre, c.barrio ?? '', ...c.deportes.map((d) => d.nombre)].join(' ')).includes(q))
  }, [complejos, busqueda])

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    const capa = L.layerGroup().addTo(m)
    const puntos: L.LatLngTuple[] = []
    for (const c of encontrados) {
      if (c.latitud == null || c.longitud == null) continue
      const punto: L.LatLngTuple = [c.latitud, c.longitud]
      puntos.push(punto)
      const div = document.createElement('div')
      div.innerHTML = `<b style="font-size:15px">${c.nombre.replace(/</g, '&lt;')}</b><br><span style="color:#5d6660">${(c.barrio ?? '').replace(/</g, '&lt;')}</span><br><span style="font-size:12px">${c.deportes.map((d) => d.nombre).join(' · ')}</span><br><a href="/${c.slug}" style="display:inline-block;margin-top:6px;font-weight:700;color:#1E7A3E">Ver horarios →</a>`
      L.marker(punto, { icon: pin(c.color_primario, iniciales(c.nombre)), title: c.nombre })
        .bindPopup(div)
        .addTo(capa)
    }
    if (puntos.length === 1) m.setView(puntos[0], 14)
    else if (puntos.length > 1) m.fitBounds(puntos, { padding: [40, 40], maxZoom: 14 })
    return () => {
      capa.remove()
    }
  }, [encontrados, mapa])

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div ref={contenedor} className="z-0 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-linea lg:aspect-auto lg:min-h-[460px]" />
      <div className="grid content-start gap-3">
        <label className="grid gap-1.5">
          <span className="text-[13px] font-semibold">Buscar complejo</span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, barrio o deporte"
            className="w-full rounded-xl border-[1.5px] border-linea bg-white px-3.5 py-2.5 text-[16px] focus:border-cesped focus:outline-none"
          />
        </label>
        <ul className="grid max-h-[380px] gap-2 overflow-y-auto">
          {encontrados.map((c) => (
            <li key={c.slug}>
              <Link to={`/${c.slug}`} className="flex items-center justify-between gap-3 rounded-xl bg-cal px-3.5 py-2.5 ring-1 ring-linea hover:ring-noche">
                <span className="min-w-0">
                  <b className="block truncate">{c.nombre}</b>
                  <span className="text-sm text-gris">{[c.barrio, ...c.deportes.map((d) => d.nombre)].filter(Boolean).join(' · ')}</span>
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </li>
          ))}
          {encontrados.length === 0 && <li className="text-sm text-gris">No encontramos complejos con esa búsqueda.</li>}
        </ul>
      </div>
    </div>
  )
}

type Ubicacion = { latitud: number | null; longitud: number | null }

/** Panel: el dueño marca dónde queda el complejo tocando el mapa (o buscando la dirección). */
export function ElegirUbicacion({ valor, color, direccion, onCambiar }: { valor: Ubicacion; color: string; direccion: string; onCambiar: (u: Ubicacion) => void }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useMapa(contenedor)
  const marcador = useRef<L.Marker | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    const alTocar = (e: L.LeafletMouseEvent) => onCambiar({ latitud: +e.latlng.lat.toFixed(6), longitud: +e.latlng.lng.toFixed(6) })
    m.on('click', alTocar)
    return () => {
      m.off('click', alTocar)
    }
  }, [mapa, onCambiar])

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    marcador.current?.remove()
    marcador.current = null
    if (valor.latitud == null || valor.longitud == null) return
    const punto: L.LatLngTuple = [valor.latitud, valor.longitud]
    marcador.current = L.marker(punto, { icon: pin(color, ''), draggable: true }).addTo(m)
    marcador.current.on('dragend', () => {
      const p = marcador.current!.getLatLng()
      onCambiar({ latitud: +p.lat.toFixed(6), longitud: +p.lng.toFixed(6) })
    })
    m.setView(punto, Math.max(m.getZoom(), 16))
  }, [mapa, valor.latitud, valor.longitud, color, onCambiar])

  // Automático: cuando hay dirección y todavía no hay pin, se busca sola.
  const sinPin = valor.latitud == null
  useEffect(() => {
    if (!sinPin || direccion.split(',').length < 3) return
    const espera = setTimeout(() => void buscar(), 1200)
    return () => clearTimeout(espera)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direccion, sinPin])

  async function buscar() {
    setBuscando(true)
    setAviso('')
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar&q=${encodeURIComponent(direccion)}`
      const [lugar] = (await (await fetch(url)).json()) as { lat: string; lon: string }[]
      if (lugar) onCambiar({ latitud: +(+lugar.lat).toFixed(6), longitud: +(+lugar.lon).toFixed(6) })
      else setAviso('No la encontramos. Mové el mapa hasta el complejo y tocá el lugar exacto.')
    } catch {
      setAviso('No pudimos buscarla. Tocá el lugar exacto en el mapa.')
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={buscar}
          disabled={!direccion.trim() || buscando}
          className="rounded-xl bg-crema-oscuro/70 px-3.5 py-2 text-sm font-semibold hover:bg-crema-oscuro disabled:opacity-50"
        >
          {buscando ? 'Buscando…' : 'Buscar la dirección en el mapa'}
        </button>
        <span className="text-sm text-gris">
          {valor.latitud == null ? 'Todavía no está marcado: no aparece en el mapa de HayCancha.' : 'Si no quedó justo, tocá el lugar exacto o arrastrá el pin.'}
        </span>
      </div>
      {aviso && <p className="text-sm text-amber-800">{aviso}</p>}
      <div ref={contenedor} className="z-0 aspect-[16/10] w-full overflow-hidden rounded-2xl border border-linea" />
    </div>
  )
}
