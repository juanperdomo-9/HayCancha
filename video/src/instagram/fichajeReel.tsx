// Reel de "Nuevo fichaje" (vertical, ~16 s): el anuncio del complejo que se suma, con el
// mismo sistema que los reels del jugador y del dueño (Montaje, fundidos, celular con luz).
import type React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { color, fuenteTexto, fuenteTitulo, suave } from "../marca";
import { Arriba, Celular, clamp, type Escena, f, Logo, Montaje, Pantalla, Titulo } from "../demo/DemoJugador";
import { Escudo, ficha, type PropsFichaje } from "./fichaje";

export const COMPASES_FICHAJE = 8.5;

/** "OFICIAL" que cae con un golpe; visible desde el primer cuadro (portada en WhatsApp). */
const Oficial: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 12, stiffness: 160 } });
  return (
    <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: 84 }}>
      <div
        style={{
          fontFamily: fuenteTitulo,
          fontWeight: 900,
          fontSize: 300,
          lineHeight: 0.85,
          color: color.cespedClaro,
          scale: String(interpolate(p, [0, 1], [1.12, 1])),
          transformOrigin: "left center",
        }}
      >
        OFICIAL
      </div>
      <div style={{ fontFamily: fuenteTexto, fontWeight: 600, fontSize: 56, color: color.cal, marginTop: 30 }}>
        Nuevo complejo en HayCanchas
      </div>
    </AbsoluteFill>
  );
};

const Presentacion: React.FC<{ datos: NonNullable<PropsFichaje["datos"]> }> = ({ datos }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 84,
          top: 360,
          scale: String(interpolate(p, [0, 1], [0.6, 1])),
          rotate: `${interpolate(p, [0, 1], [-20, 0])}deg`,
          opacity: interpolate(p, [0, 0.3], [0, 1], clamp),
        }}
      >
        <Escudo d={datos} tamano={420} />
      </div>
      <div style={{ position: "absolute", left: 84, right: 84, top: 900 }}>
        <Titulo texto={datos.nombre} tamano={170} />
        <div
          style={{
            fontFamily: fuenteTexto,
            fontWeight: 500,
            fontSize: 56,
            color: color.cal,
            marginTop: 34,
            opacity: interpolate(frame, [14, 24], [0, 1], { ...clamp, easing: suave }),
          }}
        >
          se suma a HayCanchas.
        </div>
      </div>
    </>
  );
};

/** La ficha técnica, una fila por vez. */
const Ficha: React.FC<{ datos: NonNullable<PropsFichaje["datos"]> }> = ({ datos }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <>
      <Arriba titulo="Ficha técnica" tamano={170} />
      <div style={{ position: "absolute", left: 84, right: 84, top: 600, display: "grid", gap: 56 }}>
        {ficha(datos).map(([etiqueta, valor], i) => {
          const p = interpolate(frame, [8 + i * 0.35 * fps, 8 + i * 0.35 * fps + 10], [0, 1], { ...clamp, easing: suave });
          return (
            <div key={etiqueta} style={{ opacity: p, translate: `0px ${interpolate(p, [0, 1], [24, 0])}px` }}>
              <div style={{ fontFamily: fuenteTexto, fontWeight: 500, fontSize: 42, color: color.cespedClaro }}>{etiqueta}</div>
              <div
                style={{
                  fontFamily: fuenteTitulo,
                  fontWeight: 800,
                  fontSize: 76,
                  lineHeight: 1.02,
                  color: color.cal,
                  marginTop: 8,
                  textWrap: "balance",
                }}
              >
                {valor}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export const FichajeReel: React.FC<PropsFichaje> = ({ datos }) => {
  const { fps } = useVideoConfig();
  if (!datos) return null;
  const escenas: Escena[] = [
    { compases: 1, tono: "noche", contenido: <Oficial /> },
    { compases: 2, tono: "estadio", contenido: <Presentacion datos={datos} /> },
    { compases: 2.5, tono: "noche", contenido: <Ficha datos={datos} /> },
    {
      compases: 1.5,
      tono: "cesped",
      contenido: (
        <>
          <Arriba titulo="Ya podés reservar" bajada={`haycanchas.com.ar/${datos.slug}`} tamano={170} />
          <Celular x={220} y={720} ancho={640}>
            {(escala) => (
              <Pantalla escala={escala} capas={[{ src: `fichaje-${datos.slug}`, scroll: [0, 180], mover: [f(0.3, fps), f(1.4, fps)] }]} />
            )}
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
          <Titulo texto="Bienvenidos al equipo" tamano={190} />
          <div style={{ fontFamily: fuenteTexto, fontWeight: 600, fontSize: 52, color: color.cal, whiteSpace: "nowrap" }}>
            haycanchas.com.ar/{datos.slug}
          </div>
        </AbsoluteFill>
      ),
    },
  ];
  return <Montaje escenas={escenas} />;
};
