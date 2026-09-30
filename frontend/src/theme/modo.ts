import { useSyncExternalStore } from 'react'

/** Modo claro u oscuro de toda la página.
 *
 * La primera vez sigue el modo del dispositivo del visitante; si toca el botón, se guarda
 * su elección en ese dispositivo (localStorage). El atributo `data-tema` en <html> lo aplica
 * (ver index.css). index.html lo fija antes de pintar, así no hay parpadeo. */
export type Modo = 'claro' | 'oscuro'

const CLAVE = 'hc-modo'
const EVENTO = 'hc-modo'
// El color de la barra del navegador en el celular, según el modo.
const BARRA = { claro: '#F1E9D8', oscuro: '#0E1511' }

function leer(): Modo {
  const actual = document.documentElement.dataset.tema
  return actual === 'oscuro' ? 'oscuro' : 'claro'
}

export function cambiarModo(modo: Modo) {
  document.documentElement.dataset.tema = modo
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BARRA[modo])
  try {
    localStorage.setItem(CLAVE, modo)
  } catch {
    // Sin almacenamiento (modo privado estricto): igual cambia mientras dure la visita.
  }
  window.dispatchEvent(new Event(EVENTO))
}

function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar)
  return () => window.removeEventListener(EVENTO, avisar)
}

export function useModo(): Modo {
  return useSyncExternalStore(suscribir, leer, () => 'claro')
}
