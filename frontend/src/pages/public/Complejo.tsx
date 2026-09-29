import { useParams } from 'react-router'

import { EnConstruccion } from '../../components/EnConstruccion'

export default function Complejo() {
  const { slug } = useParams()
  return (
    <EnConstruccion titulo="Página del complejo" fase={1}>
      Acá va la página de <b className="text-noche">{slug}</b>: horarios libres, reserva y pago de la seña. Los jugadores reservan sin
      crear una cuenta.
    </EnConstruccion>
  )
}
