// Reels cortos (1080x1920, ~15 s) con el sistema de las piezas: "¿Cuánto pago al reservar?"
// y "No es solo fútbol". Escenas de un compás de la música (124 BPM), cortes en el beat.
import type React from "react";
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { COMPAS, INICIO_MUSICA } from "../marca";
import { Titulo } from "../componentes/Piezas";
import { Bajada, C, CanchaDeFondo, CanchaDeporte, Celular, Firma } from "./sistema";

export const COMPASES_REEL = 8;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SONIDO_CORTE = "https://remotion.media/whoosh.wav";

/** Música, cortes sobre el compás y el fondo de cancha en vertical. */
const Base: React.FC<{ escenas: { compases: number; campo?: boolean; contenido: React.ReactNode }[] }> = ({
  escenas,
}) => {
  const { fps, durationInFrames } = useVideoConfig();
  let compas = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: C.noche }}>
      {escenas.map((e, i) => {
        const desde = Math.round(compas * COMPAS * fps);
        compas += e.compases;
        const hasta = Math.round(compas * COMPAS * fps);
        return (
          <Sequence key={i} from={desde} durationInFrames={hasta - desde} premountFor={fps}>
            <AbsoluteFill style={{ backgroundColor: e.campo ? C.campo : C.noche }}>
              <CanchaDeFondo ancho={1080} alto={1920} vertical />
              {e.contenido}
            </AbsoluteFill>
            {i > 0 && <Audio src={SONIDO_CORTE} volume={0.16} />}
          </Sequence>
        );
      })}
      <Audio
        src={staticFile("musica.mp3")}
        trimBefore={Math.round(INICIO_MUSICA * fps)}
        volume={(f) => interpolate(f, [0, 6, durationInFrames - fps, durationInFrames], [0, 0.6, 0.6, 0], clamp)}
      />
    </AbsoluteFill>
  );
};

/** Texto de una escena: título que entra palabra por palabra y bajada que aparece después. */
const Texto: React.FC<{
  titulo: string;
  bajada?: string;
  tamano?: number;
  top?: number;
  /** Visible desde el primer cuadro: WhatsApp usa ese cuadro como portada. */
  ya?: boolean;
}> = ({ titulo, bajada, tamano = 150, top = 300, ya }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 8, fps, config: { damping: 200 } });
  return (
    <div style={{ position: "absolute", left: 84, right: 84, top }}>
      <Titulo texto={titulo} tamano={tamano} retraso={ya ? -60 : 0} />
      {bajada && (
        <Bajada
          tamano={48}
          style={{ marginTop: 40, maxWidth: 860, opacity: p, translate: `0px ${interpolate(p, [0, 1], [16, 0])}px` }}
        >
          {bajada}
        </Bajada>
      )}
    </div>
  );
};

/** El celular entra desde abajo con un spring. */
const CelularQueSube: React.FC<{ captura: string; y?: number }> = ({ captura, y = 860 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - 4, fps, config: { damping: 22, stiffness: 140 } });
  return (
    <div style={{ position: "absolute", inset: 0, translate: `0px ${interpolate(p, [0, 1], [700, 0])}px` }}>
      <Celular captura={captura} ancho={600} x={240} y={y} />
    </div>
  );
};

const Cierre: React.FC<{ titulo: string }> = ({ titulo }) => (
  <>
    <Texto titulo={titulo} tamano={170} top={520} />
    <Firma x={84} y={1380} tamano={54} />
  </>
);

export const ReelCuantoPago: React.FC = () => (
  <Base
    escenas={[
      { compases: 1, contenido: <Texto titulo="¿Cuánto pago al reservar?" tamano={190} top={560} ya /> },
      {
        compases: 2,
        contenido: (
          <>
            <Texto titulo="Solo la seña" bajada="La decide cada complejo y la ves antes de pagar." />
            <CelularQueSube captura="oscuro-3-turno" />
          </>
        ),
      },
      {
        compases: 2,
        contenido: (
          <>
            <Texto titulo="Con Mercado Pago" bajada="Y el turno es tuyo, sin llamar a nadie." />
            <CelularQueSube captura="oscuro-5-confirmado" />
          </>
        ),
      },
      {
        compases: 2,
        campo: true,
        contenido: <Texto titulo="El resto, en la cancha" bajada="Lo pagás cuando vas a jugar." tamano={190} top={560} />,
      },
      { compases: 1, contenido: <Cierre titulo="Reservá en HayCanchas" /> },
    ]}
  />
);

/** Una cancha que se dibuja de abajo hacia arriba, como una línea de cal. */
const CanchaQueSeDibuja: React.FC<{ deportes: ("futbol" | "padel" | "tenis" | "basquet" | "voley")[] }> = ({
  deportes,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 200 }, durationInFrames: Math.round(0.9 * fps) });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 640,
        display: "flex",
        justifyContent: "center",
        gap: 70,
        clipPath: `inset(${(1 - p) * 100}% 0 0 0)`,
        scale: String(interpolate(p, [0, 1], [0.94, 1])),
      }}
    >
      {deportes.map((d) => (
        <CanchaDeporte key={d} deporte={d} alto={deportes.length > 1 ? 820 : 960} />
      ))}
    </div>
  );
};

export const ReelDeportes: React.FC = () => (
  <Base
    escenas={[
      { compases: 1, contenido: <Texto titulo="No es solo fútbol" tamano={210} top={600} ya /> },
      ...(
        [
          ["Fútbol 5, 7 y 11", ["futbol"]],
          ["Pádel", ["padel"]],
          ["Tenis", ["tenis"]],
          ["Básquet y vóley", ["basquet", "voley"]],
        ] as const
      ).map(([titulo, deportes]) => ({
        compases: deportes.length > 1 ? 1.5 : 1,
        contenido: (
          <>
            <Texto titulo={titulo} tamano={160} top={300} />
            <CanchaQueSeDibuja deportes={[...deportes]} />
          </>
        ),
      })),
      {
        compases: 2.5,
        campo: true,
        contenido: <Cierre titulo="Si se alquila por turno, se reserva acá" />,
      },
    ]}
  />
);

/** Portadas de los reels (cuadro 0: cuánto pago, 1: deportes). Lo importante va en el
 * centro: la grilla del perfil las recorta en 3:4. */
export const PortadasReels: React.FC = () => {
  const n = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.noche }}>
      <CanchaDeFondo ancho={1080} alto={1920} vertical />
      {n === 0 ? (
        <>
          <div style={{ position: "absolute", left: 84, right: 84, top: 470 }}>
            <Titulo texto="¿Cuánto pago al reservar?" tamano={230} retraso={-60} />
            <Bajada tamano={56} style={{ marginTop: 48, color: C.acento }}>
              Solo la seña.
            </Bajada>
          </div>
        </>
      ) : (
        <>
          <div style={{ position: "absolute", left: 84, right: 84, top: 330 }}>
            <Titulo texto="No es solo fútbol" tamano={230} retraso={-60} />
          </div>
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 1030,
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              gap: 26,
            }}
          >
            {(["futbol", "padel", "tenis", "basquet", "voley"] as const).map((d) => (
              <CanchaDeporte key={d} deporte={d} alto={d === "futbol" ? 390 : 320} />
            ))}
          </div>
        </>
      )}
      <Firma x={84} y={1560} tamano={44} />
    </AbsoluteFill>
  );
};
