import { EnConstruccion } from '../../components/EnConstruccion'

export default function EstadoReserva() {
  return (
    <EnConstruccion titulo="Estado de la reserva" fase={2}>
      Muestra &quot;esperando el pago&quot; hasta que Mercado Pago confirme la seña, y después el turno confirmado.
    </EnConstruccion>
  )
}
