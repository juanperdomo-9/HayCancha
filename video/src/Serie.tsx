// Un video de la serie: intro, escenas cortadas sobre el beat (con cuatro diseños que se
// van alternando) y cierre, con música y efectos de sonido.
import type React from "react";
import {
  AbsoluteFill,
  type CalculateMetadataFunction,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import {
  cargarGrabacion,
  type Formato,
  type Grabacion,
  type Serie as SerieId,
} from "./datos";
import {
  COMPASES_CIERRE,
  COMPASES_INTRO,
  EDICIONES,
  type Escena as EscenaDatos,
  type Mascara,
} from "./edicion";
import { COMPAS, INICIO_MUSICA, rapida, suave } from "./marca";
import {
  Bajada,
  Celular,
  Cierre,
  Contador,
  Flotante,
  Fondo,
  Intro,
  Titulo,
} from "./componentes/Piezas";

export type PropsSerie = {
  serie: SerieId;
  formato: Formato;
  grabacion?: Grabacion;
};

export const FPS = 30;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const SONIDO = {
  whoosh: "https://remotion.media/whoosh.wav",
  clic: "https://remotion.media/mouse-click.wav",
};

/** Las escenas del formato, con su lugar en el tiempo (en compases, para cortar en el beat). */
function armar(serie: SerieId, formato: Formato) {
  const edicion = EDICIONES[serie];
  let compas = COMPASES_INTRO;
  const escenas = edicion.escenas
    .filter((e) => e.compases[formato] > 0)
    .map((escena) => {
      const desde = compas;
      compas += escena.compases[formato];
      return { escena, desde, hasta: compas };
    });
  return { edicion, escenas, total: compas + COMPASES_CIERRE };
}

const aFrames = (compases: number, fps: number) =>
  Math.round(compases * COMPAS * fps);

export const calcularSerie: CalculateMetadataFunction<PropsSerie> = async ({
  props,
}) => {
  const grabacion = await cargarGrabacion(props.serie);
  const vertical = props.formato === "vertical";
  return {
    width: vertical ? 1080 : 1920,
    height: vertical ? 1920 : 1080,
    durationInFrames: aFrames(armar(props.serie, props.formato).total, FPS),
    props: { ...props, grabacion },
  };
};

export const Serie: React.FC<PropsSerie> = ({ serie, formato, grabacion }) => {
  const { fps, durationInFrames } = useVideoConfig();
  if (!grabacion) return null;
  const vertical = formato === "vertical";
  const { edicion, escenas } = armar(serie, formato);
  const finIntro = aFrames(COMPASES_INTRO, fps);
  const inicioCierre = aFrames(escenas[escenas.length - 1].hasta, fps);

  // Un clic en cada toque que cae dentro de una escena.
  const clics = escenas.flatMap(({ escena, desde, hasta }) => {
    if (!escena.clip) return [];
    const velocidad =
      (escena.clip.hasta - escena.clip.desde) / ((hasta - desde) * COMPAS);
    return grabacion.pasos
      .map((p) => p.foco?.toque)
      .filter(
        (t): t is number =>
          t !== undefined && t >= escena.clip!.desde && t < escena.clip!.hasta,
      )
      .map(
        (t) =>
          aFrames(desde, fps) +
          Math.round(((t - escena.clip!.desde) / velocidad) * fps),
      );
  });

  return (
    <AbsoluteFill>
      <Fondo />
      <Sequence name="Intro" durationInFrames={finIntro}>
        <Intro titulo={edicion.titulo} vertical={vertical} />
      </Sequence>

      {escenas.map(({ escena, desde, hasta }) => (
        <Sequence
          key={escena.titulo}
          name={escena.titulo}
          from={aFrames(desde, fps)}
          durationInFrames={aFrames(hasta, fps) - aFrames(desde, fps)}
          premountFor={fps}
        >
          <Escena
            escena={escena}
            vertical={vertical}
            archivo={grabacion.video}
            mascaras={edicion.mascaras}
            segundos={(hasta - desde) * COMPAS}
          />
        </Sequence>
      ))}

      <Sequence name="Cierre" from={inicioCierre} premountFor={fps}>
        <Cierre llamado={edicion.llamado} vertical={vertical} />
      </Sequence>

      {/* Sonido: la música, un whoosh en cada corte y un clic en cada toque. */}
      <Audio
        src={staticFile("musica.mp3")}
        trimBefore={Math.round(INICIO_MUSICA * fps)}
        volume={(f) =>
          interpolate(
            f,
            [0, 6, durationInFrames - 1.4 * fps, durationInFrames],
            [0, 0.6, 0.6, 0],
            clamp,
          )
        }
      />
      {[
        finIntro,
        ...escenas.slice(1).map((e) => aFrames(e.desde, fps)),
        inicioCierre,
      ].map((f) => (
        <Sequence
          key={`whoosh-${f}`}
          from={Math.max(0, f - 6)}
          durationInFrames={fps}
          premountFor={fps}
        >
          <Audio src={SONIDO.whoosh} volume={0.18} />
        </Sequence>
      ))}
      {clics.map((f) => (
        <Sequence
          key={`clic-${f}`}
          from={f}
          durationInFrames={fps}
          premountFor={fps}
        >
          <Audio src={SONIDO.clic} volume={0.3} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

type Caja = { left: number; top: number; ancho: number; alto: number };

/** Dónde va el celular y el título en cada diseño. */
function disposicion(escena: EscenaDatos, vertical: boolean) {
  const izquierda = escena.lado === "izquierda";
  if (vertical) {
    const cel = { ancho: 756, alto: 1344, top: 520 };
    if (escena.diseno === "lateral") {
      return { cel: { ...cel, left: izquierda ? 70 : 254 }, tamano: 150 };
    }
    return {
      cel: { ...cel, left: 162 },
      tamano: escena.diseno === "centrado" ? 180 : 150,
    };
  }
  const cel = { ancho: 486, alto: 864, top: 108 };
  if (escena.diseno === "lateral") {
    return { cel: { ...cel, left: izquierda ? 330 : 1104 }, tamano: 170 };
  }
  if (escena.diseno === "inclinado")
    return { cel: { ...cel, left: 1130 }, tamano: 160 };
  return { cel: { ...cel, left: 717 }, tamano: 200 };
}

const Escena: React.FC<{
  escena: EscenaDatos;
  vertical: boolean;
  archivo: string;
  mascaras: Mascara[];
  segundos: number;
}> = ({ escena, vertical, archivo, mascaras, segundos }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  if (escena.diseno === "texto" || !escena.clip) {
    return (
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          gap: vertical ? 40 : 34,
          padding: vertical ? 90 : 160,
          textAlign: "center",
        }}
      >
        <Titulo
          texto={escena.titulo}
          tamano={vertical ? 120 : 120}
          align="center"
        />
        {escena.contador && (
          <>
            <Contador
              valor={escena.contador.valor}
              tamano={vertical ? 260 : 320}
              retraso={8}
            />
            <Bajada
              texto={escena.contador.bajada}
              tamano={vertical ? 50 : 50}
              retraso={22}
            />
          </>
        )}
      </AbsoluteFill>
    );
  }

  const { cel, tamano } = disposicion(escena, vertical);
  const clip = {
    ...escena.clip,
    velocidad: (escena.clip.hasta - escena.clip.desde) / segundos,
  };
  const entrada = spring({ frame, fps, config: { damping: 200 } });

  // El elemento flotante sale cuando la grabación llega a ese momento.
  const flotante = escena.flotante;
  const inicioFlotante = flotante
    ? Math.min(
        Math.max((flotante.t - clip.desde) / clip.velocidad - 0.1, 0.4),
        segundos - 1.5,
      )
    : 0;
  const duracionFlotante = Math.min(1.7, segundos - inicioFlotante - 0.05);
  const oscuro = flotante
    ? Math.min(
        interpolate(
          frame,
          [inicioFlotante * fps, (inicioFlotante + 0.25) * fps],
          [0, 1],
          {
            ...clamp,
            easing: suave,
          },
        ),
        interpolate(
          frame,
          [
            (inicioFlotante + duracionFlotante - 0.22) * fps,
            (inicioFlotante + duracionFlotante) * fps,
          ],
          [1, 0],
          { ...clamp, easing: rapida },
        ),
      )
    : 0;

  const inclinado = escena.diseno === "inclinado";
  const giro = interpolate(
    frame,
    [0, segundos * fps],
    [vertical ? -14 : -24, vertical ? -8 : -16],
  );
  const borde = Math.round(cel.ancho * 0.022);
  const pantalla: Caja = {
    left: cel.left + borde,
    top: cel.top + borde,
    ancho: cel.ancho - 2 * borde,
    alto: cel.alto - 2 * borde,
  };

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: `brightness(${1 - 0.6 * oscuro})` }}>
        <TituloDeEscena
          escena={escena}
          vertical={vertical}
          tamano={tamano}
          cel={cel}
          width={width}
        />
        <div
          style={{
            position: "absolute",
            left: cel.left,
            top: cel.top,
            opacity: entrada,
            // Entra desde cerca (36 px, 0,97) y con un desenfoque corto que disimula el corte.
            translate: `0px ${interpolate(entrada, [0, 1], [36, 0])}px`,
            scale: String(interpolate(entrada, [0, 1], [0.97, 1])),
            filter: `blur(${interpolate(frame, [0, 5], [6, 0], clamp)}px)`,
            transform: inclinado
              ? `perspective(2400px) rotateY(${giro}deg) rotateX(${vertical ? 8 : 6}deg) rotateZ(-1.5deg)`
              : undefined,
          }}
        >
          <Celular
            archivo={archivo}
            clip={clip}
            ancho={cel.ancho}
            alto={cel.alto}
            mascaras={mascaras}
          />
        </div>
      </AbsoluteFill>
      {flotante && (
        <Sequence
          from={Math.round(inicioFlotante * fps)}
          durationInFrames={Math.round(duracionFlotante * fps)}
          premountFor={fps}
        >
          <Flotante
            archivo={archivo}
            zona={flotante}
            pantalla={pantalla}
            centro={{ x: width / 2, y: vertical ? height * 0.55 : height / 2 }}
            maximo={
              vertical ? { ancho: 960, alto: 900 } : { ancho: 1150, alto: 760 }
            }
            duracion={Math.round(duracionFlotante * fps)}
          />
        </Sequence>
      )}
    </AbsoluteFill>
  );
};

/** El título de cada diseño. Nunca tapa la pantalla: va detrás del celular o al costado. */
const TituloDeEscena: React.FC<{
  escena: EscenaDatos;
  vertical: boolean;
  tamano: number;
  cel: Caja;
  width: number;
}> = ({ escena, vertical, tamano, cel, width }) => {
  if (vertical) {
    // Arriba; en "centrado" la última línea queda apenas detrás del celular.
    const izquierda =
      escena.diseno === "lateral" && escena.lado !== "izquierda";
    return (
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          bottom: 1920 - cel.top + (escena.diseno === "centrado" ? -14 : 40),
        }}
      >
        <Titulo
          texto={escena.titulo}
          tamano={tamano}
          align={
            escena.diseno === "lateral"
              ? izquierda
                ? "left"
                : "right"
              : "center"
          }
        />
      </div>
    );
  }
  if (escena.diseno === "centrado") {
    // Dos bloques a los lados del celular, que se meten un poco detrás.
    const palabras = escena.titulo.split(" ");
    const mitad = Math.ceil(palabras.length / 2);
    const izq = palabras.slice(0, mitad).join(" ");
    const der = palabras.slice(mitad).join(" ");
    const lugar = cel.left - 40;
    return (
      <>
        <div
          style={{
            position: "absolute",
            right: width - cel.left - 70,
            width: lugar,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
          }}
        >
          <Titulo texto={izq} tamano={tamano} align="right" />
        </div>
        <div
          style={{
            position: "absolute",
            left: cel.left + cel.ancho - 70,
            width: lugar,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Titulo
            texto={der}
            tamano={tamano}
            align="left"
            retraso={palabras.length > 2 ? 6 : 3}
          />
        </div>
      </>
    );
  }
  const celALaIzquierda = cel.left < width / 2;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        ...(celALaIzquierda
          ? { left: cel.left + cel.ancho + 110, right: 110 }
          : { left: 150, right: width - cel.left + 110 }),
      }}
    >
      <Titulo texto={escena.titulo} tamano={tamano} />
    </div>
  );
};
