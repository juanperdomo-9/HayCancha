/**
 * Capturas de la app para las piezas de Instagram (video/src/instagram): pantallas de
 * celular (390x844 a 3x) en modo claro y oscuro, con los complejos ficticios de la demo
 * (sin fotos). Corre contra la copia local.
 *
 * Antes: cd backend && uv run python -m app.cli cargar-demo   (y backend + frontend andando)
 * Correr: cd frontend && node scripts/capturas-instagram.mjs
 * Quedan en video/public/capturas/{claro,oscuro}-*.png
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const WEB = process.env.WEB_URL ?? 'http://localhost:5173'
const SLUG = 'los-ceibos'
// Usuario de prueba local (app/demo.py). Solo existe en la base local.
const DUENO = { email: 'dueno@losceibos.example', clave: 'ceibos-local-2026' }
const SALIDA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../video/public/capturas')

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

async function capturar(navegador, modo) {
  const contexto = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    colorScheme: modo === 'oscuro' ? 'dark' : 'light',
  })
  const page = await contexto.newPage()
  const foto = async (nombre) => {
    await esperar(900)
    await page.screenshot({ path: path.join(SALIDA, `${modo}-${nombre}.png`) })
    console.log(`  ${modo}-${nombre}.png`)
  }

  // 1. La portada de HayCanchas.
  await page.goto(WEB)
  await foto('1-inicio')

  // 2. La página del complejo con los horarios de mañana.
  await page.goto(`${WEB}/${SLUG}`)
  await page.locator('[aria-label="Día"] button').nth(1).click()
  await page.locator('button[aria-label^="21:00,"]').first().waitFor()
  await page.locator('button[aria-label^="18:00,"]').first().evaluate((el) => el.scrollIntoView({ block: 'start' }))
  await page.evaluate(() => window.scrollBy(0, -170))
  await foto('2-horarios')

  // 3. El turno elegido: precio, seña y lo que se paga en la cancha.
  await page.locator('button[aria-label^="21:00,"]:not([disabled]), button[aria-label^="22:00,"]:not([disabled])').first().click()
  await page.getByRole('button', { name: 'Continuar' }).click()
  await esperar(700)
  await foto('3-turno')

  // 4. Datos, adicionales y reglas del predio.
  await page.getByRole('button', { name: 'Uno más de Parrilla' }).locator('visible=true').click()
  await page.getByLabel('Nombre y apellido').locator('visible=true').fill('Santiago Ferreyra')
  await page.getByLabel('Teléfono').locator('visible=true').fill('2215550147')
  await page.getByText('Reglas del predio').locator('visible=true').evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await foto('4-datos')

  // 5. Pago (simulado en la copia local) y confirmación.
  await page.getByRole('button', { name: /Pagar seña/ }).locator('visible=true').click()
  await page.waitForURL(`**/${SLUG}/r/**`)
  await page.getByRole('button', { name: /Simular pago/ }).click()
  await page.getByText('Confirmado').first().waitFor()
  // El link de la reserva, con el dominio real en vez del de la copia local.
  await page.evaluate(() => {
    for (const campo of document.querySelectorAll('input')) campo.value = campo.value.replace(/^https?:\/\/localhost:\d+/, 'haycanchas.com.ar')
  })
  await foto('5-confirmado')

  // 6. Panel del dueño: la agenda de mañana.
  await page.goto(`${WEB}/ingresar`)
  await page.getByLabel('Email o usuario').fill(DUENO.email)
  await page.getByLabel('Contraseña').fill(DUENO.clave)
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(`**/panel/${SLUG}**`)
  await page.getByRole('button', { name: 'Siguiente' }).click()
  await foto('6-agenda')
  await page.evaluate(() => window.scrollBy(0, 520))
  await foto('7-agenda-grilla')

  await contexto.close()
}

mkdirSync(SALIDA, { recursive: true })
const navegador = await chromium.launch()
try {
  for (const modo of ['claro', 'oscuro']) await capturar(navegador, modo)
} finally {
  await navegador.close()
}
