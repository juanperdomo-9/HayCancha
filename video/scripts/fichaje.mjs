// "Nuevo fichaje": arma el carrusel, la historia, el reel y el texto para anunciar un complejo nuevo.
// Toma los datos públicos del complejo de la API y saca la captura de su página.
// Uso: node scripts/fichaje.mjs <slug> [--logo ruta/al/logo.png]
//   --logo: un logo propio (PNG o JPG) en vez del que tiene cargado en la web.
//   Por defecto usa la web real. Para la copia local:
//   API_URL=http://localhost:8000 WEB_URL=http://localhost:5173 node scripts/fichaje.mjs <slug>
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const slug = process.argv[2]
const i = process.argv.indexOf('--logo')
const logoPropio = i > 0 ? process.argv[i + 1] : null
if (!slug) throw new Error('Uso: node scripts/fichaje.mjs <slug>')
const API = process.env.API_URL ?? 'https://api.haycanchas.com.ar'
const WEB = process.env.WEB_URL ?? 'https://haycanchas.com.ar'
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const salida = path.resolve(raiz, `../instagram/fichajes/${slug}`)
mkdirSync(path.join(raiz, 'public/fichajes'), { recursive: true })
mkdirSync(path.join(raiz, 'public/capturas'), { recursive: true })
mkdirSync(salida, { recursive: true })

// 1. Los datos públicos del complejo.
const r = await fetch(`${API}/publico/complejos/${slug}`)
if (!r.ok) throw new Error(`No encontramos el complejo ${slug} (${r.status})`)
const c = await r.json()
const datos = {
  slug: c.slug,
  nombre: c.nombre,
  barrio: c.barrio,
  logo_url: c.logo_url,
  color_primario: c.color_primario,
  servicios: c.servicios,
  deportes: c.deportes.map((d) => ({ nombre: d.nombre, canchas: d.canchas.map((x) => ({ caracteristicas: x.caracteristicas })) })),
}
if (logoPropio) {
  const archivo = `fichajes/${slug}-logo${path.extname(logoPropio).toLowerCase() || '.png'}`
  copyFileSync(path.resolve(logoPropio), path.join(raiz, 'public', archivo))
  datos.logo_url = archivo // se sirve desde public/
}
writeFileSync(path.join(raiz, `public/fichajes/${slug}.json`), JSON.stringify(datos, null, 2))

// 2. La captura de su página (con el Playwright del frontend).
const { chromium } = await import(pathToFileURL(path.resolve(raiz, '../frontend/node_modules/playwright/index.mjs')).href)
const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'light', locale: 'es-AR' })
await pagina.goto(`${WEB}/${slug}`, { waitUntil: 'networkidle' })
await pagina.evaluate(() => document.fonts.ready)
await new Promise((ok) => setTimeout(ok, 800))
await pagina.screenshot({ path: path.join(raiz, `public/capturas/fichaje-${slug}.png`) })
// La página entera, para el scroll del reel.
mkdirSync(path.join(raiz, 'public/demo'), { recursive: true })
await pagina.screenshot({ path: path.join(raiz, `public/demo/fichaje-${slug}.png`), fullPage: true })
await navegador.close()

// 3. Las piezas.
const props = path.join(raiz, 'build-ig-props.json')
writeFileSync(props, JSON.stringify({ slug }))
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const correr = (args) => execFileSync(npx, args, { cwd: raiz, stdio: 'inherit', shell: true })
correr(['remotion', 'bundle', '--out-dir=build-ig', '--log=error'])
for (let n = 0; n < 3; n++) {
  correr(['remotion', 'still', 'build-ig', 'IG-fichaje', `"${path.join(salida, `slide-${n + 1}.png`)}"`, `--frame=${n}`, `--props=${props}`, '--log=error'])
}
correr(['remotion', 'render', 'build-ig', 'IG-fichaje-reel', `"${path.join(salida, 'reel.mp4')}"`, `--props=${props}`, '--log=error'])
correr(['remotion', 'still', 'build-ig', 'IG-fichaje-historia', `"${path.join(salida, 'historia.png')}"`, `--props=${props}`, '--log=error'])

// 4. El texto.
const deportes = datos.deportes.map((d) => d.nombre).join(', ')
const etiquetas = ['#HayCanchas', ...datos.deportes.map((d) => `#${d.nombre.normalize('NFD').replace(/[^\w]/g, '')}`), datos.barrio ? `#${datos.barrio.split(',')[0].normalize('NFD').replace(/[^\w]/g, '')}` : '']
writeFileSync(
  path.join(salida, 'texto.txt'),
  `🚨 OFICIAL 🚨
${datos.nombre} se suma a HayCanchas.
${datos.barrio ? `\n📍 ${datos.barrio}` : ''}
⚽ ${deportes}

Ya podés ver sus turnos libres y reservar con seña online: haycanchas.com.ar/${slug}

Bienvenidos al equipo, @[cuenta del complejo] 🤝

${[...new Set(etiquetas)].filter(Boolean).join(' ')}
`,
)
console.log(`Listo: instagram/fichajes/${slug}/ (slide-1..3.png, historia.png, reel.mp4, texto.txt)`)
