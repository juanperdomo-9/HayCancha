// Demo del jugador, versión 2 (vertical, ~30 s): en vez de la grabación de la navegación,
// capturas nítidas de cada estado (frontend/scripts/capturas-demo.mjs) animadas acá:
// scroll suave, toques con pulso, crossfades entre estados, recortes agrandados y tarjetas
// que salen del celular. Escenas de compases de la música (124 BPM), cortes en el beat.
import type React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio } from "@remotion/media";
import { color, COMPAS, fuenteTexto, fuenteTitulo, INICIO_MUSICA, suave } from "../marca";

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ANCHO_APP = 390; // px de la pantalla capturada (a 3x)
const ALTO_APP = 844;
export const SONIDO = {
  corte: "https://remotion.media/whoosh.wav",
  toque: "https://remotion.media/mouse-click.wav",
};

export type Caja = { x: number; y: number; ancho: number; alto: number };
// Dónde está cada cosa en la pantalla de 390x844 (de estados.json, ya sin el scroll).
const CAJA = {
  deporte: { x: 16, y: 511, ancho: 169, alto: 65 },
  dia: { x: 80, y: 596, ancho: 60, alto: 65 },
  turno: { x: 16, y: 413, ancho: 113, alto: 89 },
  continuar: { x: 257, y: 784, ancho: 117, alto: 48 },
  precios: { x: 4, y: 264, ancho: 382, alto: 142 },
  pagar: { x: 16, y: 750, ancho: 358, alto: 54 },
  listo: { x: 16, y: 40, ancho: 358, alto: 360 },
} satisfies Record<string, Caja>;

export const f = (compases: number, fps: number) => Math.round(compases * COMPAS * fps);

// ---------- Fondo: degradés y luces con los colores de la marca, distintos por escena ----------

type Luz = { fondo: [string, string]; luz: string; x: number; y: number };
export const LUCES: Record<string, Luz> = {
  noche: { fondo: ["#0e1a13", "#14231a"], luz: "rgba(87, 201, 134, 0.28)", x: 80, y: 10 },
  cesped: { fondo: ["#155a2e", "#1e7a3e"], luz: "rgba(246, 241, 230, 0.20)", x: 20, y: 0 },
  estadio: { fondo: ["#0b120e", "#172a1f"], luz: "rgba(246, 241, 230, 0.22)", x: 50, y: -10 },
  verde: { fondo: ["#14231a", "#1e7a3e"], luz: "rgba(87, 201, 134, 0.35)", x: 90, y: 100 },
};

export const Fondo: React.FC<{ tono: keyof typeof LUCES }> = ({ tono }) => {
  const l = LUCES[tono];
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `radial-gradient(ellipse 90% 60% at ${l.x}% ${l.y}%, ${l.luz}, transparent 70%), linear-gradient(170deg, ${l.fondo[0]}, ${l.fondo[1]})`,
      }}
    />
  );
};

// ---------- Texto: palabras que entran con fundido (nunca cortadas) ----------

export const Titulo: React.FC<{ texto: string; tamano: number; ya?: boolean; color?: string }> = ({
  texto,
  tamano,
  ya,
  color: tinta = color.cal,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: fuenteTitulo,
        fontWeight: 900,
        fontSize: tamano,
        lineHeight: 0.9,
        letterSpacing: "-0.01em",
        textTransform: "uppercase",
        color: tinta,
        textWrap: "balance",
      }}
    >
      {texto.split(" ").map((palabra, i) => {
        const p = ya ? 1 : interpolate(frame, [i * 2, i * 2 + 7], [0, 1], { ...clamp, easing: suave });
        return (
          <span
            key={`${palabra}-${i}`}
            style={{
              display: "inline-block",
              marginRight: "0.22em",
              opacity: p,
              translate: `0px ${interpolate(p, [0, 1], [22, 0])}px`,
            }}
          >
            {palabra}
          </span>
        );
      })}
    </div>
  );
};

export const Bajada: React.FC<{ texto: string; retraso?: number }> = ({ texto, retraso = 8 }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [retraso, retraso + 9], [0, 1], { ...clamp, easing: suave });
  return (
    <div
      style={{
        fontFamily: fuenteTexto,
        fontWeight: 500,
        fontSize: 46,
        lineHeight: 1.3,
        color: color.cal,
        marginTop: 30,
        maxWidth: 880,
        opacity: p,
        translate: `0px ${interpolate(p, [0, 1], [14, 0])}px`,
      }}
    >
      {texto}
    </div>
  );
};

export const Arriba: React.FC<{ titulo: string; bajada?: string; tamano?: number; ya?: boolean }> = ({
  titulo,
  bajada,
  tamano = 150,
  ya,
}) => (
  <div style={{ position: "absolute", left: 84, right: 84, top: 170 }}>
    <Titulo texto={titulo} tamano={tamano} ya={ya} />
    {bajada && <Bajada texto={bajada} />}
  </div>
);

export const plata = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

// ---------- Pantalla del celular: capas de capturas con scroll y crossfade ----------

type Capa = {
  src: string;
  /** Scroll (px de la app) al empezar y al terminar, para las capturas de página entera. */
  scroll?: [number, number];
  /** Cuadros de la escena en que se mueve y en que aparece (crossfade). */
  mover?: [number, number];
  aparece?: number;
};

export const Pantalla: React.FC<{ capas: Capa[]; escala: number; toques?: { caja: Caja; en: number }[] }> = ({
  capas,
  escala,
  toques = [],
}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "relative", width: ANCHO_APP * escala, height: ALTO_APP * escala, overflow: "hidden" }}>
      {capas.map((c) => {
        const scroll = c.scroll
          ? interpolate(frame, c.mover ?? [0, 1], c.scroll, {
              ...clamp,
              easing: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
            })
          : 0;
        const opacidad = c.aparece === undefined ? 1 : interpolate(frame, [c.aparece, c.aparece + 8], [0, 1], clamp);
        return (
          <Img
            key={c.src}
            src={staticFile(`demo/${c.src}.png`)}
            style={{
              position: "absolute",
              left: 0,
              top: -scroll * escala,
              width: "100%",
              opacity: opacidad,
            }}
          />
        );
      })}
      {toques.map((t) => (
        <Toque key={t.en} caja={t.caja} en={t.en} escala={escala} />
      ))}
      {/* Reflejo sutil en el vidrio. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "linear-gradient(118deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 26%, rgba(255,255,255,0) 40%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

/** Indicador de toque: un punto que se hunde y un anillo que se expande. */
const Toque: React.FC<{ caja: Caja; en: number; escala: number }> = ({ caja, en, escala }) => {
  const frame = useCurrentFrame();
  const t = frame - en;
  if (t < -6 || t > 22) return null;
  const aparece = interpolate(t, [-6, 0], [0, 1], clamp);
  const anillo = interpolate(t, [0, 18], [0, 1], { ...clamp, easing: suave });
  const cx = (caja.x + caja.ancho / 2) * escala;
  const cy = (caja.y + caja.alto / 2) * escala;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: cx - 70,
          top: cy - 70,
          width: 140,
          height: 140,
          borderRadius: "50%",
          border: `5px solid ${color.cespedClaro}`,
          opacity: (1 - anillo) * aparece,
          scale: String(interpolate(anillo, [0, 1], [0.4, 1.3])),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: cx - 32,
          top: cy - 32,
          width: 64,
          height: 64,
          borderRadius: "50%",
          backgroundColor: "rgba(30, 122, 62, 0.55)",
          border: "4px solid rgba(246, 241, 230, 0.9)",
          opacity: aparece * interpolate(t, [14, 22], [1, 0], clamp),
          scale: String(t < 0 ? 1 : interpolate(t, [0, 4, 9], [1, 0.82, 1], clamp)),
        }}
      />
    </>
  );
};

/** Celular con borde de luz, vidrio y sombra verde. Entra subiendo con un spring. */
export const Celular: React.FC<{
  x: number;
  y: number;
  ancho: number;
  rotar?: number;
  children: (escala: number) => React.ReactNode;
}> = ({ x, y, ancho, rotar = 0, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 24, stiffness: 140 } });
  const borde = Math.round(ancho * 0.026);
  const escala = (ancho - 2 * borde - 6) / ANCHO_APP;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: ancho,
        padding: 3,
        borderRadius: ancho * 0.15,
        // Borde con luz: más claro arriba a la izquierda, verde abajo.
        backgroundImage: "linear-gradient(145deg, rgba(246,241,230,0.85), rgba(246,241,230,0.10) 38%, rgba(87,201,134,0.55))",
        boxShadow: "0 90px 140px -50px rgba(30, 122, 62, 0.75), 0 40px 70px -40px rgba(0, 0, 0, 0.7)",
        translate: `0px ${interpolate(p, [0, 1], [120, 0])}px`,
        opacity: interpolate(p, [0, 0.4], [0, 1], clamp),
        rotate: `${rotar}deg`,
      }}
    >
      <div style={{ padding: borde, borderRadius: ancho * 0.145, backgroundColor: "#0a0f0c" }}>
        <div style={{ borderRadius: ancho * 0.115, overflow: "hidden" }}>{children(escala)}</div>
      </div>
    </div>
  );
};

/** Un pedazo de la pantalla agrandado, como tarjeta. Sale flotando con spring. */
export const Recorte: React.FC<{
  src: string;
  caja: Caja;
  ancho: number;
  x: number;
  y: number;
  desde?: number;
  toques?: { caja: Caja; en: number }[];
}> = ({ src, caja, ancho, x, y, desde = 0, toques = [] }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - desde, fps, config: { damping: 18, stiffness: 150, mass: 0.9 } });
  const escala = ancho / caja.ancho;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: ancho,
        height: caja.alto * escala,
        borderRadius: 34,
        overflow: "hidden",
        backgroundColor: "#ffffff",
        outline: "3px solid rgba(246, 241, 230, 0.6)",
        boxShadow: "0 70px 120px -40px rgba(30, 122, 62, 0.8), 0 30px 60px -30px rgba(0, 0, 0, 0.6)",
        opacity: interpolate(p, [0, 0.35], [0, 1], clamp),
        scale: String(interpolate(p, [0, 1], [0.86, 1])),
        translate: `0px ${interpolate(p, [0, 1], [60, 0])}px`,
      }}
    >
      <Img
        src={staticFile(`demo/${src}.png`)}
        style={{
          position: "absolute",
          width: ANCHO_APP * escala,
          left: -caja.x * escala,
          top: -caja.y * escala,
        }}
      />
      {toques.map((t) => (
        <Toque
          key={t.en}
          caja={{ ...t.caja, x: t.caja.x - caja.x, y: t.caja.y - caja.y }}
          en={t.en}
          escala={escala}
        />
      ))}
    </div>
  );
};

export const Logo: React.FC<{ tamano: number }> = ({ tamano }) => (
  <Img src={staticFile("logo-haycanchas.png")} style={{ width: tamano, height: tamano }} />
);

// ---------- Escenas ----------

export type Escena = { compases: number; tono: keyof typeof LUCES; toques?: number[]; contenido: React.ReactNode };

/** Arma el video: cada escena dura sus compases (cortes en el beat), con su fondo, un
 * whoosh en cada corte, un clic en cada toque y la música de fondo. */
export const Montaje: React.FC<{ escenas: Escena[] }> = ({ escenas }) => {
  const { fps, durationInFrames } = useVideoConfig();
  let compas = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#14231a" }}>
      {escenas.map((e, i) => {
        const desde = f(compas, fps);
        compas += e.compases;
        const largo = f(compas, fps) - desde;
        return (
          <Sequence key={i} from={desde} durationInFrames={largo} premountFor={fps}>
            <Fondo tono={e.tono} />
            {e.contenido}
            {i > 0 && <Audio src={SONIDO.corte} volume={0.15} />}
            {(e.toques ?? []).map((t) => (
              <Sequence key={t} from={t} durationInFrames={fps} premountFor={fps}>
                <Audio src={SONIDO.toque} volume={0.3} />
              </Sequence>
            ))}
          </Sequence>
        );
      })}
      <Audio
        src={staticFile("musica.mp3")}
        trimBefore={Math.round(INICIO_MUSICA * fps)}
        volume={(fr) => interpolate(fr, [0, 6, durationInFrames - fps, durationInFrames], [0, 0.6, 0.6, 0], clamp)}
      />
    </AbsoluteFill>
  );
};

export const COMPASES_DEMO = 15.5;

export const DemoJugador: React.FC = () => {
  const { fps } = useVideoConfig();
  const c = (compases: number) => f(compases, fps);

  const escenas: Escena[] = [
    {
      compases: 1,
      tono: "noche",
      contenido: (
        <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: 84, gap: 60 }}>
          <Logo tamano={210} />
          <Titulo texto="Cómo reservar tu cancha" tamano={210} ya />
        </AbsoluteFill>
      ),
    },
    {
      // Paso 1: título enorme detrás del celular; el celular arranca debajo de las palabras.
      compases: 2,
      tono: "estadio",
      contenido: (
        <>
          <div style={{ position: "absolute", left: 84, right: 84, top: 150 }}>
            <Titulo texto="Buscá tu cancha" tamano={215} />
          </div>
          <Celular x={210} y={700} ancho={660}>
            {(escala) => <Pantalla escala={escala} capas={[{ src: "1-inicio", scroll: [0, 640], mover: [c(0.5), c(1.8)] }]} />}
          </Celular>
        </>
      ),
    },
    {
      // Paso 2: la interfaz agrandada (deporte y día), sin el celular entero.
      compases: 2,
      tono: "cesped",
      toques: [c(0.6), c(1.3)],
      contenido: (
        <>
          <Arriba titulo="Elegí deporte y día" bajada="Cada complejo con sus canchas y sus horarios." />
          <Recorte
            src="2-complejo"
            caja={{ x: 0, y: 500, ancho: 390, alto: 172 }}
            ancho={1000}
            x={40}
            y={800}
            toques={[
              { caja: CAJA.deporte, en: c(0.6) },
              { caja: CAJA.dia, en: c(1.3) },
            ]}
          />
        </>
      ),
    },
    {
      // Paso 3: el celular con scroll hasta los horarios, toque y el horario marcado.
      compases: 2.5,
      tono: "noche",
      toques: [c(1.5)],
      contenido: (
        <>
          <Arriba titulo="Elegí el horario" bajada="Ves cuántas canchas quedan libres." />
          <Celular x={190} y={640} ancho={700}>
            {(escala) => (
              <Pantalla
                escala={escala}
                capas={[
                  { src: "3-horarios-completa", scroll: [120, 820], mover: [c(0.3), c(1.3)] },
                  { src: "4-elegido", aparece: c(1.5) + 3 },
                ]}
                toques={[{ caja: CAJA.turno, en: c(1.5) }]}
              />
            )}
          </Celular>
        </>
      ),
    },
    {
      // Paso 4: la seña con contador y el desglose que sale flotando del celular.
      compases: 2,
      tono: "verde",
      contenido: <PasoSena />,
    },
    {
      // Paso 5: el formulario agrandado y el toque en "Pagar seña".
      compases: 2,
      tono: "estadio",
      toques: [c(1.4)],
      contenido: (
        <>
          <Arriba titulo="Tus datos y a pagar" bajada="Nombre y teléfono. Sin crear cuenta." />
          <Recorte
            src="6-datos"
            caja={{ x: 0, y: 330, ancho: 390, alto: 480 }}
            ancho={860}
            x={110}
            y={720}
            toques={[{ caja: CAJA.pagar, en: c(1.4) }]}
          />
        </>
      ),
    },
    {
      // Paso 6: confirmación; la tarjeta del check sale del celular.
      compases: 2.5,
      tono: "cesped",
      contenido: (
        <>
          <Arriba titulo="El turno es tuyo" bajada="Sin llamar a nadie. Guardá el link de tu reserva." />
          <Celular x={330} y={760} ancho={560} rotar={4}>
            {(escala) => <Pantalla escala={escala} capas={[{ src: "7-confirmado" }]} />}
          </Celular>
          <Recorte src="7-confirmado" caja={CAJA.listo} ancho={500} x={84} y={1020} desde={c(0.8)} />
        </>
      ),
    },
    {
      compases: 1.5,
      tono: "verde",
      contenido: (
        <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: 84, gap: 56 }}>
          <Logo tamano={190} />
          <Titulo texto="Reservá tu cancha" tamano={190} />
          <div style={{ fontFamily: fuenteTexto, fontWeight: 600, fontSize: 68, color: color.cal }}>haycanchas.com.ar</div>
        </AbsoluteFill>
      ),
    },
  ];

  return <Montaje escenas={escenas} />;
};

/** Paso de la seña: contador de plata y el desglose agrandado saliendo del celular. */
const PasoSena: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cuenta = interpolate(frame, [8, 8 + fps], [3000, 21000], { ...clamp, easing: suave });
  return (
    <>
      <div style={{ position: "absolute", left: 84, right: 84, top: 170 }}>
        <Titulo texto="Pagás solo la seña" tamano={140} />
        <div
          style={{
            fontFamily: fuenteTitulo,
            fontWeight: 900,
            fontSize: 190,
            lineHeight: 1,
            color: color.cespedClaro,
            fontVariantNumeric: "tabular-nums",
            marginTop: 16,
            // Aparece cuando empieza a contar (nunca se queda en "$ 0").
            opacity: interpolate(frame, [8, 14], [0, 1], clamp),
          }}
        >
          {plata(cuenta)}
        </div>
      </div>
      <Celular x={300} y={820} ancho={600}>
        {(escala) => <Pantalla escala={escala} capas={[{ src: "5-turno" }]} />}
      </Celular>
      <Recorte src="5-turno" caja={CAJA.precios} ancho={880} x={100} y={1080} desde={Math.round(0.9 * fps)} />
    </>
  );
};
