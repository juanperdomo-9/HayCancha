import { type FormEvent, useState } from 'react'
import { useParams } from 'react-router'

import { mensaje } from '../../api/client'
import { type Configuracion, useConfiguracion, useGuardarConfiguracion } from '../../api/panel'
import { Aviso, Boton, Campo, Tarjeta } from '../../components/ui/Formulario'
import { plata } from '../../utils/formato'
import { EncabezadoSeccion } from './EncabezadoSeccion'

const TURNO_DE_EJEMPLO = 85000

export default function Reservas() {
  const { slug = '' } = useParams()
  const configuracion = useConfiguracion(slug)
  if (configuracion.error) return <Aviso>{mensaje(configuracion.error)}</Aviso>
  if (!configuracion.data) return <p className="text-gris">Cargando…</p>
  return <FormularioReservas slug={slug} configuracion={configuracion.data} />
}

function FormularioReservas({ slug, configuracion: c }: { slug: string; configuracion: Configuracion }) {
  const guardar = useGuardarConfiguracion(slug)
  const [datos, setDatos] = useState({
    sena_tipo: c.sena_tipo,
    sena_valor: String(Number(c.sena_valor)),
    horas_cancelacion: String(c.horas_cancelacion),
    minutos_para_pagar: String(c.minutos_para_pagar),
  })
  const [ok, setOk] = useState(false)

  function enviar(e: FormEvent) {
    e.preventDefault()
    setOk(false)
    guardar.mutate(
      {
        sena_tipo: datos.sena_tipo,
        sena_valor: datos.sena_valor || '0',
        horas_cancelacion: Number(datos.horas_cancelacion),
        minutos_para_pagar: Number(datos.minutos_para_pagar),
      },
      { onSuccess: () => setOk(true) },
    )
  }

  const valor = Number(datos.sena_valor) || 0
  const senaEjemplo = datos.sena_tipo === 'porcentaje' ? (TURNO_DE_EJEMPLO * valor) / 100 : Math.min(valor, TURNO_DE_EJEMPLO)

  return (
    <form onSubmit={enviar} className="grid gap-6">
      <EncabezadoSeccion titulo="Seña y cancelación" bajada="Cuánto paga el jugador para reservar y hasta cuándo puede cancelar sin perderla." />
      <Tarjeta titulo="Seña" descripcion="Lo habitual es un 20% del turno.">
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-[13px] font-semibold">Tipo de seña</legend>
            {(
              [
                ['porcentaje', 'Un porcentaje del turno'],
                ['fija', 'Un monto fijo'],
              ] as const
            ).map(([tipo, texto]) => (
              <label key={tipo} className="flex cursor-pointer items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-linea has-checked:ring-2 has-checked:ring-complejo">
                <input
                  type="radio"
                  name="sena_tipo"
                  checked={datos.sena_tipo === tipo}
                  onChange={() => setDatos({ ...datos, sena_tipo: tipo })}
                  className="accent-[var(--complejo)]"
                />
                {texto}
              </label>
            ))}
          </fieldset>
          <div className="grid content-start gap-3">
            <Campo
              etiqueta={datos.sena_tipo === 'porcentaje' ? 'Porcentaje' : 'Monto'}
              prefijo={datos.sena_tipo === 'porcentaje' ? '%' : '$'}
              type="number"
              min={0}
              max={datos.sena_tipo === 'porcentaje' ? 100 : undefined}
              inputMode="numeric"
              required
              value={datos.sena_valor}
              onChange={(e) => setDatos({ ...datos, sena_valor: e.target.value })}
            />
            <p className="rounded-xl bg-complejo-suave px-3.5 py-2.5 text-sm">
              Con un turno de {plata(TURNO_DE_EJEMPLO)}, la seña es <b className="text-complejo-texto">{plata(senaEjemplo)}</b> y el resto se paga en la cancha.
            </p>
          </div>
        </div>
      </Tarjeta>
      <Tarjeta titulo="Cancelación y pago">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Horas de anticipación para cancelar"
            type="number"
            min={0}
            inputMode="numeric"
            required
            value={datos.horas_cancelacion}
            onChange={(e) => setDatos({ ...datos, horas_cancelacion: e.target.value })}
            ayuda={`Si cancela con más de ${datos.horas_cancelacion || '…'} horas, se le devuelve la seña. Con menos, la pierde.`}
          />
          <Campo
            etiqueta="Minutos para pagar la seña"
            type="number"
            min={1}
            max={120}
            inputMode="numeric"
            required
            value={datos.minutos_para_pagar}
            onChange={(e) => setDatos({ ...datos, minutos_para_pagar: e.target.value })}
            ayuda="Si no paga en ese tiempo, el turno se libera. Recomendamos 10."
          />
        </div>
      </Tarjeta>
      <div className="grid gap-3">
        {guardar.error && <Aviso>{mensaje(guardar.error)}</Aviso>}
        {ok && <Aviso tipo="ok">Guardado.</Aviso>}
        <Boton type="submit" cargando={guardar.isPending} className="justify-self-start px-6 py-3 text-base">
          Guardar
        </Boton>
      </div>
    </form>
  )
}
