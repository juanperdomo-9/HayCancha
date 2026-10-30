/**
 * Capturas por estado para el reel de los cumpleaños (video/src/demo/DemoCumple.tsx), con
 * el mismo formato que capturas-demo.mjs: 390x844 a 3x, modo claro, Los Ceibos de la demo.
 * Guarda dónde está cada elemento tocado y el mensaje de WhatsApp que arma la página.
 *
 * Antes: cd backend && uv run python -m app.cli cargar-demo   (y backend + frontend andando)
 * Correr: cd frontend && node scripts/capturas-cumple.mjs
 * Quedan en video/public/demo/ (cumple-*.png + estados-cumple.json).
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
  await page.screenshot({ path: path.join(SALIDA, `cumple-${nombre}.png`), fullPage: completa })
  estados[nombre] = { ...cajas, scroll: await page.evaluate(() => Math.round(scrollY)) }
  console.log(`  cumple-${nombre}.png`)
}
const visible = (l) => l.locator('visible=true')

// 1. El complejo, con el cumpleaños al lado de los deportes.
await page.goto(`${WEB}/${SLUG}`, { waitUntil: 'networkidle' })
const chip = page.locator('[aria-label="Deporte"] button', { hasText: 'Cumple' })
await chip.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'end' }))
await page.evaluate(() => window.scrollBy(0, 60))
await foto('1-complejo', async () => ({ chip: await caja(chip) }))

// 2. El cumpleaños elegido: qué incluye y las condiciones.
await chip.click()
await esperar(600)
const info = page.getByText('Condiciones del complejo:').locator('xpath=ancestor::div[1]')
const dia = page.locator('[aria-label="Día"] button').nth(1)
await foto('2-elegido', async () => ({ chip: await caja(chip), info: await caja(info), dia: await caja(dia) }))

// 3. El día: la página entera para el scroll y el horario centrado.
await dia.click()
const turno = page.locator('button[aria-label^="16:00,"]:not([disabled])').first()
await turno.waitFor()
await page.evaluate(() => window.scrollTo(0, 0))
await foto('3-horarios-completa', undefined, true)
await turno.evaluate((el) => el.scrollIntoView({ block: 'center' }))
await foto('3-horarios', async () => ({ turno: await caja(turno) }))

// 4. El horario elegido.
await turno.click()
await esperar(500)
await foto('4-elegido', async () => ({ continuar: await caja(page.getByRole('button', { name: 'Continuar' })) }))

// 5. La hoja: precio cerrado y sin seña.
await page.getByRole('button', { name: 'Continuar' }).click()
await esperar(800)
await foto('5-precio', async () => ({
  precio: await caja(visible(page.getByText('Precio del cumpleaños')).locator('xpath=ancestor::dl[1]')),
}))

// 6. Los datos y quién cumple.
await visible(page.getByLabel('Nombre y apellido')).fill('Carolina Medina')
await visible(page.getByLabel('Teléfono')).fill('2215550188')
await visible(page.getByLabel(/Quién cumple/)).fill('Benja, 7 años, 16 chicos')
const reservar = visible(page.getByRole('button', { name: 'Reservar el cumpleaños' }))
await reservar.evaluate((el) => el.scrollIntoView({ block: 'end' }))
await page.evaluate(() => {
  const hoja = [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 40 && getComputedStyle(d).overflowY === 'auto')
  if (hoja) hoja.scrollTop += 60
})
await foto('6-datos', async () => ({ reservar: await caja(reservar) }))

// 7. Reservado: el aviso para el complejo y el botón de WhatsApp.
await reservar.click()
await page.waitForURL(`**/${SLUG}/r/**`)
await page.getByText('Ahora avisale al complejo').waitFor()
const aviso = page.getByText('Ahora avisale al complejo').locator('xpath=..')
const whatsapp = page.getByRole('link', { name: 'Avisar por WhatsApp' })
const mensaje = await whatsapp.evaluate((a) => decodeURIComponent(new URL(a.href).searchParams.get('text') ?? ''))
await page.evaluate(() => {
  for (const campo of document.querySelectorAll('input')) campo.value = campo.value.replace(/^https?:\/\/localhost:\d+/, 'haycanchas.com.ar')
  window.scrollTo(0, 0)
})
await foto('7-reservado', async () => ({ listo: await caja(page.getByText(/está reservado/).first().locator('xpath=..')) }))
await aviso.evaluate((el) => el.scrollIntoView({ block: 'center' }))
await foto('8-aviso', async () => ({ aviso: await caja(aviso), whatsapp: await caja(whatsapp) }))
estados.mensaje = mensaje.replace(/https?:\/\/localhost:\d+/, 'haycanchas.com.ar')

writeFileSync(path.join(SALIDA, 'estados-cumple.json'), `${JSON.stringify(estados, null, 2)}\n`)
await navegador.close()
