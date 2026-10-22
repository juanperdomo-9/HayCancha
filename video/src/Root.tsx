import { Composition, Folder } from "remotion";
import { calcularSerie, FPS, Serie } from "./Serie";
import {
  CARRUSELES,
  Carrusel,
  DESTACADAS,
  Historias,
  PortadasDestacadas,
} from "./instagram/piezas";
import {
  COMPASES_REEL,
  PortadasReels,
  ReelCuantoPago,
  ReelDeportes,
} from "./instagram/reels";
import { COMPAS } from "./marca";
import { COMPASES_DEMO, DemoJugador } from "./demo/DemoJugador";
import { DemoDueno } from "./demo/DemoDueno";
import { calcularFichaje, Fichaje, FichajeHistoria } from "./instagram/fichaje";
import { COMPASES_FICHAJE, FichajeReel } from "./instagram/fichajeReel";

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
      {/* Instagram: cada cuadro es una pieza (scripts/instagram.mjs las exporta). */}
      <Composition
        id="JugadorV2"
        component={DemoJugador}
        durationInFrames={Math.round(COMPASES_DEMO * COMPAS * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="DuenoV2"
        component={DemoDueno}
        durationInFrames={Math.round(COMPASES_DEMO * COMPAS * FPS)}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Folder name="Instagram">
        {Object.entries(CARRUSELES).map(([id, piezas]) => (
          <Composition
            key={id}
            id={`IG-${id}`}
            component={Carrusel}
            durationInFrames={piezas.length}
            fps={FPS}
            width={1080}
            height={1350}
            defaultProps={{ id: id as keyof typeof CARRUSELES }}
          />
        ))}
        <Composition
          id="IG-portadas"
          component={PortadasDestacadas}
          durationInFrames={DESTACADAS.length}
          fps={FPS}
          width={1080}
          height={1920}
        />
        {DESTACADAS.map((d) => (
          <Composition
            key={d.id}
            id={`IG-historias-${d.id}`}
            component={Historias}
            durationInFrames={d.historias.length}
            fps={FPS}
            width={1080}
            height={1920}
            defaultProps={{ id: d.id }}
          />
        ))}
        <Composition
          id="IG-reel-cuanto-pago"
          component={ReelCuantoPago}
          durationInFrames={Math.round(COMPASES_REEL * COMPAS * FPS)}
          fps={FPS}
          width={1080}
          height={1920}
        />
        <Composition
          id="IG-reel-deportes"
          component={ReelDeportes}
          durationInFrames={Math.round(COMPASES_REEL * COMPAS * FPS)}
          fps={FPS}
          width={1080}
          height={1920}
        />
        <Composition
          id="IG-portadas-reels"
          component={PortadasReels}
          durationInFrames={2}
          fps={FPS}
          width={1080}
          height={1920}
        />
        <Composition
          id="IG-fichaje"
          component={Fichaje}
          durationInFrames={3}
          fps={FPS}
          width={1080}
          height={1350}
          defaultProps={{ slug: "los-ceibos" }}
          calculateMetadata={calcularFichaje}
        />
        <Composition
          id="IG-fichaje-historia"
          component={FichajeHistoria}
          durationInFrames={1}
          fps={FPS}
          width={1080}
          height={1920}
          defaultProps={{ slug: "los-ceibos" }}
          calculateMetadata={calcularFichaje}
        />
        <Composition
          id="IG-fichaje-reel"
          component={FichajeReel}
          durationInFrames={Math.round(COMPASES_FICHAJE * COMPAS * FPS)}
          fps={FPS}
          width={1080}
          height={1920}
          defaultProps={{ slug: "los-ceibos" }}
          calculateMetadata={calcularFichaje}
        />
      </Folder>
    </>
  );
};
