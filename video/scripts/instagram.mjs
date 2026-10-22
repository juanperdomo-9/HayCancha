// Exporta las piezas de Instagram (src/instagram) como PNG con "npx remotion still".
// Antes: las capturas de la app en public/capturas (frontend/scripts/capturas-instagram.mjs).
// Uso: node scripts/instagram.mjs            (todas)
//      node scripts/instagram.mjs IG-duenos  (una composición)
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const salida = path.resolve(raiz, '../instagram')
copyFileSync(path.resolve(raiz, '../frontend/public/logo-haycanchas.png'), path.join(raiz, 'public/logo-haycanchas.png'))

const PIEZAS = [
  ['IG-lanzamiento', 6, (n) => `carruseles/1-lanzamiento/slide-${n}.png`],
  ['IG-reservar', 6, (n) => `carruseles/2-como-reservar/slide-${n}.png`],
  ['IG-duenos', 6, (n) => `carruseles/3-para-duenos/slide-${n}.png`],
  ['IG-deportes', 6, (n) => `carruseles/4-deportes/slide-${n}.png`],
  ['IG-portadas', 6, (n) => `destacadas/portadas/${['1-como-reservar', '2-duenos', '3-deportes', '4-preguntas', '5-complejos', '6-novedades'][n - 1]}.png`],
  ['IG-historias-como-reservar', 4, (n) => `destacadas/1-como-reservar/historia-${n}.png`],
  ['IG-historias-duenos', 4, (n) => `destacadas/2-duenos/historia-${n}.png`],
  ['IG-historias-deportes', 3, (n) => `destacadas/3-deportes/historia-${n}.png`],
  ['IG-historias-preguntas', 5, (n) => `destacadas/4-preguntas/historia-${n}.png`],
  ['IG-historias-complejos', 3, (n) => `destacadas/5-complejos/historia-${n}.png`],
  ['IG-historias-novedades', 3, (n) => `destacadas/6-novedades/historia-${n}.png`],
]

const solo = process.argv[2]
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
execFileSync(npx, ['remotion', 'bundle', '--out-dir=build-ig', '--log=error'], { cwd: raiz, stdio: 'inherit', shell: true })
for (const [id, cantidad, archivo] of PIEZAS) {
  if (solo && solo !== id) continue
  for (let n = 1; n <= cantidad; n++) {
    const destino = path.join(salida, archivo(n))
    mkdirSync(path.dirname(destino), { recursive: true })
    execFileSync(npx, ['remotion', 'still', 'build-ig', id, `"${destino}"`, `--frame=${n - 1}`, '--log=error'], { cwd: raiz, stdio: 'inherit', shell: true })
    console.log(archivo(n))
  }
}
