import { useParams } from 'react-router'

import { EnConstruccion } from '../../components/EnConstruccion'

export default function Panel() {
  const { slug } = useParams()
  return (
    <EnConstruccion titulo="Panel del complejo" fase={1}>
      {slug ? (
        <>
          Acá va a estar la agenda de <b className="text-noche">{slug}</b>, con login para el dueño y sus empleados.
        </>
      ) : (
        'Acá va el ingreso de los dueños y empleados de cada complejo.'
      )}
    </EnConstruccion>
  )
}
