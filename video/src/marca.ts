// Marca HayCanchas, tomada de frontend/src/index.css ("Cal y césped", modo oscuro).
import { Easing } from "remotion";
import { loadFont as cargarTitulos } from "@remotion/google-fonts/BigShoulders";
import { loadFont as cargarTexto } from "@remotion/google-fonts/InstrumentSans";

// Las dos de la web: Big Shoulders para títulos y números (cartel de estadio) e
// Instrument Sans para el texto chico.
export const { fontFamily: fuenteTitulo } = cargarTitulos("normal", {
  weights: ["800", "900"],
  subsets: ["latin"],
});
export const { fontFamily: fuenteTexto } = cargarTexto("normal", {
  weights: ["400", "500", "600"],
  subsets: ["latin"],
});

export const color = {
  fondo: "#0e1511", // crema en modo oscuro (fondo de la página)
  bloque: "#172a1f", // bloque oscuro de la marca
  linea: "#2c3d33",
  cal: "#f6f1e6",
  gris: "#a7b1a9",
  cesped: "#1e7a3e",
  cespedClaro: "#57c986",
};

export const URL_REAL = "haycanchas.com.ar";

export const suave = Easing.bezier(0.16, 1, 0.3, 1);
// Salidas: también ease-out (fuerte), así la respuesta es inmediata; nunca ease-in.
export const rapida = Easing.bezier(0.23, 1, 0.32, 1);

// Música: "Tema Minimal House" de maty1309 (Pixabay, uso libre, sin Content ID), 124 BPM.
// Arranca en la parte con más energía, justo sobre un compás.
export const BPM = 124;
export const COMPAS = (60 / BPM) * 4; // segundos
export const INICIO_MUSICA = 31.03; // segundos del tema (beat 64)
