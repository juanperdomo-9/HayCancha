const PESOS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })
const PESOS_CON_CENTAVOS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 })

/** "$ 85.000". Con centavos solo si los tiene ("$ 6.666,60"). */
export function plata(valor: string | number): string {
  const n = Number(valor)
  return Number.isInteger(n) ? PESOS.format(n) : PESOS_CON_CENTAVOS.format(n)
}

export const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** "2026-10-03" -> fecha a medianoche local, sin corrimientos por zona horaria. */
export function desdeIso(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

export function aIso(fecha: Date): string {
  const mm = String(fecha.getMonth() + 1).padStart(2, '0')
  const dd = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mm}-${dd}`
}

export function sumarDias(fecha: Date, dias: number): Date {
  const nueva = new Date(fecha)
  nueva.setDate(nueva.getDate() + dias)
  return nueva
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((desdeIso(hasta).getTime() - desdeIso(desde).getTime()) / 86_400_000)
}

/** "hoy", "mañana" o el nombre del día. */
export function diaRelativo(fecha: string, hoy: string): string {
  const diferencia = diasEntre(hoy, fecha)
  if (diferencia === 0) return 'hoy'
  if (diferencia === 1) return 'mañana'
  return DIAS[desdeIso(fecha).getDay()]
}

/** "Sábado 3 de octubre". */
export function fechaLarga(iso: string): string {
  const fecha = desdeIso(iso)
  const texto = `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function iniciales(nombre: string): string {
  const palabras = nombre
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .split(/\s+/)
    .filter((p) => p.length > 2 || /\d/.test(p))
  return (palabras.length >= 2 ? palabras[0][0] + palabras[1][0] : (palabras[0] ?? nombre).slice(0, 2)).toUpperCase()
}
