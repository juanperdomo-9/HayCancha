// Pasos de cada grabación (public/steps-*.json, generados al grabar).
import { staticFile } from "remotion";

// Zona tocada (0 a 1 de la pantalla) y el segundo del toque.
export type Foco = {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  toque: number;
};

export type Paso = {
  inicio: number;
  fin: number;
  descripcion: string;
  foco: Foco | null;
};

export type Grabacion = {
  video: string;
  duracion: number;
  ancho: number;
  alto: number;
  pasos: Paso[];
};

export type Serie = "jugador" | "dueno";
export type Formato = "horizontal" | "vertical";

export async function cargarGrabacion(serie: Serie): Promise<Grabacion> {
  const respuesta = await fetch(staticFile(`steps-${serie}.json`));
  if (!respuesta.ok) {
    throw new Error(
      `Falta public/steps-${serie}.json: corré "npm run grabaciones".`,
    );
  }
  return respuesta.json();
}
