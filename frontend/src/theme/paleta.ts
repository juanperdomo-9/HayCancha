/**
 * Paleta de un complejo a partir de su color. Con cualquier color que elija el
 * dueño, la página tiene que seguir leyéndose bien: por eso el color es solo
 * acento y de él se derivan el texto que va encima, una versión oscurecida para
 * textos sobre fondo claro y tonos suaves para fondos.
 */

export type Rgb = [number, number, number]

export type Tema = {
  complejo: string
  /** Texto sobre el color del complejo (blanco o casi negro). */
  sobre: string
  /** El color, oscurecido si hace falta, para textos sobre el fondo base. */
  texto: string
  suave: string
  linea: string
  profundo: string
  franja: string
  secundario: string
  textoOscuro: string
  suaveOscuro: string
  lineaOscuro: string
}

export const FONDO_BASE = '#F6F4EF'
// El fondo de las páginas de los complejos en modo oscuro (--color-lienzo en index.css).
export const FONDO_OSCURO = '#0F1113'
export const COLOR_POR_DEFECTO = '#1E7A3E'
const BLANCO = '#FFFFFF'
const CASI_NEGRO = '#15161A'
const NEGRO = '#000000'
const OSCURO = '#0B0C0E'
/** Contraste mínimo para texto normal (WCAG AA). */
export const CONTRASTE_TEXTO = 4.5

export function normalizarHex(color: string): string | null {
  const limpio = color.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(limpio)) {
    return (
      '#' +
      [...limpio]
        .map((c) => c + c)
        .join('')
        .toUpperCase()
    )
  }
  if (/^[0-9a-f]{6}$/i.test(limpio)) return '#' + limpio.toUpperCase()
  return null
}

function hexARgb(hex: string): Rgb {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb
}

function rgbAHex(rgb: Rgb): string {
  return (
    '#' +
    rgb
      .map((v) =>
        Math.round(Math.min(255, Math.max(0, v)))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  )
}

/** Luminancia relativa según WCAG 2. */
export function luminancia(hex: string): number {
  const [r, g, b] = hexARgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (claro + 0.05) / (oscuro + 0.05)
}

/** Mezcla lineal en sRGB: t = 0 devuelve `a`, t = 1 devuelve `b`. */
export function mezclar(a: string, b: string, t: number): string {
  const A = hexARgb(a)
  const B = hexARgb(b)
  return rgbAHex(A.map((v, i) => v + (B[i] - v) * t) as Rgb)
}

export function temaComplejo(color: string, secundario?: string | null): Tema {
  const base = normalizarHex(color) ?? COLOR_POR_DEFECTO

  const sobre = contraste(base, BLANCO) >= contraste(base, CASI_NEGRO) ? BLANCO : CASI_NEGRO

  let texto = base
  for (let t = 0.05; contraste(texto, FONDO_BASE) < CONTRASTE_TEXTO && t <= 1; t += 0.05) {
    texto = mezclar(base, NEGRO, t)
  }

  // En modo oscuro, el texto con el color del complejo se aclara hasta leerse bien.
  let textoOscuro = base
  for (let t = 0.05; contraste(textoOscuro, FONDO_OSCURO) < CONTRASTE_TEXTO && t <= 1; t += 0.05) {
    textoOscuro = mezclar(base, BLANCO, t)
  }

  return {
    complejo: base,
    sobre,
    texto,
    textoOscuro,
    suave: mezclar(base, FONDO_BASE, 0.86),
    suaveOscuro: mezclar(base, FONDO_OSCURO, 0.78),
    linea: mezclar(base, FONDO_BASE, 0.55),
    lineaOscuro: mezclar(base, FONDO_OSCURO, 0.45),
    profundo: mezclar(base, OSCURO, 0.52),
    franja: mezclar(base, OSCURO, 0.4),
    secundario: (secundario && normalizarHex(secundario)) || base,
  }
}

/** Variables CSS que consume Tailwind (ver `@theme inline` en index.css). */
export function variablesTema(tema: Tema): Record<`--${string}`, string> {
  return {
    '--complejo': tema.complejo,
    '--complejo-sobre': tema.sobre,
    // Las versiones -claro y -oscuro las elige index.css según el modo (.tema-complejo).
    '--complejo-texto-claro': tema.texto,
    '--complejo-texto-oscuro': tema.textoOscuro,
    '--complejo-suave-claro': tema.suave,
    '--complejo-suave-oscuro': tema.suaveOscuro,
    '--complejo-linea-claro': tema.linea,
    '--complejo-linea-oscuro': tema.lineaOscuro,
    '--complejo-profundo': tema.profundo,
    '--complejo-franja': tema.franja,
    '--complejo-secundario': tema.secundario,
  }
}
