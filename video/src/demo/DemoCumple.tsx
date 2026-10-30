// Reel de los cumpleaños (vertical, ~31 s): el jugador elige el cumpleaños del complejo,
// el día y la hora, ve el precio cerrado (sin seña), lo reserva y le avisa al complejo por
// WhatsApp con el mensaje armado. Capturas de frontend/scripts/capturas-cumple.mjs, con el
// mismo sistema que la demo del jugador (Montaje, Celular, Recorte, toques).
import type React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { MessageCircle } from "lucide-react";
import { color, fuenteTexto, fuenteTitulo, suave } from "../marca";
import {
  Arriba,
  type Caja,
  Celular,
  clamp,
  type Escena,
  Logo,
  Montaje,
  type Musica,
  Pantalla,
  plata,
  Recorte,
  Titulo,
} from "./DemoJugador";

export const COMPASES_CUMPLE = 16;
// Música: "Party Pop" de Kulakovka (Pixabay, uso libre, sin Content ID), 128 BPM. Arranca
// en el compás donde entra el ritmo lleno (segundo 15,19).
const MUSICA: Musica = { src: "musica-cumple.mp3", inicio: 15.186, compas: (60 / 128) * 4 };
export const SEGUNDOS_CUMPLE = COMPASES_CUMPLE * MUSICA.compas;
const f = (compases: number, fps: number) => Math.round(compases * MUSICA.compas * fps);

// Dónde está cada cosa en la pantalla de 390x844 (de estados-cumple.json).
const CAJA = {
  chip: { x: 181, y: 366, ancho: 196, alto: 65 },
  info: { x: 16, y: 449, ancho: 358, alto: 204 },
  turno: { x: 139, y: 414, ancho: 113, alto: 89 },
  precio: { x: 16, y: 275, ancho: 358, alto: 88 },
  reservar: { x: 16, y: 730, ancho: 358, alto: 54 },
  aviso: { x: 40, y: 337, ancho: 310, alto: 242 },
  whatsapp: { x: 56, y: 520, ancho: 278, alto: 45 },
} satisfies Record<string, Caja>;

// El mensaje que arma la página (estados-cumple.json), con el dominio real.
const MENSAJE = [
  "¡Hola! Reservé el Cumple en fútbol 5 en Los Ceibos Fútbol por HayCanchas.",
  "Sábado 31 de octubre, de 16:00 a 18:00 (Cancha 4). Precio: $ 140.000.",
  "Cumpleaños de: Benja, 7 años, 16 chicos.",
  "Mi reserva: haycanchas.com.ar/los-ceibos/r/sab31-16hs",
  "Quiero arreglar los detalles del festejo.",
].join("\n");
const RESPUESTA = "¡Hola Carolina! Genial, los esperamos el sábado. ¿Traen torta? Te paso las opciones del quincho.";

export const DemoCumple: React.FC = () => {
  const { fps } = useVideoConfig();
  const c = (compases: number) => f(compases, fps);
  const escenas: Escena[] = [
    {
      // Portada: visible desde el primer cuadro (WhatsApp la usa de miniatura).
      compases: 1,
      tono: "noche",
      contenido: (
        <AbsoluteFill style={{ alignItems: "flex-start", justifyContent: "center", padding: 84, gap: 60 }}>
          <Logo tamano={200} />
          <Titulo texto="¿Cumple en la cancha?" tamano={200} ya />
        </AbsoluteFill>
      ),
    },
    {
      compases: 2,
      tono: "estadio",
      toques: [c(0.6)],
      contenido: (
        <>
          <Arriba titulo="Elegí el cumpleaños" bajada="Lo ofrece el complejo, al lado de los deportes." />
          <Celular x={210} y={620} ancho={660}>
            {(escala) => (
              <Pantalla
                escala={escala}
                capas={[{ src: "cumple-1-complejo" }, { src: "cumple-2-elegido", aparece: c(0.6) + 3 }]}
                toques={[{ caja: CAJA.chip, en: c(0.6) }]}
              />
            )}
          </Celular>
          <Recorte src="cumple-2-elegido" caja={CAJA.info} ancho={940} x={70} y={1240} desde={c(1.1)} />
        </>
      ),
    },
    {
      compases: 2.5,
      tono: "noche",
      toques: [c(1.5)],
      contenido: (
        <>
          <Arriba titulo="Elegí día y hora" bajada="Solo ves los horarios en que entra el festejo." />
          <Celular x={190} y={640} ancho={700}>
            {(escala) => (
              <Pantalla
                escala={escala}
                capas={[
                  { src: "cumple-3-horarios-completa", scroll: [265, 842], mover: [c(0.3), c(1.3)] },
                  { src: "cumple-4-elegido", aparece: c(1.5) + 3 },
                ]}
                toques={[{ caja: CAJA.turno, en: c(1.5) }]}
              />
            )}
          </Celular>
        </>
      ),
    },
    { compases: 2, tono: "verde", contenido: <PasoPrecio /> },
    {
      compases: 2,
      tono: "estadio",
      toques: [c(1.4)],
      contenido: (
        <>
          <Arriba titulo="Tus datos y quién cumple" bajada="Sin crear cuenta." />
          <Recorte
            src="cumple-6-datos"
            caja={{ x: 0, y: 300, ancho: 390, alto: 500 }}
            ancho={860}
            x={110}
            y={720}
            toques={[{ caja: CAJA.reservar, en: c(1.4) }]}
          />
        </>
      ),
    },
    {
      compases: 2.5,
      tono: "cesped",
      toques: [c(1.8)],
      contenido: (
        <>
          <Arriba titulo="¡Reservado!" bajada="Al instante. Ahora avisale al complejo." />
          <Celular x={330} y={700} ancho={560} rotar={4}>
            {(escala) => <Pantalla escala={escala} capas={[{ src: "cumple-7-reservado" }]} />}
          </Celular>
          <Recorte
            src="cumple-8-aviso"
            caja={CAJA.aviso}
            ancho={820}
            x={84}
            y={1080}
            desde={c(0.7)}
            toques={[{ caja: CAJA.whatsapp, en: c(1.8) }]}
          />
        </>
      ),
    },
    {
      compases: 2.5,
      tono: "noche",
      contenido: (
        <>
          <Arriba titulo="Los detalles, por WhatsApp" bajada="El mensaje ya va armado." />
          <Celular x={190} y={740} ancho={700}>
            {(escala) => <Chat escala={escala} />}
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
          <Titulo texto="Festejá en la cancha" tamano={190} />
          <div style={{ fontFamily: fuenteTexto, fontWeight: 600, fontSize: 68, color: color.cal }}>haycanchas.com.ar</div>
        </AbsoluteFill>
      ),
    },
  ];
  return <Montaje escenas={escenas} musica={MUSICA} />;
};

/** Precio cerrado: el número que cuenta, "sin seña" y el desglose saliendo del celular. */
const PasoPrecio: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cuenta = interpolate(frame, [8, 8 + fps], [20000, 140000], { ...clamp, easing: suave });
  return (
    <>
      <div style={{ position: "absolute", left: 84, right: 84, top: 170 }}>
        <Titulo texto="Precio cerrado" tamano={150} />
        <div
          style={{
            fontFamily: fuenteTitulo,
            fontWeight: 900,
            fontSize: 180,
            lineHeight: 1,
            color: color.cespedClaro,
            fontVariantNumeric: "tabular-nums",
            marginTop: 16,
            opacity: interpolate(frame, [8, 14], [0, 1], clamp),
          }}
        >
          {plata(cuenta)}
        </div>
        <div
          style={{
            fontFamily: fuenteTexto,
            fontWeight: 600,
            fontSize: 52,
            color: color.cal,
            marginTop: 12,
            opacity: interpolate(frame, [fps, fps + 8], [0, 1], clamp),
          }}
        >
          Sin seña: se paga en el complejo.
        </div>
      </div>
      <Celular x={300} y={880} ancho={600}>
        {(escala) => <Pantalla escala={escala} capas={[{ src: "cumple-5-precio" }]} />}
      </Celular>
      <Recorte src="cumple-5-precio" caja={CAJA.precio} ancho={900} x={90} y={1240} desde={Math.round(1.1 * fps)} />
    </>
  );
};

/** Un chat con el complejo: el mensaje armado se escribe solo y el complejo responde. */
const Chat: React.FC<{ escala: number }> = ({ escala }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const px = (n: number) => n * escala;
  const escrito = Math.round(interpolate(frame, [f(0.2, fps), f(1.1, fps)], [0, MENSAJE.length], clamp));
  const respuesta = spring({ frame: frame - f(1.6, fps), fps, config: { damping: 18, stiffness: 160 } });
  const burbuja: React.CSSProperties = {
    maxWidth: px(300),
    padding: `${px(8)}px ${px(11)}px`,
    borderRadius: px(12),
    fontFamily: fuenteTexto,
    fontSize: px(14.5),
    lineHeight: 1.4,
    whiteSpace: "pre-line",
    color: "#111b21",
    boxShadow: `0 ${px(1)}px ${px(1)}px rgba(0,0,0,.12)`,
  };
  return (
    <div style={{ width: px(390), height: px(844), backgroundColor: "#efe7dc", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: px(10),
          padding: `${px(46)}px ${px(14)}px ${px(12)}px`,
          backgroundColor: "#ffffff",
          borderBottom: `${px(1)}px solid #e2ddd3`,
        }}
      >
        <div
          style={{
            width: px(38),
            height: px(38),
            borderRadius: "50%",
            backgroundColor: "#0F5FA8",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontFamily: fuenteTexto,
            fontWeight: 600,
            fontSize: px(14),
          }}
        >
          LC
        </div>
        <div style={{ fontFamily: fuenteTexto }}>
          <div style={{ fontWeight: 600, fontSize: px(16), color: "#111b21" }}>Los Ceibos Fútbol</div>
          <div style={{ fontSize: px(12.5), color: "#667781" }}>en línea</div>
        </div>
        <MessageCircle size={px(22)} color="#1e7a3e" style={{ marginLeft: "auto" }} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: px(10), padding: px(14) }}>
        {escrito > 0 && (
          <div style={{ ...burbuja, alignSelf: "flex-end", backgroundColor: "#d9fdd3" }}>{MENSAJE.slice(0, escrito)}</div>
        )}
        <div
          style={{
            ...burbuja,
            alignSelf: "flex-start",
            backgroundColor: "#ffffff",
            opacity: interpolate(respuesta, [0, 0.4], [0, 1], clamp),
            translate: `0px ${interpolate(respuesta, [0, 1], [px(14), 0])}px`,
          }}
        >
          {RESPUESTA}
        </div>
      </div>
    </div>
  );
};
