// Copia las grabaciones crudas y sus pasos (docs/videos/, generados por
// frontend/scripts/grabar-recorrido.mjs) a public/ para usarlas en los videos.
import { copyFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const origen = path.resolve(aqui, '../../docs/videos')
const destino = path.resolve(aqui, '../public')
for (const archivo of ['reel-1-jugador.mp4', 'reel-2-dueno.mp4', 'steps-jugador.json', 'steps-dueno.json']) {
  copyFileSync(path.join(origen, archivo), path.join(destino, archivo))
  console.log(`public/${archivo}`)
}
copyFileSync(path.resolve(aqui, '../../frontend/public/logo-haycanchas.png'), path.join(destino, 'logo-haycanchas.png'))
