// Demo del dueño, versión 2 (vertical, ~30 s), con el mismo sistema que la del jugador:
// capturas del panel por estado (frontend/scripts/capturas-demo-dueno.mjs) animadas acá.
import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { color, fuenteTexto, fuenteTitulo, suave } from "../marca";
import {
  Arriba,
  type Caja,
  Celular,
  clamp,
  type Escena,
  f,
  Logo,
  Montaje,
  Pantalla,
  plata,
  Recorte,
  Titulo,
} from "./DemoJugador";

// Dónde está cada cosa en la pantalla de 390x844 (de estados-dueno.json).
const CAJA = {
  reserva: { x: 234, y: 426, ancho: 150, alto: 64 },
  cuentas: { x: 12, y: 478, ancho: 366, alto: 128 },
  cobrar: { x: 20, y: 727, ancho: 350, alto: 43 },
  turno: { x: 78, y: 426, ancho: 148, alto: 64 },
  bloquear: { x: 278, y: 737, ancho: 96, alto: 43 },
  bloqueado: { x: 74, y: 452, ancho: 162, alto: 74 },
  precios: { x: 12, y: 560, ancho: 366, alto: 284 },
} satisfies Record<string, Caja>;

const SCROLL_AGENDA = 927; // donde quedó la agenda en las capturas 2 a 4

/** Lo que falta cobrar, con contador, y el desglose agrandado de la reserva. */
const PasoCuentas: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cuenta = interpolate(frame, [8, 8 + fps], [12000, 84000], { ...clamp, easing: suave });
  return (
    <>
      <div style={{ position: "absolute", left: 84, right: 84, top: 170 }}>
        <Titulo texto="Sabés cuánto falta cobrar" tamano={140} />
        <div
          style={{
            fontFamily: fuenteTitulo,
            fontWeight: 900,
            fontSize: 190,
            lineHeight: 1,
            marginTop: 16,
            color: color.cespedClaro,
            fontVariantNumeric: "tabular-nums",
            opacity: interpolate(frame, [8, 14], [0, 1], clamp),
          }}
        >
          {plata(cuenta)}
        </div>
        <div
          style={{
            fontFamily: fuenteTexto,
            fontWeight: 500,
            fontSize: 44,
            color: color.cal,
            marginTop: 18,
            opacity: interpolate(frame, [16, 24], [0, 1], clamp),
          }}
        >
          La seña ya entró por Mercado Pago.
        </div>
      </div>
      <Recorte src="dueno-3-detalle" caja={CAJA.cuentas} ancho={940} x={70} y={1060} desde={Math.round(0.6 * fps)} />
    </>
  );
};

export const DemoDueno: React.FC = () => {
  const { fps } = useVideoConfig();
  const c = (compases: number) => f(compases, fps);

  const escenas: Escena[] = [
    {
      compases: 1,
      tono: "noche",
      contenido: (
        <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: 84, gap: 60 }}>
          <Logo tamano={210} />
          <Titulo texto="Cómo gestionar tu complejo" tamano={200} ya />
        </AbsoluteFill>
      ),
    },
    {
      // Paso 1: título enorme detrás del celular; la agenda baja hasta la reserva y se toca.
      compases: 2,
      tono: "estadio",
      toques: [c(1.45)],
      contenido: (
        <>
          <div style={{ position: "absolute", left: 84, right: 84, top: 150 }}>
            <Titulo texto="Tu agenda, en el celu" tamano={185} />
          </div>
          <Celular x={210} y={700} ancho={660}>
            {(escala) => (
              <Pantalla
                escala={escala}
                capas={[
                  { src: "dueno-1-agenda-completa", scroll: [0, SCROLL_AGENDA], mover: [c(0.3), c(1.2)] },
                  { src: "dueno-3-detalle", aparece: c(1.45) + 14 },
                ]}
                toques={[{ caja: CAJA.reserva, en: c(1.45) }]}
              />
            )}
          </Celular>
        </>
      ),
    },
    {
      // Paso 2: contador y el desglose agrandado (sin el celular).
      compases: 2,
      tono: "verde",
      contenido: <PasoCuentas />,
    },
    {
      // Paso 3: el celular con el detalle; toque en "Cobré" y queda cobrado.
      compases: 2,
      tono: "cesped",
      toques: [c(0.9)],
      contenido: (
        <>
          <Arriba titulo="Cobrás y lo marcás" bajada="El saldo, en la cancha. Un toque y listo." />
          <Celular x={330} y={720} ancho={600} rotar={-3}>
            {(escala) => (
              <Pantalla
                escala={escala}
                capas={[
                  { src: "dueno-3-detalle" },
                  { src: "dueno-4-cobrado", aparece: c(0.9) + 4 },
                ]}
                toques={[{ caja: CAJA.cobrar, en: c(0.9) }]}
              />
            )}
          </Celular>
        </>
      ),
    },
    {
      // Paso 4: bloquear un turno: elegirlo, tocar "Bloquear" y ver el bloqueo agrandado.
      compases: 2.5,
      tono: "estadio",
      toques: [c(0.5), c(1.2)],
      contenido: (
        <>
          <Arriba titulo="¿Lluvia o torneo? Bloqueá" bajada="Nadie puede reservar encima." />
          <Celular x={160} y={720} ancho={600}>
            {(escala) => (
              <Pantalla
                escala={escala}
                capas={[
                  { src: "dueno-5-bloquear" },
                  { src: "dueno-6-elegido", aparece: c(0.5) + 4 },
                  { src: "dueno-7-bloqueado", aparece: c(1.2) + 12 },
                ]}
                toques={[
                  { caja: CAJA.turno, en: c(0.5) },
                  { caja: CAJA.bloquear, en: c(1.2) },
                ]}
              />
            )}
          </Celular>
          <Recorte src="dueno-7-bloqueado" caja={CAJA.bloqueado} ancho={420} x={590} y={1180} desde={c(1.6)} />
        </>
      ),
    },
    {
      // Paso 5: los precios, agrandados.
      compases: 2,
      tono: "noche",
      contenido: (
        <>
          <Arriba titulo="Tus horarios y tus precios" bajada="Por cancha, por día y por franja." />
          <Recorte src="dueno-8-horarios" caja={CAJA.precios} ancho={900} x={90} y={720} />
        </>
      ),
    },
    {
      // Paso 6: la página del complejo, con su marca.
      compases: 2.5,
      tono: "cesped",
      contenido: (
        <>
          <Arriba titulo="Tu complejo con su página" bajada="Los jugadores ven los turnos libres y reservan solos." />
          <Celular x={250} y={740} ancho={580} rotar={3}>
            {(escala) => <Pantalla escala={escala} capas={[{ src: "dueno-9-pagina" }]} />}
          </Celular>
        </>
      ),
    },
    {
      compases: 1.5,
      tono: "verde",
      contenido: (
        <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: 84, gap: 56 }}>
          <Logo tamano={190} />
          <Titulo texto="Sumá tu complejo" tamano={200} />
          <div style={{ fontFamily: fuenteTexto, fontWeight: 600, fontSize: 68, color: color.cal }}>haycanchas.com.ar</div>
        </AbsoluteFill>
      ),
    },
  ];

  return <Montaje escenas={escenas} />;
};
