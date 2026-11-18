// SALUD · gráficas propias en SVG (sin dependencias). Una serie por gráfica (acento), un solo eje, rejilla tenue,
// líneas de 2 px, barras con extremo redondeado, el último valor rotulado y detalle al pasar el ratón o tocar (<title>
// + resaltado). Siempre con tabla de datos desplegable. Sin datos → no se dibuja nada (lo dice la pantalla).
"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

export type Punto = { k: string; v: number; detalle?: string };
const H = 230, IZQ = 44, DER = 16, ARR = 28, ABA = 28;
const fmt = (v: number) => (Math.abs(v) >= 10000 ? `${Math.round(v / 1000)} k` : String(Math.round(v * 10) / 10).replace(".", ","));
function escala(max: number, entero = false) {
  if (entero && max <= 6) return { tope: Math.max(1, Math.ceil(max)), marcas: Array.from({ length: Math.max(1, Math.ceil(max)) + 1 }, (_, i) => i) };
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * 10 ** Math.floor(Math.log10(Math.max(1, max) / 4))).find((p) => max / p <= 5) ?? max / 4;
  const tope = Math.max(paso, Math.ceil(max / paso) * paso);
  return { tope, marcas: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) };
}

/** Ancho real del contenedor: 1 unidad del SVG = 1 px (el texto no encoge en el móvil). */
function useAncho(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function Marco({ titulo, unidad, puntos, children }: { titulo: string; unidad: string; puntos: Punto[]; children: React.ReactNode }) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-1 text-sm font-semibold text-tinta2">{titulo}</figcaption>
      {children}
      <details className="mt-1 text-sm text-tinta2">
        <summary className="cursor-pointer select-none py-1">Ver los datos</summary>
        <div className="max-h-48 overflow-auto">
          <table className="w-full text-left tabular-nums">
            <thead><tr><th className="py-1 pr-3 font-semibold">Fecha</th><th className="py-1 pr-3 font-semibold">{unidad}</th><th className="py-1 font-semibold">Detalle</th></tr></thead>
            <tbody>{puntos.map((p, i) => <tr key={i} className="border-t border-linea"><td className="py-1 pr-3">{p.k}</td><td className="py-1 pr-3">{fmt(p.v)}</td><td className="py-1">{p.detalle ?? ""}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

function Rejilla({ marcas, y, unidad, W }: { marcas: number[]; y: (v: number) => number; unidad: string; W: number }) {
  return (
    <g>
      {marcas.map((m) => (
        <g key={m}>
          <line x1={IZQ} x2={W - DER} y1={y(m)} y2={y(m)} stroke="rgba(16,24,40,0.08)" strokeWidth={1} />
          <text x={IZQ - 6} y={y(m) + 4} textAnchor="end" fontSize={11} fill="#475467">{fmt(m)}</text>
        </g>
      ))}
      <text x={IZQ - 6} y={10} textAnchor="end" fontSize={10} fill="#475467">{unidad}</text>
    </g>
  );
}
const etiquetasX = (n: number, W: number) => { const cada = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(W / 90)))); return (i: number) => i % cada === 0 || i === n - 1; };

/** Evolución de un valor (1RM estimado, peso, reps…) por día. */
export function Linea({ puntos, titulo, unidad }: { puntos: Punto[]; titulo: string; unidad: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [caja, W] = useAncho();
  const { tope, marcas } = escala(Math.max(...puntos.map((p) => p.v), 1), puntos.every((p) => Number.isInteger(p.v)));
  const x = (i: number) => (puntos.length === 1 ? (IZQ + W - DER) / 2 : IZQ + (i * (W - IZQ - DER)) / (puntos.length - 1));
  const y = (v: number) => ARR + (1 - v / tope) * (H - ARR - ABA);
  const muestra = etiquetasX(puntos.length, W);
  const h = hover ?? puntos.length - 1;
  return (
    <Marco titulo={titulo} unidad={unidad} puntos={puntos}>
      <div ref={caja}><svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${titulo}: ${puntos.map((p) => `${p.k} ${fmt(p.v)}`).join(", ")}`} onMouseLeave={() => setHover(null)}>
        <Rejilla marcas={marcas} y={y} unidad={unidad} W={W} />
        {puntos.length > 1 ? <polyline fill="none" stroke="#2563EB" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={puntos.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")} /> : null}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={ARR} y2={H - ABA} stroke="#98A2B3" strokeWidth={1} strokeDasharray="3 3" /> : null}
        {puntos.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.v)} r={i === h ? 5 : 3.5} fill="#2563EB" stroke="#fff" strokeWidth={2} />
            <rect x={x(i) - 14} y={ARR} width={28} height={H - ARR - ABA} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}><title>{`${p.k}: ${fmt(p.v)} ${unidad}${p.detalle ? ` · ${p.detalle}` : ""}`}</title></rect>
            {muestra(i) ? <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#475467">{p.k}</text> : null}
          </g>
        ))}
        <text x={Math.min(Math.max(x(h), IZQ + 40), W - DER - 40)} y={Math.max(12, y(puntos[h].v) - 10)} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0B1220">
          {fmt(puntos[h].v)} {unidad}{puntos[h].detalle ? ` · ${puntos[h].detalle}` : ""}
        </text>
      </svg></div>
    </Marco>
  );
}

/** Barras verticales (volumen o series por semana). */
export function Barras({ puntos, titulo, unidad }: { puntos: Punto[]; titulo: string; unidad: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [caja, W] = useAncho();
  const { tope, marcas } = escala(Math.max(...puntos.map((p) => p.v), 1), puntos.every((p) => Number.isInteger(p.v)));
  const ancho = (W - IZQ - DER) / puntos.length;
  const y = (v: number) => ARR + (1 - v / tope) * (H - ARR - ABA);
  const muestra = etiquetasX(puntos.length, W);
  const h = hover ?? puntos.length - 1;
  return (
    <Marco titulo={titulo} unidad={unidad} puntos={puntos}>
      <div ref={caja}><svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${titulo}: ${puntos.map((p) => `${p.k} ${fmt(p.v)}`).join(", ")}`} onMouseLeave={() => setHover(null)}>
        <Rejilla marcas={marcas} y={y} unidad={unidad} W={W} />
        {puntos.map((p, i) => {
          const bx = IZQ + i * ancho + 1, bw = Math.max(2, Math.min(36, ancho - 4)), cxm = IZQ + i * ancho + ancho / 2;
          const alto = Math.max(p.v > 0 ? 2 : 0, H - ABA - y(p.v));
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={bx} y={ARR} width={ancho - 2} height={H - ARR - ABA} fill="transparent"><title>{`${p.k}: ${fmt(p.v)} ${unidad}${p.detalle ? ` · ${p.detalle}` : ""}`}</title></rect>
              <path d={`M${cxm - bw / 2} ${H - ABA} V${H - ABA - alto + Math.min(4, alto)} q0 -${Math.min(4, alto)} ${Math.min(4, bw / 2)} -${Math.min(4, alto)} H${cxm + bw / 2 - Math.min(4, bw / 2)} q${Math.min(4, bw / 2)} 0 ${Math.min(4, bw / 2)} ${Math.min(4, alto)} V${H - ABA} Z`}
                fill={i === h ? "#1D4ED8" : "#2563EB"} fillOpacity={i === h ? 1 : 0.75} pointerEvents="none" />
              {muestra(i) ? <text x={cxm} y={H - 8} textAnchor="middle" fontSize={11} fill="#475467">{p.k}</text> : null}
            </g>
          );
        })}
        <text x={Math.min(Math.max(IZQ + h * ancho + ancho / 2, IZQ + 50), W - DER - 50)} y={Math.max(12, y(puntos[h].v) - 8)} textAnchor="middle" fontSize={12} fontWeight={700} fill="#0B1220">
          {fmt(puntos[h].v)} {unidad}{puntos[h].detalle ? ` · ${puntos[h].detalle}` : ""}
        </text>
      </svg></div>
    </Marco>
  );
}

/** Series semanales por músculo frente a la referencia orientativa (banda 10–20). */
export function Musculos({ filas, referencia: ref }: { filas: { musculo: string; nombre: string; por_semana: number; nivel: string }[]; referencia: { min: number; max: number } }) {
  const tope = Math.max(ref.max + 4, ...filas.map((f) => f.por_semana));
  const pct = (v: number) => `${(v / tope) * 100}%`;
  const NIVEL: Record<string, { t: string; c: string }> = { sin_trabajar: { t: "sin trabajar", c: "text-peligro-tinta" }, poco: { t: "por debajo", c: "text-aviso-tinta" }, en_rango: { t: "en la referencia", c: "text-ok-tinta" }, mucho: { t: "por encima", c: "text-tinta2" } };
  return (
    <figure>
      <figcaption className="mb-3 text-sm text-tinta2">Series por semana (las de músculo secundario cuentan la mitad). Banda: referencia orientativa {ref.min}–{ref.max}, no una prescripción.</figcaption>
      <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        {filas.map((f) => (
          <li key={f.musculo} className="text-sm">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="font-semibold">{f.nombre}</span>
              <span className={cx("tabular-nums", NIVEL[f.nivel]?.c)}><b className="text-tinta">{String(f.por_semana).replace(".", ",")}</b> / semana · {NIVEL[f.nivel]?.t ?? f.nivel}</span>
            </div>
            <span className="relative block h-3 rounded-full bg-superficie2" title={`${f.nombre}: ${String(f.por_semana).replace(".", ",")} series/semana`}>
              <span className="absolute inset-y-0 rounded-full bg-ok/20" style={{ left: pct(ref.min), width: `calc(${pct(ref.max)} - ${pct(ref.min)})` }} />
              <span className="absolute inset-y-0 left-0 rounded-full bg-acento" style={{ width: pct(Math.max(f.por_semana, 0)) }} />
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
