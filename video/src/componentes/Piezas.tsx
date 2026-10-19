// Piezas de la serie: título palabra por palabra, contador, celular, elemento flotante,
// intro y cierre. Todo se anima con el frame (nada de transiciones CSS).
import type React from "react";
import {
  AbsoluteFill,
  Freeze,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import {
  color,
  fuenteTexto,
  fuenteTitulo,
  rapida,
  suave,
  URL_REAL,
} from "../marca";
import type { Mascara, Zona } from "../edicion";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const Fondo: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundColor: color.fondo,
      backgroundImage: `radial-gradient(ellipse at 50% 120%, ${color.bloque} 0%, transparent 60%)`,
    }}
  />
);

/** Título enorme que entra palabra por palabra, revelado por máscara. */
export const Titulo: React.FC<{
  texto: string;
  tamano: number;
  align?: "left" | "center" | "right";
  retraso?: number;
  style?: React.CSSProperties;
}> = ({ texto, tamano, align = "left", retraso = 0, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        fontFamily: fuenteTitulo,
        fontWeight: 900,
        fontSize: tamano,
        lineHeight: 0.9,
        letterSpacing: "-0.005em",
        textTransform: "uppercase",
        color: color.cal,
        textAlign: align,
        ...style,
      }}
    >
      {texto.split(" ").map((palabra, i) => {
        const p = spring({
          frame: frame - retraso - i * 2, // ~67 ms entre palabras
          fps,
          config: { damping: 200, mass: 0.6 },
        });
        return (
          <span
            key={`${palabra}-${i}`}
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "top",
              // Aire arriba para tildes y eñes (si no, la máscara las corta).
              paddingTop: "0.16em",
              marginTop: "-0.16em",
              paddingBottom: "0.04em",
              marginRight: "0.22em",
            }}
          >
            <span
              style={{
                display: "inline-block",
                translate: `0px ${interpolate(p, [0, 1], [105, 0])}%`,
              }}
            >
              {palabra}
            </span>
          </span>
        );
      })}
    </div>
  );
};

const plata = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

/** Un monto que se cuenta de 0 a su valor. */
export const Contador: React.FC<{
  valor: number;
  tamano: number;
  retraso?: number;
}> = ({ valor, tamano, retraso = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [retraso, retraso + 1.1 * fps], [0, 1], {
    ...clamp,
    easing: suave,
  });
  return (
    <div
      style={{
        fontFamily: fuenteTitulo,
        fontWeight: 900,
        fontSize: tamano,
        lineHeight: 0.9,
        color: color.cespedClaro,
        fontVariantNumeric: "tabular-nums",
        opacity: interpolate(frame, [retraso, retraso + 6], [0, 1], clamp),
      }}
    >
      {plata(valor * p)}
    </div>
  );
};

export const Bajada: React.FC<{
  texto: string;
  tamano: number;
  retraso?: number;
}> = ({ texto, tamano, retraso = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [retraso, retraso + 0.6 * fps], [0, 1], {
    ...clamp,
    easing: suave,
  });
  return (
    <div
      style={{
        fontFamily: fuenteTexto,
        fontWeight: 500,
        fontSize: tamano,
        color: color.gris,
        opacity: p,
        translate: `0px ${interpolate(p, [0, 1], [14, 0])}px`,
      }}
    >
      {texto}
    </div>
  );
};

export type Clip = { desde: number; hasta: number; velocidad: number };

/** El celular con un tramo de la grabación (acelerado o frenado) y las máscaras. */
export const Celular: React.FC<{
  archivo: string;
  clip: Clip;
  ancho: number;
  alto: number;
  mascaras: Mascara[];
}> = ({ archivo, clip, ancho, alto, mascaras }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = clip.desde + (frame / fps) * clip.velocidad;
  const borde = Math.round(ancho * 0.022);
  return (
    <div
      style={{
        width: ancho,
        height: alto,
        padding: borde,
        borderRadius: ancho * 0.13,
        backgroundColor: "#050806",
        boxShadow: `0 0 0 2px ${color.linea}, 0 60px 140px -40px rgba(0, 0, 0, 0.85)`,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: ancho * 0.11,
          overflow: "hidden",
        }}
      >
        <Video
          src={staticFile(archivo)}
          trimBefore={Math.round(clip.desde * fps)}
          playbackRate={clip.velocidad}
          muted
          objectFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
        {mascaras
          .filter((m) => t >= m.desde && t < m.hasta)
          .map((m) => (
            <div
              key={m.texto}
              style={{
                position: "absolute",
                left: `${m.x * 100}%`,
                top: `${m.y * 100}%`,
                width: `${m.ancho * 100}%`,
                height: `${m.alto * 100}%`,
                backgroundColor: m.fondo,
                color: m.colorTexto,
                fontFamily: fuenteTexto,
                fontSize: alto * m.alto * 0.36,
                display: "flex",
                alignItems: "center",
                paddingLeft: "3%",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {m.texto}
            </div>
          ))}
      </div>
    </div>
  );
};

/** Recorta una zona de la pantalla (congelada en el segundo t) y la hace flotar fuera del
 * celular, más grande. Entra con spring y sale rápido. */
export const Flotante: React.FC<{
  archivo: string;
  zona: Zona & { t: number };
  /** Dónde está la pantalla del celular en el cuadro. */
  pantalla: { left: number; top: number; ancho: number; alto: number };
  centro: { x: number; y: number };
  maximo: { ancho: number; alto: number };
  duracion: number;
}> = ({ archivo, zona, pantalla, centro, maximo, duracion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const anchoZona = zona.ancho * pantalla.ancho;
  const altoZona = zona.alto * pantalla.alto;
  const escala = Math.max(
    1.3,
    Math.min(maximo.ancho / anchoZona, maximo.alto / altoZona, 2.6),
  );
  const p = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 170, mass: 0.9 }, // rebote leve (~0,15)
  });
  const fuera = interpolate(frame, [duracion - 0.18 * fps, duracion], [1, 0], {
    ...clamp,
    easing: rapida,
  });
  const desde = {
    x: pantalla.left + (zona.x + zona.ancho / 2) * pantalla.ancho,
    y: pantalla.top + (zona.y + zona.alto / 2) * pantalla.alto,
  };
  const s =
    interpolate(p, [0, 1], [1, escala]) * interpolate(fuera, [0, 1], [0.97, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: interpolate(p, [0, 1], [desde.x, centro.x]) - anchoZona / 2,
        top: interpolate(p, [0, 1], [desde.y, centro.y]) - altoZona / 2,
        width: anchoZona,
        height: altoZona,
        scale: String(s),
        opacity: fuera,
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: `0 ${interpolate(p, [0, 1], [0, 30])}px ${interpolate(p, [0, 1], [0, 70])}px rgba(0, 0, 0, 0.55)`,
        outline: `1px solid rgba(246, 241, 230, ${0.14 * p})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: -zona.x * pantalla.ancho,
          top: -zona.y * pantalla.alto,
          width: pantalla.ancho,
          height: pantalla.alto,
        }}
      >
        <Freeze frame={0}>
          <Video
            src={staticFile(archivo)}
            trimBefore={Math.round(zona.t * fps)}
            muted
            objectFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        </Freeze>
      </div>
    </div>
  );
};

/** Logo que entra girando con un spring. */
export const Logo: React.FC<{
  tamano: number;
  visibleDesdeElInicio?: boolean;
}> = ({ tamano, visibleDesdeElInicio }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16, stiffness: 130 } });
  // En la intro se ve desde el primer cuadro (es la portada del reel): solo se acomoda.
  const desde = visibleDesdeElInicio ? 0.94 : 0.8;
  return (
    <Img
      src={staticFile("logo-haycanchas.png")}
      style={{
        width: tamano,
        height: tamano,
        scale: String(interpolate(p, [0, 1], [desde, 1])),
        rotate: `${interpolate(p, [0, 1], [visibleDesdeElInicio ? -8 : -30, 0])}deg`,
        opacity: visibleDesdeElInicio
          ? 1
          : interpolate(p, [0, 0.4], [0, 1], clamp),
      }}
    />
  );
};

export const Intro: React.FC<{ titulo: string; vertical: boolean }> = ({
  titulo,
  vertical,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = interpolate(frame, [0, 1.2 * fps], [0, 1], {
    ...clamp,
    easing: suave,
  });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: vertical ? 56 : 44,
      }}
    >
      <Logo tamano={vertical ? 230 : 190} visibleDesdeElInicio />
      <div
        style={{
          fontFamily: fuenteTitulo,
          fontWeight: 900,
          fontSize: vertical ? 150 : 150,
          lineHeight: 0.9,
          textTransform: "uppercase",
          textAlign: "center",
          color: color.cal,
          maxWidth: vertical ? 900 : 1500,
          scale: String(interpolate(p, [0, 1], [0.98, 1])),
          translate: `0px ${interpolate(p, [0, 1], [10, 0])}px`,
        }}
      >
        {titulo}
      </div>
    </AbsoluteFill>
  );
};

/** Tamaño para que la palabra más larga entre en el ancho (Big Shoulders: ~0,5 em por letra). */
function tamanoQueEntra(texto: string, ancho: number, maximo: number) {
  const larga = Math.max(...texto.split(" ").map((p) => p.length));
  return Math.min(maximo, Math.floor(ancho / (larga * 0.52)));
}

export const Cierre: React.FC<{ llamado: string; vertical: boolean }> = ({
  llamado,
  vertical,
}) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      gap: vertical ? 54 : 40,
      padding: vertical ? 90 : 160,
      textAlign: "center",
    }}
  >
    <Logo tamano={vertical ? 210 : 170} />
    <Titulo
      texto={llamado}
      tamano={tamanoQueEntra(llamado, vertical ? 900 : 1600, 140)}
      align="center"
      retraso={6}
    />
    {!llamado.includes(URL_REAL) && (
      <Bajada texto={URL_REAL} tamano={vertical ? 56 : 48} retraso={14} />
    )}
  </AbsoluteFill>
);
