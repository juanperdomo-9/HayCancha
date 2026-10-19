// La edición de cada video: escenas de largo medido en compases (los cortes caen en el
// beat), con su diseño, su título y el tramo de la grabación que muestran.
// Los tiempos de la grabación salen de public/steps-*.json (grabar-recorrido.mjs).
import type { Formato, Serie } from "./datos";

/** Zona de la pantalla del celular, de 0 a 1. */
export type Zona = { x: number; y: number; ancho: number; alto: number };

export type Diseno = "centrado" | "lateral" | "inclinado" | "texto";

export type Escena = {
  diseno: Diseno;
  /** 3 a 5 palabras. */
  titulo: string;
  /** Cuántos compases dura en cada formato (0: no va). */
  compases: Record<Formato, number>;
  /** Tramo de la grabación, en segundos. Se acelera o frena para entrar en la escena. */
  clip?: { desde: number; hasta: number };
  /** Para "lateral": de qué lado va el celular. */
  lado?: "izquierda" | "derecha";
  /** Un elemento que sale flotando del celular, en el segundo t de la grabación. */
  flotante?: Zona & { t: number };
  /** Para "texto": un número que se cuenta. */
  contador?: { valor: number; bajada: string };
};

/** Lo que se tapa en la grabación (por ejemplo, la URL de desarrollo). */
export type Mascara = Zona & {
  desde: number;
  hasta: number;
  texto: string;
  fondo: string;
  colorTexto: string;
};

export type Edicion = {
  escenas: Escena[];
  mascaras: Mascara[];
  titulo: string;
  llamado: string;
};

export const COMPASES_INTRO = 1; // ~2 s
export const COMPASES_CIERRE = 1.5; // ~3 s

export const EDICIONES: Record<Serie, Edicion> = {
  jugador: {
    titulo: "Cómo reservar tu cancha",
    llamado: "Reservá en haycanchas.com.ar",
    mascaras: [
      {
        x: 0.085,
        y: 0.671,
        ancho: 0.6,
        alto: 0.047,
        desde: 45.5,
        hasta: 49.4,
        texto: "haycanchas.com.ar/los-ceibos/r/vie16-20hs",
        fondo: "#191b20",
        colorTexto: "#c9ccd3",
      },
    ],
    escenas: [
      {
        diseno: "centrado",
        titulo: "Buscá tu cancha",
        compases: { horizontal: 3, vertical: 2 },
        clip: { desde: 5.2, hasta: 11.6 },
      },
      {
        diseno: "centrado",
        titulo: "Mirá cada complejo",
        compases: { horizontal: 3, vertical: 0 },
        clip: { desde: 12.2, hasta: 20.6 },
      },
      {
        diseno: "lateral",
        lado: "derecha",
        titulo: "Elegí día y hora",
        compases: { horizontal: 3, vertical: 2 },
        clip: { desde: 21.3, hasta: 28.4 },
      },
      {
        diseno: "lateral",
        lado: "izquierda",
        titulo: "Turnos libres de verdad",
        compases: { horizontal: 3, vertical: 2 },
        clip: { desde: 28.4, hasta: 33.2 },
        flotante: { x: 0.67, y: 0.485, ancho: 0.29, alto: 0.11, t: 32.6 },
      },
      {
        diseno: "texto",
        titulo: "Solo pagás la seña",
        compases: { horizontal: 2, vertical: 1.5 },
        contador: { valor: 21000, bajada: "y el resto, en la cancha" },
      },
      {
        diseno: "inclinado",
        titulo: "Elegí tu cancha",
        compases: { horizontal: 3, vertical: 2 },
        clip: { desde: 33.3, hasta: 37.3 },
        flotante: { x: 0.03, y: 0.355, ancho: 0.94, alto: 0.135, t: 33.8 },
      },
      {
        diseno: "inclinado",
        titulo: "Pagá la seña online",
        compases: { horizontal: 3, vertical: 2 },
        clip: { desde: 40.6, hasta: 46.4 },
      },
      {
        diseno: "centrado",
        titulo: "El turno es tuyo",
        compases: { horizontal: 3, vertical: 2 },
        clip: { desde: 46.4, hasta: 49.2 },
        flotante: { x: 0.05, y: 0.17, ancho: 0.9, alto: 0.36, t: 47.6 },
      },
    ],
  },
  dueno: {
    titulo: "Cómo gestionar tu complejo",
    llamado: "Sumá tu complejo a HayCanchas",
    mascaras: [],
    escenas: [
      {
        diseno: "centrado",
        titulo: "Tu complejo, en el celu",
        compases: { horizontal: 3, vertical: 1.5 },
        clip: { desde: 1.0, hasta: 7.4 },
      },
      {
        diseno: "centrado",
        titulo: "Tu agenda del día",
        compases: { horizontal: 3, vertical: 2 },
        clip: { desde: 7.4, hasta: 11.6 },
        flotante: { x: 0.03, y: 0.3, ancho: 0.94, alto: 0.24, t: 8.2 },
      },
      {
        diseno: "texto",
        titulo: "Señas cobradas solas",
        compases: { horizontal: 2, vertical: 1.5 },
        contador: { valor: 186000, bajada: "sin atender el teléfono" },
      },
      {
        diseno: "lateral",
        lado: "derecha",
        titulo: "Las reservas llegan solas",
        compases: { horizontal: 3, vertical: 1.5 },
        clip: { desde: 12.0, hasta: 16.7 },
      },
      {
        diseno: "lateral",
        lado: "izquierda",
        titulo: "Cada reserva, al detalle",
        compases: { horizontal: 3, vertical: 2 },
        clip: { desde: 16.7, hasta: 21.6 },
        flotante: { x: 0.03, y: 0.635, ancho: 0.94, alto: 0.115, t: 19.0 },
      },
      {
        diseno: "inclinado",
        titulo: "Sumá una cancha",
        compases: { horizontal: 3, vertical: 2 },
        clip: { desde: 23.5, hasta: 30.2 },
      },
      {
        diseno: "inclinado",
        titulo: "Horarios y precios",
        compases: { horizontal: 3, vertical: 0 },
        clip: { desde: 31.6, hasta: 38.4 },
      },
      {
        diseno: "centrado",
        titulo: "Bloqueá un turno",
        compases: { horizontal: 3.5, vertical: 2.5 },
        clip: { desde: 44.6, hasta: 50.8 },
        flotante: { x: 0.16, y: 0.54, ancho: 0.32, alto: 0.055, t: 50.3 },
      },
    ],
  },
};
