import { Composition } from "remotion";
import { calcularSerie, FPS, Serie } from "./Serie";

// Dos videos de la misma serie. El formato se elige al renderizar:
// --props='{"formato":"vertical"}' para reels (1080x1920).
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Jugador"
        component={Serie}
        durationInFrames={60 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ serie: "jugador", formato: "horizontal" }}
        calculateMetadata={calcularSerie}
      />
      <Composition
        id="Dueno"
        component={Serie}
        durationInFrames={60 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ serie: "dueno", formato: "horizontal" }}
        calculateMetadata={calcularSerie}
      />
    </>
  );
};
