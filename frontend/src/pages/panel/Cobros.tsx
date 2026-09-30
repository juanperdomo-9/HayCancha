import { CircleCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'

import { mensaje } from '../../api/client'
import { type EstadoCobros, useCobros, useDesvincularMercadoPago, useVincularMercadoPago } from '../../api/cobros'
import { Aviso, Boton, Tarjeta } from '../../components/ui/Formulario'
import { EncabezadoSeccion } from './EncabezadoSeccion'

/** Lo que vuelve de Mercado Pago en ?mp= después de autorizar (o no). */
const RESULTADOS = {
  vinculado: { tipo: 'ok', texto: '¡Listo! Mercado Pago quedó vinculado.' },
  cancelado: {
    tipo: 'info',
    texto: 'No se vinculó: se canceló la autorización en Mercado Pago.',
  },
  error: {
    tipo: 'error',
    texto: 'No pudimos vincular Mercado Pago. Probá de nuevo en unos minutos.',
  },
} as const

export default function Cobros() {
  const { slug = '' } = useParams()
  const [parametros, setParametros] = useSearchParams()
  const cobros = useCobros(slug)
  // El resultado se lee una vez y se saca de la dirección (así no queda al recargar).
  const [resultado, setResultado] = useState<(typeof RESULTADOS)[keyof typeof RESULTADOS] | undefined>(() => RESULTADOS[parametros.get('mp') as keyof typeof RESULTADOS])
  useEffect(() => {
    if (parametros.has('mp')) setParametros({}, { replace: true })
  }, [parametros, setParametros])

  return (
    <div className="grid gap-6">
      <EncabezadoSeccion
        titulo="Cobros"
        bajada="Las señas de las reservas online se cobran con Mercado Pago y entran directo a la cuenta del complejo. HayCancha no toca esa plata."
      />
      {resultado && <Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>}
      {cobros.error && <Aviso>{mensaje(cobros.error)}</Aviso>}
      {!cobros.data && !cobros.error && <p className="text-gris">Cargando…</p>}
      {cobros.data &&
        (cobros.data.vinculado ? (
          <Vinculado slug={slug} estado={cobros.data} onDesvinculado={() => setResultado(undefined)} />
        ) : (
          <SinVincular slug={slug} disponible={cobros.data.disponible} />
        ))}
    </div>
  )
}

function SinVincular({ slug, disponible }: { slug: string; disponible: boolean }) {
  const vincular = useVincularMercadoPago(slug)
  return (
    <Tarjeta titulo="Vinculá tu cuenta de Mercado Pago" descripcion="Se hace una sola vez y tarda un minuto.">
      <ol className="grid gap-2.5 text-[15px]">
        {['Tocá «Vincular Mercado Pago».', 'Entrá con la cuenta de Mercado Pago donde querés cobrar las señas.', 'Autorizá a HayCancha. Volvés acá solo.'].map(
          (paso, i) => (
            <li key={paso} className="flex gap-3">
              <span className="numeros grid size-6 flex-none place-items-center rounded-full bg-noche text-[13px] font-bold text-crema">{i + 1}</span>
              {paso}
            </li>
          ),
        )}
      </ol>
      <p className="mt-4 text-sm text-gris">
        HayCancha usa este permiso solo para cobrar las señas y devolverlas cuando corresponde. Lo podés quitar cuando quieras desde acá.
      </p>
      <div className="mt-5 grid gap-3">
        {!disponible && <Aviso tipo="info">Todavía no se puede vincular: HayCancha está terminando de configurar Mercado Pago. Te avisamos cuando esté listo.</Aviso>}
        {vincular.error && <Aviso>{mensaje(vincular.error)}</Aviso>}
        <Boton onClick={() => vincular.mutate()} disabled={!disponible || vincular.isPending} className="justify-self-start">
          {vincular.isPending ? 'Yendo a Mercado Pago…' : 'Vincular Mercado Pago'}
        </Boton>
      </div>
    </Tarjeta>
  )
}

function Vinculado({ slug, estado, onDesvinculado }: { slug: string; estado: EstadoCobros; onDesvinculado: () => void }) {
  const desvincular = useDesvincularMercadoPago(slug)
  const [confirmando, setConfirmando] = useState(false)
  return (
    <Tarjeta>
      <div className="flex items-start gap-3">
        <CircleCheck className="mt-0.5 size-6 flex-none text-cesped" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-bold">Mercado Pago vinculado</h2>
          <p className="mt-0.5 text-sm text-gris">
            Cuenta N.º <span className="numeros font-semibold text-noche">{estado.cuenta_mp}</span>. El permiso se renueva solo.
          </p>
        </div>
      </div>
      <div className="mt-5 border-t border-linea pt-4">
        {desvincular.error && (
          <div className="mb-3">
            <Aviso>{mensaje(desvincular.error)}</Aviso>
          </div>
        )}
        {confirmando ? (
          <div className="grid gap-3">
            <p className="text-sm font-semibold">¿Seguro? Sin Mercado Pago, tu página deja de tomar reservas online.</p>
            <div className="flex flex-wrap gap-2">
              <Boton
                variante="peligro"
                cargando={desvincular.isPending}
                onClick={() =>
                  desvincular.mutate(undefined, {
                    onSuccess: () => {
                      setConfirmando(false)
                      onDesvinculado()
                    },
                  })
                }
              >
                Sí, desvincular
              </Boton>
              <Boton variante="suave" onClick={() => setConfirmando(false)}>
                No, dejarlo
              </Boton>
            </div>
          </div>
        ) : (
          <Boton variante="peligro" onClick={() => setConfirmando(true)}>
            Desvincular
          </Boton>
        )}
      </div>
    </Tarjeta>
  )
}
