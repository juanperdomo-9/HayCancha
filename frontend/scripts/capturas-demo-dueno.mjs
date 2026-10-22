/**
 * Capturas por estado para el video de demo del dueño (video/src/demo): 390x844 a 3x, modo
 * claro, con el complejo ficticio Los Ceibos. Guarda dónde está cada elemento tocado.
 *
 * Antes: cd backend && uv run python -m app.cli cargar-demo   (y backend + frontend andando)
 * Correr: cd frontend && node scripts/capturas-demo-dueno.mjs
 * Quedan en video/public/demo/ (dueno-*.png + estados-dueno.json).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const WEB = process.env.WEB_URL ?? 'http://localhost:5173'
const SLUG = 'los-ceibos'
// Usuario de prueba local (app/demo.py). Solo existe en la base local.
const DUENO = { email: 'dueno@losceibos.example', clave: 'ceibos-local-2026' }
const SALIDA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../video/public/demo')
const estados = {}
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function caja(locator) {
  const b = await locator.boundingBox()
  return b && { x: Math.round(b.x), y: Math.round(b.y), ancho: Math.round(b.width), alto: Math.round(b.height) }
}

mkdirSync(SALIDA, { recursive: true })
const navegador = await chromium.launch()
const contexto = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Buenos_Aires',
  colorScheme: 'light',
})
// Sin scroll suave: las posiciones se toman con la página quieta.
await contexto.addInitScript(() => {
  addEventListener('DOMContentLoaded', () => {
    const estilo = document.createElement('style')
    estilo.textContent = 'html { scroll-behavior: auto !important }'
    document.head.append(estilo)
  })
})
const page = await contexto.newPage()
const visible = (l) => l.locator('visible=true')
const foto = async (nombre, datos = async () => ({}), completa = false) => {
  await page.evaluate(() => document.fonts.ready)
  await esperar(800)
  const cajas = await datos()
  await page.screenshot({ path: path.join(SALIDA, `dueno-${nombre}.png`), fullPage: completa })
  estados[nombre] = { ...cajas, scroll: await page.evaluate(() => Math.round(scrollY)) }
  console.log(`  dueno-${nombre}.png`)
}

await page.goto(`${WEB}/ingresar`)
await page.getByLabel('Email o usuario').fill(DUENO.email)
await page.getByLabel('Contraseña').fill(DUENO.clave)
await page.getByRole('button', { name: 'Ingresar' }).click()
await page.waitForURL(`**/panel/${SLUG}**`)

// 1. La agenda de mañana, entera (para el scroll).
await page.getByRole('button', { name: 'Siguiente' }).click()
const reservada = page.getByRole('cell').filter({ hasText: /\$/ }).filter({ hasNotText: 'Cargar' }).first()
await reservada.waitFor()
await foto('1-agenda-completa', undefined, true)

// 2. Una reserva en la grilla, para tocarla.
await reservada.evaluate((el) => el.scrollIntoView({ block: 'center' }))
await foto('2-agenda', async () => ({ reserva: await caja(reservada) }))

// 3. El detalle de la reserva: jugador, seña y lo que falta cobrar.
await reservada.click()
const cobrar = visible(page.getByRole('button', { name: /^Cobré/ })).first()
await cobrar.waitFor()
await foto('3-detalle', async () => ({ cobrar: await caja(cobrar) }))

// 4. Saldo cobrado en la cancha.
await cobrar.click()
await visible(page.getByRole('button', { name: /no cobrado/ })).waitFor()
await foto('4-cobrado')

// 5. Bloquear un turno: modo bloqueo, un turno elegido y el motivo.
await visible(page.getByRole('button', { name: 'Cerrar' })).last().click()
await esperar(500)
await visible(page.getByRole('button', { name: 'Bloquear horarios' })).click()
const libre = visible(page.locator('button[aria-label$="Elegir para bloquear"]')).first()
await libre.evaluate((el) => el.scrollIntoView({ block: 'center' }))
await foto('5-bloquear', async () => ({ turno: await caja(libre) }))
await libre.click()
await page.getByLabel('Motivo del bloqueo').fill('Torneo de los sábados')
await foto('6-elegido', async () => ({
  bloquear: await caja(visible(page.getByRole('button', { name: 'Bloquear', exact: true }))),
}))
await visible(page.getByRole('button', { name: 'Bloquear', exact: true })).click()
await esperar(800)
await foto('7-bloqueado')

// 8. Horarios y precios.
await page.goto(`${WEB}/panel/${SLUG}/horarios`)
await page.getByText('Franjas').first().evaluate((el) => el.scrollIntoView({ block: 'start' }))
await page.evaluate(() => window.scrollBy(0, -20))
await foto('8-horarios')

// 9. La página del complejo, con su marca.
await page.goto(`${WEB}/${SLUG}`)
await foto('9-pagina')

writeFileSync(path.join(SALIDA, 'estados-dueno.json'), `${JSON.stringify(estados, null, 2)}\n`)
await navegador.close()
