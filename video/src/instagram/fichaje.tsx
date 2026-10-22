// "Nuevo fichaje": el anuncio de cada complejo que se suma, como el de un refuerzo.
// Carrusel de 3 slides (1080x1350) + historia (1080x1920), con los datos reales que carga
// el complejo (public/fichajes/<slug>.json, lo baja scripts/fichaje.mjs).
import type React from "react";
import { AbsoluteFill, type CalculateMetadataFunction, Img, staticFile, useCurrentFrame } from "remotion";
import { fuenteTexto, fuenteTitulo } from "../marca";
import { Bajada, C, CanchaDeFondo, Celular, Firma, Titulo } from "./sistema";

export type DatosFichaje = {
  slug: string;
  nombre: string;
  barrio: string | null;
  logo_url: string | null;
  color_primario: string;
  servicios: string[];
  deportes: { nombre: string; canchas: { caracteristicas: string | null }[] }[];
};
export type PropsFichaje = { slug: string; datos?: DatosFichaje };

export const calcularFichaje: CalculateMetadataFunction<PropsFichaje> = async ({ props }) => {
  const respuesta = await fetch(staticFile(`fichajes/${props.slug}.json`));
  if (!respuesta.ok) throw new Error(`Falta public/fichajes/${props.slug}.json: corré scripts/fichaje.mjs`);
  return { props: { ...props, datos: await respuesta.json() } };
};

/** Las mismas iniciales que la web (frontend/src/utils/formato.ts). */
function iniciales(nombre: string): string {
  const palabras = nombre
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2 || /\d/.test(p));
  return (palabras.length >= 2 ? palabras[0][0] + palabras[1][0] : (palabras[0] ?? nombre).slice(0, 2)).toUpperCase();
}

/** El escudo del complejo: su logo o sus iniciales, en un círculo de su color. */
export const Escudo: React.FC<{ d: DatosFichaje; tamano: number }> = ({ d, tamano }) => (
  <div
    style={{
      width: tamano,
      height: tamano,
      borderRadius: "50%",
      backgroundColor: d.color_primario,
      outline: `${tamano * 0.025}px solid ${C.cal}`,
      outlineOffset: tamano * 0.03,
      display: "grid",
      placeItems: "center",
      overflow: "hidden",
    }}
  >
    {d.logo_url ? (
      <Img
        src={/^https?:/.test(d.logo_url) ? d.logo_url : staticFile(d.logo_url)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    ) : (
      <span style={{ fontFamily: fuenteTitulo, fontWeight: 900, fontSize: tamano * 0.42, color: "#fff" }}>
        {iniciales(d.nombre)}
      </span>
    )}
  </div>
);

const Oficial: React.FC<{ tamano: number }> = ({ tamano }) => (
  <div
    style={{
      fontFamily: fuenteTitulo,
      fontWeight: 900,
      fontSize: tamano,
      lineHeight: 0.85,
      letterSpacing: "-0.01em",
      color: C.acento,
    }}
  >
    OFICIAL
  </div>
);

/** Lo que tiene, como la ficha técnica de un jugador. */
export function ficha(d: DatosFichaje): [string, string][] {
  const deportes = d.deportes
    .map((x) => `${x.nombre} (${x.canchas.length} ${x.canchas.length === 1 ? "cancha" : "canchas"})`)
    .join(" · ");
  const caracteristicas = [
    ...new Set(
      d.deportes.flatMap((x) =>
        x.canchas.flatMap((c) => (c.caracteristicas ?? "").split(",").map((s) => s.trim().toLowerCase())),
      ),
    ),
  ].filter(Boolean);
  const filas: [string, string][] = [];
  if (d.barrio) filas.push(["Dónde", d.barrio]);
  filas.push(["Deportes", deportes]);
  if (caracteristicas.length) filas.push(["Canchas", caracteristicas.join(", ")]);
  if (d.servicios.length) filas.push(["Servicios", d.servicios.join(", ")]);
  return filas;
}

const Slide: React.FC<{ d: DatosFichaje; n: number }> = ({ d, n }) => {
  if (n === 0) {
    return (
      <>
        <div style={{ position: "absolute", left: 84, top: 110 }}>
          <Oficial tamano={250} />
        </div>
        <div style={{ position: "absolute", left: 84, top: 420, display: "flex", alignItems: "center", gap: 56 }}>
          <Escudo d={d} tamano={330} />
        </div>
        <div style={{ position: "absolute", left: 84, right: 84, top: 830 }}>
          <Titulo tamano={120}>{d.nombre}</Titulo>
          <Bajada tamano={46} style={{ marginTop: 26 }}>
            se suma a HayCanchas.
          </Bajada>
        </div>
        <Firma x={84} y={1236} />
      </>
    );
  }
  if (n === 1) {
    return (
      <>
        <div style={{ position: "absolute", left: 84, right: 84, top: 110 }}>
          <Titulo tamano={150}>Ficha técnica</Titulo>
        </div>
        <div style={{ position: "absolute", left: 84, right: 84, top: 330, display: "grid", gap: 44 }}>
          {ficha(d).map(([etiqueta, valor]) => (
            <div key={etiqueta}>
              <div style={{ fontFamily: fuenteTexto, fontWeight: 500, fontSize: 34, color: C.acento }}>{etiqueta}</div>
              <div
                style={{
                  fontFamily: fuenteTitulo,
                  fontWeight: 800,
                  fontSize: 62,
                  lineHeight: 1.02,
                  color: C.cal,
                  marginTop: 6,
                  textWrap: "balance",
                }}
              >
                {valor}
              </div>
            </div>
          ))}
        </div>
        <Firma x={84} y={1236} />
      </>
    );
  }
  return (
    <>
      <div style={{ position: "absolute", left: 84, right: 84, top: 110 }}>
        <Titulo tamano={150}>Ya podés reservar</Titulo>
        <div style={{ fontFamily: fuenteTexto, fontWeight: 600, fontSize: 46, color: C.acento, marginTop: 30 }}>
          haycanchas.com.ar/{d.slug}
        </div>
      </div>
      <Celular captura={`fichaje-${d.slug}`} ancho={520} x={490} y={470} />
    </>
  );
};

/** Carrusel: cuadro N = slide N. La cancha de fondo corre por las 3 slides. */
export const Fichaje: React.FC<PropsFichaje> = ({ datos }) => {
  const n = useCurrentFrame();
  if (!datos) return null;
  return (
    <AbsoluteFill style={{ backgroundColor: n === 2 ? C.campo : C.noche, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: -n * 1080, width: 3 * 1080, height: 1350 }}>
        <CanchaDeFondo ancho={3 * 1080} alto={1350} />
      </div>
      <Slide d={datos} n={n} />
    </AbsoluteFill>
  );
};

/** Historia: lo mismo que la portada, con el texto dentro de la zona segura. */
export const FichajeHistoria: React.FC<PropsFichaje> = ({ datos }) => {
  if (!datos) return null;
  return (
    <AbsoluteFill style={{ backgroundColor: C.noche }}>
      <CanchaDeFondo ancho={1080} alto={1920} vertical />
      <div style={{ position: "absolute", left: 84, right: 84, top: 300 }}>
        <Oficial tamano={260} />
      </div>
      <div style={{ position: "absolute", left: 84, top: 620 }}>
        <Escudo d={datos} tamano={380} />
      </div>
      <div style={{ position: "absolute", left: 84, right: 84, top: 1090 }}>
        <Titulo tamano={130}>{datos.nombre}</Titulo>
        <Bajada tamano={48} style={{ marginTop: 26 }}>
          se suma a HayCanchas. Reservá en haycanchas.com.ar/{datos.slug}
        </Bajada>
      </div>
    </AbsoluteFill>
  );
};
