import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'

import Admin from './pages/admin/Admin'
import Panel from './pages/panel/Panel'
import Complejo from './pages/public/Complejo'
import EstadoReserva from './pages/public/EstadoReserva'
import Inicio from './pages/public/Inicio'
import NoEncontrado from './pages/public/NoEncontrado'

const Diseno = lazy(() => import('./pages/dev/Diseno'))

// Las rutas del sistema van antes que /:slug. Sus nombres son slugs reservados (ver CLAUDE.md).
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/panel" element={<Panel />} />
      <Route path="/panel/:slug/*" element={<Panel />} />
      <Route path="/admin/*" element={<Admin />} />
      {import.meta.env.DEV && (
        <Route
          path="/diseno"
          element={
            <Suspense>
              <Diseno />
            </Suspense>
          }
        />
      )}
      <Route path="/:slug" element={<Complejo />} />
      <Route path="/:slug/reserva/:id" element={<EstadoReserva />} />
      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}
