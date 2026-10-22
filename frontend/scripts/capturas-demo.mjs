/**
 * Capturas por estado para el video de demo del jugador (video/src/demo): 390x844 a 3x,
 * modo claro, con los complejos ficticios de la demo. Guarda también dónde está cada
 * elemento tocado (en px de la pantalla de 390x844) para el indicador de toque y los
 * recortes. Corre contra la copia local.
 *
 * Antes: cd backend && uv run python -m app.cli cargar-demo   (y backend + frontend andando)
 * Correr: cd frontend && node scripts/capturas-demo.mjs
 * Quedan en video/public/demo/ (PNG + estados.json).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const WEB = process.env.WEB_URL ?? 'http://localhost:5173'
const SLUG = 'los-ceibos'
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
const foto = async (nombre, datos = async () => ({}), completa = false) => {
  await page.evaluate(() => document.fonts.ready)
  await esperar(700)
  const cajas = await datos()
  await page.screenshot({ path: path.join(SALIDA, `${nombre}.png`), fullPage: completa })
  estados[nombre] = { ...cajas, scroll: await page.evaluate(() => Math.round(scrollY)) }
  console.log(`  ${nombre}.png`)
}

// 1. La portada de HayCanchas, entera (para el scroll).
await page.goto(WEB, { waitUntil: 'networkidle' })
await foto('1-inicio', undefined, true)

// 2. El complejo, arriba, con el deporte y el día que se van a tocar.
await page.goto(`${WEB}/${SLUG}`, { waitUntil: 'networkidle' })
const dia = page.locator('[aria-label="Día"] button').nth(1)
await dia.evaluate((el) => el.scrollIntoView({ block: 'center' }))
await page.evaluate(() => window.scrollBy(0, 120))
await foto('2-complejo', async () => ({
  deporte: await caja(page.locator('[aria-label="Deporte"] button').first()),
  dia: await caja(dia),
}))

// 3. El día elegido: la página entera para el scroll hasta los horarios.
await dia.click()
const turno = page.locator('button[aria-label^="21:00,"]:not([disabled])').first()
await turno.waitFor()
await page.evaluate(() => window.scrollTo(0, 0))
await foto('3-horarios-completa', undefined, true)
await turno.evaluate((el) => el.scrollIntoView({ block: 'center' }))
await foto('3-horarios', async () => ({ turno: await caja(turno) }))

// 4. El horario elegido: queda marcado y aparece "Continuar".
await turno.click()
await esperar(500)
await foto('4-elegido', async () => ({ continuar: await caja(page.getByRole('button', { name: 'Continuar' })) }))

// 5. La hoja del turno: precio, seña y lo que se paga en la cancha.
await page.getByRole('button', { name: 'Continuar' }).click()
await esperar(800)
const visible = (l) => l.locator('visible=true')
await foto('5-turno', async () => ({
  precios: await caja(visible(page.getByText('Seña para reservar')).locator('xpath=ancestor::dl[1]')),
  canchas: await caja(visible(page.getByText('Si no elegís, te damos la primera libre.')).locator('xpath=..')),
}))

// 6. Datos completos, con la parrilla sumada y las reglas del predio.
await visible(page.getByRole('button', { name: 'Uno más de Parrilla' })).click()
await visible(page.getByLabel('Nombre y apellido')).fill('Santiago Ferreyra')
await visible(page.getByLabel('Teléfono')).fill('2215550147')
const pagar = visible(page.getByRole('button', { name: /Pagar seña/ }))
await pagar.evaluate((el) => el.scrollIntoView({ block: 'end' }))
await page.evaluate(() => {
  const hoja = [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 40 && getComputedStyle(d).overflowY === 'auto')
  if (hoja) hoja.scrollTop += 40
})
await foto('6-datos', async () => ({ pagar: await caja(pagar) }))

// 7. Pago (simulado en la copia local) y confirmación, con el dominio real en el link.
await pagar.click()
await page.waitForURL(`**/${SLUG}/r/**`)
await page.getByRole('button', { name: /Simular pago/ }).click()
await page.getByText('Confirmado').first().waitFor()
await page.evaluate(() => {
  for (const campo of document.querySelectorAll('input')) campo.value = campo.value.replace(/^https?:\/\/localhost:\d+/, 'haycanchas.com.ar')
})
await foto('7-confirmado', async () => ({ listo: await caja(page.getByText(/El turno es tuyo/).first().locator('xpath=..')) }))

writeFileSync(path.join(SALIDA, 'estados.json'), `${JSON.stringify(estados, null, 2)}\n`)
await navegador.close()
