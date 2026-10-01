import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router'

import DefinirClave from './pages/DefinirClave'
import Ingresar from './pages/Ingresar'
import Admin from './pages/admin/Admin'
import Agenda from './pages/panel/Agenda'
import Canchas from './pages/panel/Canchas'
import Asistente from './pages/panel/Asistente'
import Cobros from './pages/panel/Cobros'
import Equipo from './pages/panel/Equipo'
import Horarios from './pages/panel/Horarios'
import Marca from './pages/panel/Marca'
import Panel, { PanelSinComplejo } from './pages/panel/Panel'
import Reservas from './pages/panel/Reservas'
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
      <Route path="/ingresar" element={<Ingresar />} />
      <Route path="/ingresar/definir-clave" element={<DefinirClave />} />
      <Route path="/panel" element={<PanelSinComplejo />} />
      <Route path="/panel/:slug" element={<Panel />}>
        <Route index element={<Agenda />} />
        <Route path="canchas" element={<Canchas />} />
        <Route path="horarios" element={<Horarios />} />
        <Route path="reservas" element={<Reservas />} />
        <Route path="marca" element={<Marca />} />
        <Route path="equipo" element={<Equipo />} />
        <Route path="cobros" element={<Cobros />} />
        <Route path="asistente" element={<Asistente />} />
      </Route>
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
      <Route path="/:slug/r/:codigo" element={<EstadoReserva />} />
      <Route path="*" element={<NoEncontrado />} />
    </Routes>
  )
}
