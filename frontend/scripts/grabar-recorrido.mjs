/**
 * Graba los videos de HayCanchas para reels: la web en un celular, en vertical (1080x1920,
 * .mp4), con los pasos escritos en pantalla. Dos videos: el jugador reserva y el dueño
 * maneja su complejo. Corre contra la copia local, nunca contra producción.
 *
 * Antes de grabar:
 *   docker compose up -d --wait                         (raíz del repo)
 *   cd backend && uv run python -m app.cli cargar-demo  (complejos ficticios, con fotos)
 *   backend en :8000 con PAGOS_SIMULADOS=true y frontend en :5173
 *
 * Grabar:  cd frontend && npm run grabar:recorrido
 *   FORMATO=horizontal  lo graba en 1920x1080 (vista de compu)
 *   PAUSA_MS=3000       más tiempo entre pasos
 *   MODO=claro          en modo claro (por defecto, oscuro)
 *   TEXTOS=1            con los pasos escritos en pantalla y placas de inicio y cierre
 * Quedan en docs/videos/: reel-1-jugador.mp4 y reel-2-dueno.mp4, con steps-jugador.json y
 * steps-dueno.json (inicio, fin, texto y zona tocada de cada paso) para los videos de video/.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpeg from 'ffmpeg-static'
import { chromium } from 'playwright'

const WEB = process.env.WEB_URL ?? 'http://localhost:5173'
const SLUG = 'los-ceibos'
// Usuario de prueba local (app/demo.py). Solo existe en la base local.
const DUENO = { email: 'dueno@losceibos.example', clave: 'ceibos-local-2026' }
const JUGADOR = { nombre: 'Bruno Carrizo', telefono: '1155551234', email: 'bruno@ejemplo.com' }
const CANCHA_NUEVA = 'Pádel 2'

const HORIZONTAL = process.env.FORMATO === 'horizontal'
// Celular: 432x768 a 2,5x = 1080x1920. Compu: 1920x1080.
const VISTA = HORIZONTAL ? { width: 1920, height: 1080 } : { width: 432, height: 768 }
const VIDEO = HORIZONTAL ? { width: 1920, height: 1080 } : { width: 1080, height: 1920 }
const PAUSA = Number(process.env.PAUSA_MS ?? 2300)
// Por defecto, crudo (para editarlo después). TEXTOS=1 suma los pasos escritos y las placas.
const TEXTOS = process.env.TEXTOS === '1'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SALIDA = path.join(RAIZ, 'docs', 'videos')
const CRUDOS = path.join(SALIDA, 'crudos')

const esperar = (ms = PAUSA) => new Promise((r) => setTimeout(r, ms))

/** Se inyecta en cada página: el toque del dedo, los textos del paso y las placas. Marca HayCanchas. */
function efectosDeEdicion() {
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@800;900&family=Instrument+Sans:wght@500;600&display=swap');
    #__toque{position:fixed;z-index:2147483647;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;pointer-events:none;
      background:rgba(87,201,134,.45);border:3px solid #1E7A3E;opacity:0;transform:scale(.4);transition:opacity .2s,transform .2s}
    #__toque.on{opacity:1;transform:scale(1)}
    #__texto{position:fixed;z-index:2147483646;left:0;right:0;top:9%;display:grid;justify-items:center;gap:6px;pointer-events:none;padding:0 18px}
    #__texto .n{font:600 13px 'Instrument Sans',system-ui;letter-spacing:.14em;text-transform:uppercase;color:#57C986;background:#14231A;padding:5px 11px;border-radius:999px}
    #__texto .t{font:900 34px/1 'Big Shoulders Display','Arial Narrow',Impact,sans-serif;text-transform:uppercase;text-align:center;
      color:#F6F1E6;background:#1E7A3E;padding:10px 16px 8px;border-radius:12px;box-shadow:0 10px 30px -8px rgba(20,35,26,.55);transform:rotate(-2deg)}
    #__texto.pop .t,#__texto.pop .n{animation:__pop .45s cubic-bezier(.2,1.6,.4,1) both}
    @keyframes __pop{from{opacity:0;transform:scale(.6) rotate(-6deg)}to{opacity:1;transform:scale(1) rotate(-2deg)}}
    #__placa{position:fixed;inset:0;z-index:2147483647;display:grid;place-content:center;justify-items:center;gap:22px;text-align:center;padding:32px;
      background:#14231A;color:#F6F1E6;transition:opacity .5s}
    #__placa img{width:132px;height:132px}
    #__placa h1{margin:0;font:900 54px/.95 'Big Shoulders Display','Arial Narrow',Impact,sans-serif;text-transform:uppercase}
    #__placa h1 b{color:#57C986}
    #__placa p{margin:0;font:500 19px/1.35 'Instrument Sans',system-ui;color:#E6DAC2;max-width:320px}
    #__placa .web{font:900 28px 'Big Shoulders Display','Arial Narrow',Impact,sans-serif;color:#57C986;letter-spacing:.02em}`
  const montar = () => {
    if (document.getElementById('__estilos')) return
    const estilo = document.createElement('style')
    estilo.id = '__estilos'
    estilo.textContent = css
    document.head.appendChild(estilo)
    const toque = document.createElement('div')
    toque.id = '__toque'
    document.body.appendChild(toque)
    document.addEventListener('mousedown', (e) => {
      toque.style.left = `${e.clientX}px`
      toque.style.top = `${e.clientY}px`
      toque.classList.add('on')
      setTimeout(() => toque.classList.remove('on'), 450)
    }, true)
    const guardado = sessionStorage.getItem('__texto')
    if (guardado) window.__texto(...JSON.parse(guardado), false)
  }
  window.__texto = (numero, texto, animar = true) => {
    sessionStorage.setItem('__texto', JSON.stringify([numero, texto]))
    let caja = document.getElementById('__texto')
    if (!caja) {
      caja = document.createElement('div')
      caja.id = '__texto'
      document.body.appendChild(caja)
    }
    caja.innerHTML = `${numero ? `<span class="n">${numero}</span>` : ''}<span class="t">${texto}</span>`
    caja.classList.remove('pop')
    if (animar) {
      void caja.offsetWidth
      caja.classList.add('pop')
    }
  }
  window.__sinTexto = () => {
    sessionStorage.removeItem('__texto')
    document.getElementById('__texto')?.remove()
  }
  window.__placa = (html) => {
    let placa = document.getElementById('__placa')
    if (!placa) {
      placa = document.createElement('div')
      placa.id = '__placa'
      document.body.appendChild(placa)
    }
    placa.style.opacity = '1'
    placa.innerHTML = `<img src="/logo-haycanchas.png" alt="">${html}`
  }
  window.__sinPlaca = () => {
    const placa = document.getElementById('__placa')
    if (placa) placa.style.opacity = '0'
    setTimeout(() => placa?.remove(), 600)
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', montar)
  else montar()
}

/** Un paso: aparece el texto, se hace la acción y se deja ver. */
// Los pasos del video que se está grabando, con sus tiempos y la zona tocada (para el
// zoom de los videos editados en video/, con Remotion).
let pasos = []

/** Un paso: aparece el texto (con TEXTOS=1), se hace la acción y se deja ver.
 * El texto es corto (6 palabras como máximo): es el que se muestra en los videos editados. */
function crearPasos(page) {
  let n = 0
  return async (texto, accion, { numerar = true } = {}) => {
    if (numerar) n += 1
    const registro = { descripcion: texto, inicio: Date.now(), fin: null, foco: null }
    pasos.push(registro)
    console.log(`  ${numerar ? n : '·'}. ${texto}`)
    if (TEXTOS) {
      await page.evaluate(([num, t]) => window.__texto(num, t), [numerar ? `Paso ${n}` : '', texto])
      await esperar(1100)
    }
    await accion()
    await esperar()
    registro.fin = Date.now()
  }
}

async function placa(page, html, ms = 3200) {
  if (!TEXTOS) return esperar(1500)
  await page.evaluate((h) => window.__placa(h), html)
  await esperar(ms)
  await page.evaluate(() => window.__sinPlaca())
  await esperar(700)
}

async function tocar(locator) {
  // Si no se ve, se lleva al centro de la pantalla con un deslizamiento suave (sin saltos).
  const visible = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    return r.top >= 60 && r.bottom <= innerHeight - 60
  })
  if (!visible) {
    await locator.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    await esperar(900)
  }
  await esperar(400)
  const caja = await locator.boundingBox()
  const actual = pasos.at(-1)
  if (caja && actual && !actual.fin) {
    // Zona tocada, en proporción de la pantalla (0 a 1), y cuándo: la última del paso es la que vale.
    const r = (v, total) => Math.round((v / total) * 1000) / 1000
    actual.foco = { x: r(caja.x, VISTA.width), y: r(caja.y, VISTA.height), ancho: r(caja.width, VISTA.width), alto: r(caja.height, VISTA.height), toque: Date.now() }
  }
  await locator.click()
}

async function escribir(locator, texto) {
  await tocar(locator)
  await locator.fill('')
  await locator.pressSequentially(texto, { delay: 55 })
}

/** Deslizamiento suave, como con el dedo. */
async function deslizar(page, px) {
  await page.evaluate((y) => window.scrollBy({ top: y, behavior: 'smooth' }), px)
  await esperar(1000)
}

async function nuevoContexto(navegador) {
  const contexto = await navegador.newContext({
    viewport: VISTA,
    deviceScaleFactor: HORIZONTAL ? 1 : 2.5,
    isMobile: !HORIZONTAL,
    hasTouch: !HORIZONTAL,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    colorScheme: process.env.MODO === 'claro' ? 'light' : 'dark',
  })
  await contexto.addInitScript(efectosDeEdicion)
  return contexto
}

/** Graba la página sacando capturas seguidas (a 2,5x salen en 1080x1920: el video propio de
 * Playwright graba en el tamaño de la vista, 432x768, y se ve borroso). */
async function grabar(contexto, page, nombre) {
  const carpeta = path.join(CRUDOS, nombre)
  mkdirSync(carpeta, { recursive: true })
  const cuadros = []
  pasos = []
  let grabando = true
  // Captura directa de Chrome: ~30 por segundo (page.screenshot da ~12 y el video se traba).
  let cdp = await contexto.newCDPSession(page)
  const bucle = (async () => {
    while (grabando) {
      try {
        const captura = cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 85, optimizeForSpeed: true })
        const limite = new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('colgada')), 1500))
        const { data } = await Promise.race([captura, limite])
        const archivo = path.join(carpeta, `${String(cuadros.length).padStart(5, '0')}.jpg`)
        writeFileSync(archivo, Buffer.from(data, 'base64'))
        cuadros.push({ archivo, t: Date.now() })
      } catch (error) {
        // Durante una navegación la captura puede quedar colgada: se abre otra conexión.
        if (error.message === 'colgada') cdp = await contexto.newCDPSession(page).catch(() => cdp)
        else await esperar(30)
      }
    }
  })()
  return async function terminar() {
    grabando = false
    await bucle
    await contexto.close()
    // Cada captura dura hasta la siguiente; ffmpeg lo pasa a 30 cuadros por segundo.
    const ruta = (c) => `file '${c.archivo.replaceAll('\\', '/')}'`
    const lista = cuadros.map((c, i) => `${ruta(c)}\nduration ${((cuadros[i + 1]?.t ?? c.t + 100) - c.t) / 1000}`)
    const archivoLista = path.join(carpeta, 'lista.txt')
    writeFileSync(archivoLista, ['ffconcat version 1.0', ...lista, ruta(cuadros.at(-1)), ''].join('\n'))
    const final = path.join(SALIDA, `${nombre}.mp4`)
    execFileSync(ffmpeg, [
      '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', archivoLista,
      '-vf', `scale=${VIDEO.width}:${VIDEO.height}:flags=lanczos,fps=30`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', final,
    ])
    console.log(`  → ${final} (${cuadros.length} capturas)`)
    // steps-jugador.json / steps-dueno.json: segundos desde el inicio del video.
    const t0 = cuadros[0].t
    const seg = (t) => Math.round(((t - t0) / 1000) * 100) / 100
    const steps = {
      video: path.basename(final),
      duracion: seg(cuadros.at(-1).t + 100),
      ancho: VIDEO.width,
      alto: VIDEO.height,
      pasos: pasos.map((p) => ({ inicio: seg(p.inicio), fin: seg(p.fin ?? cuadros.at(-1).t), descripcion: p.descripcion, foco: p.foco && { ...p.foco, toque: seg(p.foco.toque) } })),
    }
    writeFileSync(path.join(SALIDA, `steps-${nombre.split('-').at(-1)}.json`), `${JSON.stringify(steps, null, 2)}
`)
    return final
  }
}

/** En el celular, el menú del panel está detrás del botón de hamburguesa. */
async function irEnElPanel(page, seccion) {
  const menu = page.getByRole('button', { name: 'Abrir el menú' })
  if (await menu.isVisible()) await tocar(menu)
  await tocar(page.getByRole('link', { name: new RegExp(`^${seccion}`) }).locator('visible=true').first())
}

async function videoJugador(navegador) {
  const contexto = await nuevoContexto(navegador)
  const page = await contexto.newPage()
  const paso = crearPasos(page)
  const terminar = await grabar(contexto, page, 'reel-1-jugador')
  console.log('Video 1: el jugador reserva')

  await page.goto(WEB)
  await placa(page, '<h1>¿Hay cancha?<br><b>Reservá en 1 minuto</b></h1><p>Sin llamar, sin esperar respuesta. Mirá cómo.</p>')

  await paso('Buscá por día y hora', async () => {
    const buscador = page.getByLabel('Buscar complejo')
    await buscador.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    await esperar(600)
    await page.getByLabel('Día').first().selectOption({ index: 2 })
    await esperar(700)
    const hora = page.getByLabel('Hora').first()
    const horas = await hora.locator('option').allTextContents()
    const noche = horas.findIndex((h) => h.startsWith('21'))
    await hora.selectOption({ index: noche > 0 ? noche : Math.min(1, horas.length - 1) })
    await esperar(900)
    await deslizar(page, 500)
  })

  await paso('Entrá al complejo', async () => {
    await tocar(page.locator(`a[href*="/${SLUG}?"]`).locator('visible=true').first())
    await page.waitForURL((url) => url.pathname === `/${SLUG}`)
  })

  await paso('Mirá fotos y servicios', async () => {
    await esperar(800)
    await deslizar(page, 600)
    await esperar(1200)
    await deslizar(page, -600)
  })

  await paso('Elegí el deporte', async () => {
    const deportes = page.locator('[aria-label="Deporte"] button')
    await tocar(deportes.first())
  })

  await paso('Elegí el día', async () => {
    await tocar(page.locator('[aria-label="Día"] button').nth(1))
  })

  await paso('Elegí un horario libre', async () => {
    const noche = page.locator('button[aria-label^="21:00,"]:not([disabled]), button[aria-label^="20:00,"]:not([disabled])')
    await tocar(noche.first())
    const continuar = page.getByRole('button', { name: 'Continuar' })
    if (await continuar.isVisible().catch(() => false)) {
      await esperar(900)
      await tocar(continuar)
    }
  })

  await paso('Elegí tu cancha', async () => {
    const canchas = page.locator('h3:text-is("Cancha") ~ div button:not([disabled])').locator('visible=true')
    await tocar((await canchas.count()) > 1 ? canchas.nth(1) : canchas.first())
  })

  await paso('Completá tus datos', async () => {
    await escribir(page.getByLabel('Nombre y apellido').locator('visible=true'), JUGADOR.nombre)
    await escribir(page.getByLabel('Teléfono').locator('visible=true'), JUGADOR.telefono)
  })

  await paso('Pagá la seña online', async () => {
    await tocar(page.getByRole('button', { name: /Pagar seña/ }).locator('visible=true'))
    await page.waitForURL(`**/${SLUG}/r/**`)
    await esperar(800)
    await tocar(page.getByRole('button', { name: /Simular pago/ }))
    await page.getByText('Confirmado').first().waitFor({ timeout: 20000 })
  })

  await paso('¡Listo! El turno es tuyo', async () => {
    await esperar(1000)
    await deslizar(page, 400)
    await esperar(1000)
    await deslizar(page, -400)
  }, { numerar: false })

  if (TEXTOS) await page.evaluate(() => window.__sinTexto())
  await placa(page, '<h1>Reservá tu cancha<br><b>en HayCanchas</b></h1><p class="web">haycanchas.com.ar</p>', 3500)
  return terminar()
}

async function videoDueno(navegador) {
  const contexto = await nuevoContexto(navegador)
  const page = await contexto.newPage()
  const paso = crearPasos(page)
  const terminar = await grabar(contexto, page, 'reel-2-dueno')
  console.log('Video 2: el dueño maneja su complejo')

  await page.goto(`${WEB}/ingresar`)
  await placa(page, '<h1>¿Tenés un complejo?<br><b>Así lo manejás</b></h1><p>Turnos, señas y canchas desde el celular.</p>')

  await paso('Entrá a tu panel', async () => {
    await escribir(page.getByLabel('Email o usuario'), DUENO.email)
    await escribir(page.getByLabel('Contraseña'), DUENO.clave)
    await tocar(page.getByRole('button', { name: 'Ingresar' }))
    await page.waitForURL(`**/panel/${SLUG}**`)
  })

  await paso('Tu agenda del día', async () => {
    await esperar(800)
    await deslizar(page, 350)
  })

  await paso('Las reservas llegan solas', async () => {
    await deslizar(page, -350)
    await tocar(page.getByRole('button', { name: 'Siguiente' }))
    await page.getByText(JUGADOR.nombre).first().waitFor()
    await page.getByText(JUGADOR.nombre).first().evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  })

  await paso('Seña cobrada, saldo a la vista', async () => {
    await tocar(page.getByRole('cell').filter({ hasText: JUGADOR.nombre }).first())
    await esperar(1500)
    await deslizar(page, 300)
  })

  await paso('Sumá una cancha nueva', async () => {
    await tocar(page.getByRole('button', { name: 'Cerrar' }).locator('visible=true').last())
    await irEnElPanel(page, 'Canchas')
    await page.waitForURL('**/canchas')
    await escribir(page.getByLabel('Nombre').first(), CANCHA_NUEVA)
    await page.locator('#deporte-nueva').selectOption({ label: 'Pádel' })
    await esperar(500)
    await escribir(page.getByLabel('Características').first(), 'Blindex, descubierta')
    await tocar(page.getByRole('button', { name: 'Agregar' }))
    await page.getByText(CANCHA_NUEVA).first().waitFor()
    await page.getByText(CANCHA_NUEVA).first().evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  })

  await paso('Ponele horarios y precios', async () => {
    await irEnElPanel(page, 'Horarios')
    await page.waitForURL('**/horarios')
    const padel = page.locator('[aria-label="Deporte"] button', { hasText: 'Pádel' })
    if (await padel.count()) await tocar(padel.first())
    await page.getByText(CANCHA_NUEVA).first().waitFor()
    await deslizar(page, 500)
    await tocar(page.getByRole('button', { name: /^Guardar horarios/ }))
    await page.getByText(/^Listo:/).first().waitFor()
  })

  await paso('Bloqueá turnos por lluvia', async () => {
    await irEnElPanel(page, 'Agenda')
    await page.waitForURL(new RegExp(`/panel/${SLUG}/?$`))
    await tocar(page.getByRole('button', { name: 'Siguiente' }))
    await tocar(page.getByRole('button', { name: 'Bloquear horarios' }))
    await tocar(page.locator('button[aria-label$="Elegir para bloquear"]').locator('visible=true').first())
    await escribir(page.getByLabel('Motivo del bloqueo'), 'Torneo de los sábados')
    await tocar(page.getByRole('button', { name: 'Bloquear', exact: true }))
  })

  await paso('Nadie reserva encima', () => esperar(1200), { numerar: false })

  if (TEXTOS) await page.evaluate(() => window.__sinTexto())
  await placa(page, '<h1>Sumá tu complejo<br><b>a HayCanchas</b></h1><p class="web">haycanchas.com.ar</p>', 3500)
  return terminar()
}

try {
  rmSync(CRUDOS, { recursive: true, force: true })
} catch {
  // Quedó algo de una grabación anterior: no molesta.
}
mkdirSync(CRUDOS, { recursive: true })
const navegador = await chromium.launch({ slowMo: 40 })
const videos = []
try {
  const solo = process.env.SOLO
  if (solo !== 'dueno') videos.push(await videoJugador(navegador))
  if (solo !== 'jugador') videos.push(await videoDueno(navegador))
} finally {
  await navegador.close()
  try {
    rmSync(CRUDOS, { recursive: true, force: true })
  } catch {
    // Windows a veces tarda en soltar el .webm: se borra en la próxima grabación.
  }
}
console.log(`\nListo:\n${videos.join('\n')}`)
