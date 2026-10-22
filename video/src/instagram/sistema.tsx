// Sistema visual de las piezas de Instagram: "Noche de partido". Marca HayCanchas
// (frontend/src/index.css): fondo noche, tinta cal, acento verde claro; Big Shoulders para
// títulos e Instrument Sans para el texto. La idea: cada carrusel es una cancha vista
// desde arriba; las líneas de cal corren de un arco al otro a lo largo de las slides.
import type React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { color, fuenteTexto, fuenteTitulo } from "../marca";

export const C = {
  noche: "#14231a",
  campo: color.cesped,
  cal: color.cal,
  acento: color.cespedClaro,
  marco: "#070c09",
};
const LINEA = "rgba(246, 241, 230, 0.16)";

export const Titulo: React.FC<{
  children: React.ReactNode;
  tamano: number;
  style?: React.CSSProperties;
}> = ({ children, tamano, style }) => (
  <div
    style={{
      fontFamily: fuenteTitulo,
      fontWeight: 900,
      fontSize: tamano,
      lineHeight: 0.88,
      letterSpacing: "-0.01em",
      textTransform: "uppercase",
      color: C.cal,
      textWrap: "balance",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Bajada: React.FC<{ children: React.ReactNode; tamano?: number; style?: React.CSSProperties }> = ({
  children,
  tamano = 40,
  style,
}) => (
  <div
    style={{
      fontFamily: fuenteTexto,
      fontWeight: 500,
      fontSize: tamano,
      lineHeight: 1.32,
      color: C.cal,
      textWrap: "pretty",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Logo circular y la dirección, siempre en el mismo lugar. */
export const Firma: React.FC<{ x: number; y: number; tamano?: number }> = ({ x, y, tamano = 30 }) => (
  <div style={{ position: "absolute", left: x, top: y, display: "flex", alignItems: "center", gap: tamano * 0.5 }}>
    <Img src={staticFile("logo-haycanchas.png")} style={{ width: tamano * 1.9, height: tamano * 1.9 }} />
    <span style={{ fontFamily: fuenteTexto, fontWeight: 600, fontSize: tamano, color: C.cal }}>
      haycanchas.com.ar
    </span>
  </div>
);

/** La app en un celular (captura real de la copia local, con datos ficticios). */
export const Celular: React.FC<{ captura: string; ancho: number; x: number; y: number }> = ({
  captura,
  ancho,
  x,
  y,
}) => {
  const borde = ancho * 0.03;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: ancho,
        padding: borde,
        borderRadius: ancho * 0.15,
        backgroundColor: C.marco,
      }}
    >
      <Img
        src={staticFile(`capturas/${captura}.png`)}
        style={{ display: "block", width: "100%", borderRadius: ancho * 0.12 }}
      />
    </div>
  );
};

/** La cancha de fútbol que atraviesa todo el carrusel (en horizontal) o la historia (en
 * vertical). Se dibuja una vez para todas las slides; cada slide muestra su pedazo. */
export const CanchaDeFondo: React.FC<{ ancho: number; alto: number; vertical?: boolean }> = ({
  ancho,
  alto,
  vertical,
}) => {
  const m = 60;
  const largo = vertical ? alto : ancho;
  const corto = vertical ? ancho : alto;
  const medio = corto / 2;
  const area = { fondo: 330, ancho: 760 };
  const chica = { fondo: 115, ancho: 340 };
  // Todo en coordenadas de la cancha acostada (largo x corto); en vertical se gira.
  const lineas = (
    <g fill="none" stroke={LINEA} strokeWidth={5}>
      <rect x={m} y={m} width={largo - 2 * m} height={corto - 2 * m} />
      <line x1={largo / 2} y1={m} x2={largo / 2} y2={corto - m} />
      <circle cx={largo / 2} cy={medio} r={vertical ? 190 : 230} />
      <circle cx={largo / 2} cy={medio} r={9} fill={LINEA} stroke="none" />
      {[m, largo - m].map((linea, i) => {
        const s = i === 0 ? 1 : -1;
        return (
          <g key={linea}>
            <rect
              x={i === 0 ? linea : linea - area.fondo}
              y={medio - area.ancho / 2}
              width={area.fondo}
              height={area.ancho}
            />
            <rect
              x={i === 0 ? linea : linea - chica.fondo}
              y={medio - chica.ancho / 2}
              width={chica.fondo}
              height={chica.ancho}
            />
            <circle cx={linea + s * 220} cy={medio} r={9} fill={LINEA} stroke="none" />
            <path
              d={`M ${linea + s * area.fondo} ${medio - 150} A 200 200 0 0 ${i === 0 ? 1 : 0} ${linea + s * area.fondo} ${medio + 150}`}
            />
          </g>
        );
      })}
    </g>
  );
  return (
    <svg width={ancho} height={alto} style={{ position: "absolute", inset: 0 }}>
      {vertical ? <g transform={`translate(${ancho} 0) rotate(90)`}>{lineas}</g> : lineas}
    </svg>
  );
};

/** Canchas de cada deporte vistas desde arriba, en líneas de cal (medidas reales). */
const MEDIDAS: Record<string, [number, number]> = {
  futbol: [68, 105],
  padel: [10, 20],
  tenis: [10.97, 23.77],
  basquet: [15, 28],
  voley: [9, 18],
};

export const CanchaDeporte: React.FC<{ deporte: keyof typeof MEDIDAS; alto: number; style?: React.CSSProperties }> = ({
  deporte,
  alto,
  style,
}) => {
  const [w, h] = MEDIDAS[deporte];
  const ancho = (alto * w) / h;
  const t = { fill: "none", stroke: C.cal, strokeWidth: 6, vectorEffect: "non-scaling-stroke" } as const;
  const lineas: Record<string, React.ReactNode> = {
    futbol: (
      <>
        <line x1={0} y1={52.5} x2={68} y2={52.5} {...t} />
        <circle cx={34} cy={52.5} r={9.15} {...t} />
        {[0, 105].map((y) => {
          const s = y === 0 ? 1 : -1;
          return (
            <g key={y}>
              <rect x={13.84} y={y === 0 ? 0 : 105 - 16.5} width={40.32} height={16.5} {...t} />
              <rect x={24.84} y={y === 0 ? 0 : 105 - 5.5} width={18.32} height={5.5} {...t} />
              <path d={`M 26.7 ${y + s * 16.5} A 9.15 9.15 0 0 ${y === 0 ? 0 : 1} 41.3 ${y + s * 16.5}`} {...t} />
            </g>
          );
        })}
      </>
    ),
    padel: (
      <>
        <line x1={0} y1={10} x2={10} y2={10} {...t} strokeWidth={12} />
        <line x1={0} y1={3.05} x2={10} y2={3.05} {...t} />
        <line x1={0} y1={16.95} x2={10} y2={16.95} {...t} />
        <line x1={5} y1={3.05} x2={5} y2={16.95} {...t} />
        <line x1={0} y1={0} x2={10} y2={0} {...t} strokeWidth={22} />
        <line x1={0} y1={20} x2={10} y2={20} {...t} strokeWidth={22} />
      </>
    ),
    tenis: (
      <>
        <line x1={1.37} y1={0} x2={1.37} y2={23.77} {...t} />
        <line x1={9.6} y1={0} x2={9.6} y2={23.77} {...t} />
        <line x1={0} y1={11.885} x2={10.97} y2={11.885} {...t} strokeWidth={12} />
        <line x1={1.37} y1={5.485} x2={9.6} y2={5.485} {...t} />
        <line x1={1.37} y1={18.285} x2={9.6} y2={18.285} {...t} />
        <line x1={5.485} y1={5.485} x2={5.485} y2={18.285} {...t} />
      </>
    ),
    basquet: (
      <>
        <line x1={0} y1={14} x2={15} y2={14} {...t} />
        <circle cx={7.5} cy={14} r={1.8} {...t} />
        {[0, 28].map((y) => {
          const s = y === 0 ? 1 : -1;
          const aro = y + s * 1.575;
          return (
            <g key={y}>
              <rect x={5.05} y={y === 0 ? 0 : 28 - 5.8} width={4.9} height={5.8} {...t} />
              <circle cx={7.5} cy={y + s * 5.8} r={1.8} {...t} />
              <line x1={0.9} y1={y} x2={0.9} y2={aro + s * 1.4} {...t} />
              <line x1={14.1} y1={y} x2={14.1} y2={aro + s * 1.4} {...t} />
              <path d={`M 0.9 ${aro + s * 1.4} A 6.75 6.75 0 0 ${y === 0 ? 0 : 1} 14.1 ${aro + s * 1.4}`} {...t} />
            </g>
          );
        })}
      </>
    ),
    voley: (
      <>
        <line x1={0} y1={9} x2={9} y2={9} {...t} strokeWidth={12} />
        <line x1={0} y1={6} x2={9} y2={6} {...t} />
        <line x1={0} y1={12} x2={9} y2={12} {...t} />
      </>
    ),
  };
  return (
    <svg width={ancho} height={alto} viewBox={`-0.5 -0.5 ${w + 1} ${h + 1}`} style={style}>
      <rect x={0} y={0} width={w} height={h} fill={C.campo} />
      <rect x={0} y={0} width={w} height={h} {...t} />
      {lineas[deporte]}
    </svg>
  );
};

/** Burbuja de un chat cualquiera (no de una marca), para el chiste del visto. */
export const Burbuja: React.FC<{ texto: string; nota: string; x: number; y: number }> = ({ texto, nota, x, y }) => (
  <div style={{ position: "absolute", left: x, top: y }}>
    <div
      style={{
        backgroundColor: C.cal,
        color: C.noche,
        fontFamily: fuenteTexto,
        fontWeight: 600,
        fontSize: 46,
        padding: "26px 36px",
        borderRadius: "40px 40px 10px 40px",
      }}
    >
      {texto}
    </div>
    <div
      style={{
        marginTop: 14,
        textAlign: "right",
        fontFamily: fuenteTexto,
        fontWeight: 500,
        fontSize: 30,
        color: C.acento,
      }}
    >
      {nota}
    </div>
  </div>
);

export const Fondo: React.FC<{ campo?: boolean }> = ({ campo }) => (
  <AbsoluteFill style={{ backgroundColor: campo ? C.campo : C.noche }} />
);
