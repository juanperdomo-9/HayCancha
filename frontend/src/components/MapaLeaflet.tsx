import 'leaflet/dist/leaflet.css'

import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { type ComplejoResumen, useComplejosConLugar } from '../api/publico'
import { plata } from '../utils/formato'

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
    // En modo oscuro las capas se oscurecen con un filtro (ver .leaflet-tile-pane en index.css).
    L.tileLayer(CAPAS, { attribution: ATRIBUCION, maxZoom: 19 }).addTo(mapa.current)
    return () => {
      mapa.current?.remove()
      mapa.current = null
    }
  }, [contenedor])
  return mapa
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Para comparar "techada" con "techado": sin tildes y sin la última letra.
const raiz = (t: string) => {
  const n = normalizar(t.trim())
  return n.length > 4 ? n.slice(0, -1) : n
}

const HORAS = Array.from({ length: 17 }, (_, i) => `${String(i + 7).padStart(2, '0')}:00`)

function diasParaElegir(hoy: string) {
  if (!hoy) return []
  const base = new Date(`${hoy}T12:00:00`)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const nombre = i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' })
    return { iso, nombre: nombre[0].toUpperCase() + nombre.slice(1) }
  })
}

const escapar = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** Página principal: todos los complejos en un mapa, con buscador y filtros por día, hora,
 * deporte y características. Con un día elegido, se apagan los que no tienen lugar. */
export function MapaDeCanchas({ complejos }: { complejos: ComplejoResumen[] }) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useMapa(contenedor)
  const [busqueda, setBusqueda] = useState('')
  const [fecha, setFecha] = useState('')
  const [hora, setHora] = useState('')
  const [deporte, setDeporte] = useState('')
  const [elegidas, setElegidas] = useState<string[]>([])

  const hoy = complejos[0]?.hoy ?? ''
  const dias = useMemo(() => diasParaElegir(hoy), [hoy])
  const deportes = useMemo(() => {
    const todos = new Map<string, string>()
    for (const c of complejos) for (const d of c.deportes) todos.set(d.codigo, d.nombre)
    return [...todos].map(([codigo, nombre]) => ({ codigo, nombre }))
  }, [complejos])
  const caracteristicas = useMemo(() => {
    const cuenta = new Map<string, { texto: string; veces: number }>()
    for (const c of complejos)
      for (const t of c.caracteristicas ?? []) {
        const item = cuenta.get(raiz(t)) ?? { texto: t, veces: 0 }
        item.veces += 1
        cuenta.set(raiz(t), item)
      }
    return [...cuenta.values()].sort((a, b) => b.veces - a.veces).slice(0, 8).map((x) => x.texto)
  }, [complejos])

  const libres = useComplejosConLugar(fecha ? { fecha, hora: hora || null, deporte: deporte || null, caracteristicas: elegidas } : null)
  const lugar = useMemo(() => new Map((libres.data ?? []).map((l) => [l.slug, l])), [libres.data])

  const encontrados = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return complejos.filter((c) => {
      if (q && !normalizar([c.nombre, c.barrio ?? '', ...c.deportes.map((d) => d.nombre)].join(' ')).includes(q)) return false
      if (deporte && !c.deportes.some((d) => d.codigo === deporte)) return false
      const suyas = (c.caracteristicas ?? []).map(raiz)
      return elegidas.every((e) => suyas.some((s) => s.includes(raiz(e))))
    })
  }, [complejos, busqueda, deporte, elegidas])
  const filtrandoLugar = fecha !== '' && libres.data !== undefined
  const visibles = filtrandoLugar ? encontrados.filter((c) => lugar.has(c.slug)) : encontrados

  useEffect(() => {
    const m = mapa.current
    if (!m) return
    const capa = L.layerGroup().addTo(m)
    const puntos: L.LatLngTuple[] = []
    for (const c of encontrados) {
      if (c.latitud == null || c.longitud == null) continue
      const punto: L.LatLngTuple = [c.latitud, c.longitud]
      const conLugar = lugar.get(c.slug)
      const apagado = filtrandoLugar && !conLugar
      if (!apagado) puntos.push(punto)
      const div = document.createElement('div')
      const detalle = conLugar
        ? `<b style="color:#1E7A3E">${conLugar.canchas === 1 ? '1 cancha libre' : `${conLugar.canchas} canchas libres`} a las ${conLugar.hora}</b><br>`
        : apagado
          ? '<span style="color:#9a3412">Sin lugar en ese horario</span><br>'
          : ''
      const destino = conLugar ? `/${c.slug}?deporte=${conLugar.deporte_codigo}&fecha=${conLugar.fecha}` : `/${c.slug}`
      div.innerHTML = `<b style="font-size:15px">${escapar(c.nombre)}</b><br><span style="color:#5d6660">${escapar(c.barrio ?? '')}</span><br><span style="font-size:12px">${c.deportes.map((d) => escapar(d.nombre)).join(' · ')}</span><br>${detalle}<a href="${destino}" style="display:inline-block;margin-top:6px;font-weight:700;color:#1E7A3E">${conLugar ? 'Reservar →' : 'Ver horarios →'}</a>`
      L.marker(punto, { icon: pin(apagado ? '#9AA39C' : c.color_primario, iniciales(c.nombre)), title: c.nombre, opacity: apagado ? 0.55 : 1, zIndexOffset: apagado ? -100 : 0 })
        .bindPopup(div)
        .addTo(capa)
    }
    if (puntos.length === 1) m.setView(puntos[0], 14)
    else if (puntos.length > 1) m.fitBounds(puntos, { padding: [40, 40], maxZoom: 14 })
    return () => {
      capa.remove()
    }
  }, [encontrados, lugar, filtrandoLugar, mapa])

  const campo = 'w-full rounded-xl border-[1.5px] border-linea bg-superficie px-3 py-2.5 text-[16px] focus:border-cesped focus:outline-none'
  const alternar = (t: string) => setElegidas((e) => (e.includes(t) ? e.filter((x) => x !== t) : [...e, t]))
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div ref={contenedor} className="z-0 aspect-[4/3] w-full overflow-hidden rounded-2xl border border-linea lg:aspect-auto lg:min-h-[520px]" />
      <div className="grid content-start gap-3">
        <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, barrio o deporte" aria-label="Buscar complejo" className={campo} />
        <div className="grid grid-cols-2 gap-2">
          <select value={fecha} onChange={(e) => setFecha(e.target.value)} aria-label="Día" className={campo}>
            <option value="">Cualquier día</option>
            {dias.map((d) => (
              <option key={d.iso} value={d.iso}>
                {d.nombre}
              </option>
            ))}
          </select>
          <select value={hora} onChange={(e) => setHora(e.target.value)} aria-label="Hora" disabled={!fecha} className={`${campo} disabled:opacity-50`}>
            <option value="">{fecha ? 'Cualquier hora' : 'Elegí el día'}</option>
            {HORAS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
        {deportes.length > 1 && (
          <select value={deporte} onChange={(e) => setDeporte(e.target.value)} aria-label="Deporte" className={campo}>
            <option value="">Todos los deportes</option>
            {deportes.map((d) => (
              <option key={d.codigo} value={d.codigo}>
                {d.nombre}
              </option>
            ))}
          </select>
        )}
        {caracteristicas.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Características">
            {caracteristicas.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={elegidas.includes(t)}
                onClick={() => alternar(t)}
                className={`rounded-full px-3 py-1.5 text-[13.5px] font-semibold ring-1 transition-colors ${elegidas.includes(t) ? 'bg-noche text-cal ring-noche' : 'bg-cal ring-linea hover:ring-noche'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {fecha && (
          <p className="text-[13px] text-gris" aria-live="polite">
            {libres.isFetching ? 'Buscando lugar…' : `${visibles.length} ${visibles.length === 1 ? 'complejo tiene' : 'complejos tienen'} lugar${hora ? ` desde las ${hora}` : ''}.`}
          </p>
        )}
        <ul className="grid max-h-[360px] gap-2 overflow-y-auto">
          {visibles.map((c) => {
            const l = lugar.get(c.slug)
            return (
              <li key={c.slug}>
                <Link
                  to={l ? `/${c.slug}?deporte=${l.deporte_codigo}&fecha=${l.fecha}` : `/${c.slug}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-cal px-3.5 py-2.5 ring-1 ring-linea hover:ring-noche"
                >
                  <span className="min-w-0">
                    <b className="block truncate">{c.nombre}</b>
                    <span className="text-sm text-gris">
                      {l
                        ? `${l.horas.join(' · ')} · desde ${plata(l.precio_desde)}`
                        : [c.barrio, ...c.deportes.map((d) => d.nombre)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            )
          })}
          {visibles.length === 0 && !libres.isFetching && (
            <li className="text-sm text-gris">{fecha ? 'No hay lugar con esos filtros. Probá otra hora o sacá algún filtro.' : 'No encontramos complejos con esa búsqueda.'}</li>
          )}
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
