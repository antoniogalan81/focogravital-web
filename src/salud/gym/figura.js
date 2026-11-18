// GYM · FIGURA ANATÓMICA propia (vector, sin imágenes de terceros): silueta estilizada de frente y de espalda y las
// regiones de cada grupo muscular. Sólo DATOS: la app (react-native-svg) y la web (<svg>) dibujan lo mismo a partir de
// aquí. viewBox de cada vista: 0 0 100 200. Este fichero es idéntico en APP, WEB y CEOPadre (prueba de contrato).

/** Cápsula afinada entre (x1,y1) radio r1 y (x2,y2) radio r2: brazos, piernas y vientres musculares. */
function capsula(x1, y1, r1, x2, y2, r2) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const f = (v) => Math.round(v * 100) / 100;
  const a = [x1 + nx * r1, y1 + ny * r1], b = [x2 + nx * r2, y2 + ny * r2], c = [x2 - nx * r2, y2 - ny * r2], d = [x1 - nx * r1, y1 - ny * r1];
  return `M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])} A${r2} ${r2} 0 0 0 ${f(c[0])} ${f(c[1])} L${f(d[0])} ${f(d[1])} A${r1} ${r1} 0 0 0 ${f(a[0])} ${f(a[1])} Z`;
}
const espejo = (x) => 100 - x;
/** La misma pieza a ambos lados del cuerpo. */
const par = (fn) => [fn((x) => x), fn(espejo)];
const elipse = (cx, cy, rx, ry) => `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
const pecL = (X) => `M${X(49.5)} 39 C${X(43)} 36.5 ${X(36)} 37.5 ${X(34)} 43 C${X(33)} 50 ${X(38)} 57 ${X(49.5)} 56 Z`;

const cuerpo = [
  elipse(50, 15, 8.5, 10.5),                                      // cabeza
  'M45.5 24 L54.5 24 L55.5 32 L44.5 32 Z',                        // cuello
  'M36 32.5 Q50 29.5 64 32.5 Q70.5 34.5 69.5 44 L66.5 70 Q64.5 84 63 98 L37 98 Q35.5 84 33.5 70 L30.5 44 Q29.5 34.5 36 32.5 Z', // tronco
  ...par((X) => capsula(X(30.5), 38, 6, X(26.5), 68, 4.6)),      // brazo
  ...par((X) => capsula(X(26.5), 70, 4.6, X(23.5), 98, 3.4)),     // antebrazo
  ...par((X) => elipse(X(23), 104, 3.4, 5)),                       // mano
  ...par((X) => capsula(X(41.8), 100, 7.6, X(43.2), 146, 5.2)),        // muslo
  ...par((X) => capsula(X(43.2), 148, 5, X(43.8), 186, 3.3)),      // pierna
  ...par((X) => elipse(X(43.8), 191, 4.2, 2.6)),                   // pie
];

export const REGIONES = {
  frente: {
    hombros: par((X) => capsula(X(31.5), 38.5, 6.6, X(29.5), 47.5, 5.2)),
    pecho: par(pecL),
    biceps: par((X) => capsula(X(28.3), 52, 4.3, X(26.8), 65.5, 3.5)),
    antebrazo: par((X) => capsula(X(25.8), 73, 4, X(24.2), 92, 3)),
    abdomen: ['M43 60 Q50 58 57 60 L56.2 89 Q50 92.5 43.8 89 Z'],
    piernas: par((X) => capsula(X(41.8), 106, 6.6, X(43), 138, 4.7)),
    gemelos: par((X) => capsula(X(42.8), 153, 3, X(43.3), 172, 2.3)),
  },
  espalda: {
    espalda: ['M37 35 Q50 30.5 63 35 L65.5 50 Q62.5 70 50 84 Q37.5 70 34.5 50 Z'],
    hombros: par((X) => capsula(X(31.5), 38.5, 6.6, X(29.5), 47.5, 5.2)),
    triceps: par((X) => capsula(X(29), 50.5, 4.4, X(27.2), 66, 3.6)),
    antebrazo: par((X) => capsula(X(25.8), 73, 4, X(24.2), 92, 3)),
    gluteos: par((X) => elipse(X(44), 101, 6.3, 7.2)),
    piernas: par((X) => capsula(X(42), 113, 6.2, X(43), 140, 4.6)),
    gemelos: par((X) => capsula(X(43.2), 151, 4.6, X(43.6), 172, 3.2)),
    abdomen: [], // la zona lumbar se dibuja con «espalda»
  },
};
export const SILUETA = { frente: cuerpo, espalda: cuerpo };
const DETRAS = new Set(['espalda', 'gluteos', 'gemelos', 'triceps']);

/** La vista que mejor enseña un músculo. */
export const vistaDe = (musculo) => (DETRAS.has(musculo) ? 'espalda' : 'frente');

/**
 * Qué pintar para un ejercicio: { vista, silueta, principal: [paths], secundarios: [paths] } en la vista de su músculo
 * principal (los secundarios que no se ven en esa vista se omiten; el detalle enseña las dos vistas).
 */
export function figura(principal, secundarios = [], vista = vistaDe(principal)) {
  const R = REGIONES[vista] || REGIONES.frente;
  return {
    vista, silueta: SILUETA[vista],
    principal: R[principal] || [],
    secundarios: [...new Set(secundarios || [])].filter((m) => m !== principal).flatMap((m) => R[m] || []),
  };
}
