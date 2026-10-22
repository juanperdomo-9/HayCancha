// Contenido y armado de las piezas de Instagram. Cada composición tiene un cuadro por
// pieza: el cuadro N es la slide (o historia) N. Se exportan con scripts/instagram.mjs.
import type React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  CalendarCheck,
  MapPin,
  Megaphone,
  MessageCircleQuestion,
  Store,
  Volleyball,
} from "lucide-react";
import { fuenteTitulo } from "../marca";
import {
  Bajada,
  Burbuja,
  C,
  Celular,
  CanchaDeFondo,
  CanchaDeporte,
  Firma,
  Fondo,
  Titulo,
} from "./sistema";

type Deporte = "futbol" | "padel" | "tenis" | "basquet" | "voley";
export type Pieza =
  | { tipo: "portada"; titulo: string; bajada?: string; burbuja?: [string, string] }
  | { tipo: "texto"; titulo: string; bajada: string }
  | { tipo: "celular"; titulo: string; bajada: string; captura: string }
  | { tipo: "paso"; numero: number; titulo: string; bajada: string; captura: string }
  | { tipo: "cancha"; titulo: string; bajada: string; canchas: Deporte[] }
  | { tipo: "cierre"; titulo: string; bajada: string };

export const CARRUSELES: Record<string, Pieza[]> = {
  lanzamiento: [
    {
      tipo: "portada",
      titulo: "Se terminó el “¿hay cancha?” por WhatsApp",
      burbuja: ["¿Hay cancha mañana a las 21?", "Visto"],
    },
    { tipo: "texto", titulo: "Mandaste el mensaje. Te clavaron el visto.", bajada: "Y mientras esperabas la respuesta, el turno se lo llevó otro." },
    { tipo: "celular", titulo: "Ahora ves los turnos libres", bajada: "Cada complejo tiene su página: deportes, días y cuántas canchas quedan.", captura: "oscuro-2-horarios" },
    { tipo: "celular", titulo: "Elegís y pagás la seña", bajada: "Con Mercado Pago. El resto, en la cancha.", captura: "oscuro-3-turno" },
    { tipo: "celular", titulo: "El turno es tuyo", bajada: "Sin llamar a nadie. Te queda el link para cancelar o cambiar el horario.", captura: "oscuro-5-confirmado" },
    { tipo: "cierre", titulo: "¿Hay cancha? Fijate acá", bajada: "Reservá en un par de toques, desde el celu." },
  ],
  reservar: [
    { tipo: "portada", titulo: "Reservá tu cancha en 4 pasos", bajada: "Desde el celu y sin llamar a nadie." },
    { tipo: "paso", numero: 1, titulo: "Buscá el complejo", bajada: "Por nombre, barrio, deporte, día u hora.", captura: "oscuro-1-inicio" },
    { tipo: "paso", numero: 2, titulo: "Elegí día y horario", bajada: "Ves cuántas canchas quedan libres en cada turno.", captura: "oscuro-2-horarios" },
    { tipo: "paso", numero: 3, titulo: "Completá tus datos", bajada: "Nombre y teléfono. No hace falta crear cuenta.", captura: "oscuro-4-datos" },
    { tipo: "paso", numero: 4, titulo: "Pagá la seña y listo", bajada: "Guardá el link de tu reserva: con él cancelás o cambiás el horario.", captura: "oscuro-5-confirmado" },
    { tipo: "cierre", titulo: "El próximo partido arranca acá", bajada: "Buscá tu complejo y reservá." },
  ],
  duenos: [
    { tipo: "portada", titulo: "Tu complejo, sin atender el teléfono", bajada: "Los jugadores reservan y pagan la seña solos." },
    { tipo: "celular", titulo: "Tu complejo con su página", bajada: "Tus canchas, tus horarios, tus precios y tus colores.", captura: "oscuro-2-horarios" },
    { tipo: "celular", titulo: "La agenda se llena sola", bajada: "Cada reserva aparece en tu panel, en el celu.", captura: "oscuro-7-agenda-grilla" },
    { tipo: "texto", titulo: "La seña cae en tu Mercado Pago", bajada: "Cobrás directo en tu cuenta. Si el jugador no paga a tiempo, el turno se libera solo." },
    { tipo: "texto", titulo: "¿Lluvia o torneo? Bloqueá turnos", bajada: "Y cargá a mano las reservas por teléfono: nunca se pisan con las de la web." },
    { tipo: "cierre", titulo: "Sumá tu complejo", bajada: "Tocá «Tengo un complejo» en la web y te contactamos." },
  ],
  deportes: [
    { tipo: "portada", titulo: "No es solo fútbol", bajada: "Fútbol 5, 7 y 11, pádel, tenis, básquet y vóley." },
    { tipo: "cancha", titulo: "Fútbol 5, 7 y 11", bajada: "Y si tu complejo une dos de 5 para armar una de 7, también.", canchas: ["futbol"] },
    { tipo: "cancha", titulo: "Pádel", bajada: "Cada deporte con su duración de turno y su precio.", canchas: ["padel"] },
    { tipo: "cancha", titulo: "Tenis", bajada: "Con los datos de cada cancha: polvo, cemento, techada.", canchas: ["tenis"] },
    { tipo: "cancha", titulo: "Básquet y vóley", bajada: "Si se alquila por turno, se reserva en HayCanchas.", canchas: ["basquet", "voley"] },
    { tipo: "cierre", titulo: "Elegí tu cancha", bajada: "Techada, descubierta o sintético: cada una con sus datos." },
  ],
};

export const DESTACADAS: { id: string; nombre: string; Icono: typeof Store; historias: Pieza[] }[] = [
  {
    id: "como-reservar",
    nombre: "Cómo reservar",
    Icono: CalendarCheck,
    historias: CARRUSELES.reservar.slice(1, 5),
  },
  {
    id: "duenos",
    nombre: "Dueños",
    Icono: Store,
    historias: [CARRUSELES.duenos[1], CARRUSELES.duenos[2], CARRUSELES.duenos[3], CARRUSELES.duenos[5]],
  },
  {
    id: "deportes",
    nombre: "Deportes",
    Icono: Volleyball,
    historias: [CARRUSELES.deportes[1], CARRUSELES.deportes[2], CARRUSELES.deportes[4]],
  },
  {
    id: "preguntas",
    nombre: "Preguntas",
    Icono: MessageCircleQuestion,
    historias: [
      { tipo: "texto", titulo: "¿Tengo que crear una cuenta?", bajada: "No. Reservás con tu nombre y tu teléfono." },
      { tipo: "texto", titulo: "¿Cuánto pago al reservar?", bajada: "Solo la seña, con Mercado Pago. El resto lo pagás en la cancha." },
      { tipo: "texto", titulo: "¿Y si no puedo ir?", bajada: "Cancelás desde el link de tu reserva. Si estás a tiempo según el complejo, te devuelven la seña." },
      { tipo: "texto", titulo: "¿Puedo cambiar el horario?", bajada: "Sí, una vez, desde el link de tu reserva y con la misma anticipación." },
      { tipo: "texto", titulo: "¿Quién me confirma el turno?", bajada: "Nadie: cuando se acredita la seña, el turno es tuyo." },
    ],
  },
  {
    id: "complejos",
    nombre: "Complejos",
    Icono: MapPin,
    historias: [
      { tipo: "celular", titulo: "Buscá por día y hora", bajada: "Y mirá qué complejos tienen lugar.", captura: "oscuro-1-inicio" },
      { tipo: "celular", titulo: "Cada uno con su página", bajada: "Sus canchas, horarios, precios y servicios.", captura: "oscuro-2-horarios" },
      { tipo: "cierre", titulo: "¿Tu complejo no está?", bajada: "Pasale haycanchas.com.ar al dueño." },
    ],
  },
  {
    id: "novedades",
    nombre: "Novedades",
    Icono: Megaphone,
    historias: [
      { tipo: "celular", titulo: "Ahora elegís tu cancha", bajada: "O dejás que te demos la primera libre.", captura: "oscuro-3-turno" },
      { tipo: "celular", titulo: "Sumá la parrilla o la pelota", bajada: "Se paga en la cancha, con el resto del turno.", captura: "oscuro-4-datos" },
      { tipo: "texto", titulo: "Las reglas del predio, antes de pagar", bajada: "Así no hay sorpresas: botines, bebidas, cómo se paga el saldo." },
    ],
  },
];

const M = 84; // margen

/** Una pieza (slide de 1080x1350 o historia de 1080x1920). */
const Contenido: React.FC<{ p: Pieza; historia: boolean }> = ({ p, historia }) => {
  const alto = historia ? 1920 : 1350;
  const arriba = historia ? 300 : 110; // en historias, fuera de los 250px de arriba
  const firmaY = historia ? 1580 : 1236;
  const firma = <Firma x={M} y={firmaY} />;

  if (p.tipo === "portada") {
    return (
      <>
        <div style={{ position: "absolute", left: M, top: arriba, right: M }}>
          <Titulo tamano={p.burbuja ? (historia ? 170 : 156) : historia ? 200 : 186}>{p.titulo}</Titulo>
          {p.bajada && <Bajada tamano={44} style={{ marginTop: 44, maxWidth: 760 }}>{p.bajada}</Bajada>}
        </div>
        {p.burbuja && <Burbuja texto={p.burbuja[0]} nota={p.burbuja[1]} x={M + 170} y={historia ? 1200 : 930} />}
        {firma}
      </>
    );
  }
  if (p.tipo === "texto") {
    return (
      <>
        <div style={{ position: "absolute", left: M, right: M, top: historia ? 520 : 300 }}>
          <Titulo tamano={historia ? 150 : 150}>{p.titulo}</Titulo>
          <Bajada tamano={historia ? 48 : 44} style={{ marginTop: 48, maxWidth: 820 }}>{p.bajada}</Bajada>
        </div>
        {firma}
      </>
    );
  }
  if (p.tipo === "celular") {
    const ancho = historia ? 560 : 470;
    return (
      <>
        <div style={{ position: "absolute", left: M, right: M, top: arriba }}>
          <Titulo tamano={historia ? 132 : 118}>{p.titulo}</Titulo>
          <Bajada tamano={historia ? 44 : 38} style={{ marginTop: 30, maxWidth: historia ? 880 : 800 }}>{p.bajada}</Bajada>
        </div>
        <Celular captura={p.captura} ancho={ancho} x={historia ? (1080 - ancho) / 2 : 1080 - M - ancho + 40} y={historia ? 780 : 560} />
      </>
    );
  }
  if (p.tipo === "paso") {
    const ancho = historia ? 520 : 400;
    return (
      <>
        <div
          style={{
            position: "absolute",
            left: M - 10,
            top: historia ? arriba - 40 : arriba - 50,
            fontFamily: fuenteTitulo,
            fontWeight: 900,
            fontSize: historia ? 300 : 330,
            lineHeight: 1,
            color: C.acento,
          }}
        >
          {p.numero}
        </div>
        <div style={{ position: "absolute", left: M, width: historia ? 912 : 470, top: historia ? arriba + 290 : 470 }}>
          <Titulo tamano={historia ? 132 : 112}>{p.titulo}</Titulo>
          <Bajada tamano={historia ? 44 : 38} style={{ marginTop: 30 }}>{p.bajada}</Bajada>
        </div>
        <Celular
          captura={p.captura}
          ancho={ancho}
          x={historia ? (1080 - ancho) / 2 : 1080 - M - ancho + 20}
          y={historia ? 1010 : 160}
        />
        {!historia && firma}
      </>
    );
  }
  if (p.tipo === "cancha") {
    const altoCancha = historia ? 860 : 740;
    return (
      <>
        <div style={{ position: "absolute", left: M, right: M, top: arriba }}>
          <Titulo tamano={historia ? 150 : 140}>{p.titulo}</Titulo>
          <Bajada tamano={historia ? 44 : 38} style={{ marginTop: 28, maxWidth: 860 }}>{p.bajada}</Bajada>
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: historia ? 760 : 470,
            display: "flex",
            justifyContent: "center",
            gap: 70,
          }}
        >
          {p.canchas.map((d) => (
            <CanchaDeporte key={d} deporte={d} alto={p.canchas.length > 1 ? altoCancha * 0.9 : altoCancha} />
          ))}
        </div>
        {firma}
      </>
    );
  }
  return (
    <>
      <div style={{ position: "absolute", left: M, right: M, top: historia ? 480 : 250 }}>
        <Titulo tamano={p.titulo.length > 22 ? 160 : historia ? 200 : 210}>{p.titulo}</Titulo>
        <Bajada tamano={historia ? 48 : 44} style={{ marginTop: 48, maxWidth: 800 }}>{p.bajada}</Bajada>
      </div>
      <Firma x={M} y={alto - (historia ? 560 : 300)} tamano={historia ? 54 : 50} />
    </>
  );
};

/** Un carrusel: la cancha de fondo corre por todas las slides; cada cuadro es una slide. */
export const Carrusel: React.FC<{ id: keyof typeof CARRUSELES }> = ({ id }) => {
  const slide = useCurrentFrame();
  const piezas = CARRUSELES[id];
  const p = piezas[slide];
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fondo campo={p.tipo === "cierre"} />
      <div style={{ position: "absolute", top: 0, left: -slide * 1080, width: piezas.length * 1080, height: 1350 }}>
        <CanchaDeFondo ancho={piezas.length * 1080} alto={1350} />
      </div>
      <Contenido p={p} historia={false} />
    </AbsoluteFill>
  );
};

/** Las historias de una destacada (cuadro N = historia N). */
export const Historias: React.FC<{ id: string }> = ({ id }) => {
  const n = useCurrentFrame();
  const p = DESTACADAS.find((d) => d.id === id)!.historias[n];
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fondo campo={p.tipo === "cierre"} />
      <CanchaDeFondo ancho={1080} alto={1920} vertical />
      <Contenido p={p} historia />
    </AbsoluteFill>
  );
};

/** Portadas de las destacadas (cuadro N = destacada N): el ícono en un círculo de 600px,
 * que es lo que Instagram recorta. Mismo fondo, círculo, color y grosor en todas. */
export const PortadasDestacadas: React.FC = () => {
  const { Icono } = DESTACADAS[useCurrentFrame()];
  return (
    <AbsoluteFill style={{ backgroundColor: C.noche, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: 600,
          height: 600,
          borderRadius: "50%",
          backgroundColor: C.campo,
          display: "grid",
          placeItems: "center",
        }}
      >
        <Icono size={300} color={C.cal} strokeWidth={2.1} />
      </div>
    </AbsoluteFill>
  );
};
