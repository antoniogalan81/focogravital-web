// SALUD · piezas de interfaz comunes de la web (sistema de diseño: APP/docs/salud/DISENO.md).
// Iconos: trazos tipo Feather en SVG en línea. Figura anatómica: datos de ./gym/figura.js dibujados en <svg>.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import SiteShell from "@/components/SiteShell";
import { useAuth } from "@/src/contexts/AuthContext";
import * as F from "./gym/figura.js";
import * as M from "./gym/motor.js";
import { useGym, reintentarNoGuardados, type Ejercicio } from "./store";

export const MUSCULOS: Record<string, string> = {
  pecho: "Pecho", espalda: "Espalda", piernas: "Piernas", gluteos: "Glúteos", gemelos: "Gemelos", hombros: "Hombros", biceps: "Bíceps",
  triceps: "Tríceps", abdomen: "Abdomen", antebrazo: "Antebrazo", cardio: "Cardio", otro: "Otro",
};
export const EQUIPOS: Record<string, string> = {
  barra: "Barra", mancuernas: "Mancuernas", maquina: "Máquina", polea: "Polea", multipower: "Multipower", peso_corporal: "Peso corporal",
  kettlebell: "Kettlebell", banda: "Banda", maquina_cardio: "Cardio", otro: "Otro",
};
export const kg = (w: number | null | undefined) => (w === null || w === undefined ? "—" : `${String(w).replace(".", ",")} kg`);
export const num = (w: number | null | undefined) => (w === null || w === undefined ? "—" : String(w).replace(".", ","));
export const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;
export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(" ");
export const fecha = (iso: string, o: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) => new Date(iso).toLocaleDateString("es-ES", o);
export const diaCorto = (dia: string) => new Date(`${dia}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });

// ---------------------------------------------------------------- iconos

const ICONOS: Record<string, string> = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  "chevron-up": '<polyline points="18 15 12 9 6 15"/>',
  "chevron-down": '<polyline points="6 9 12 15 18 9"/>',
  "chevron-left": '<polyline points="15 18 9 12 15 6"/>',
  "chevron-right": '<polyline points="9 18 15 12 9 6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  watch: '<circle cx="12" cy="12" r="7"/><polyline points="12 9 12 12 13.5 13.5"/><path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-2 1.82H9.83a2 2 0 0 1-2-1.82l-.35-3.83m.01-10.7l.35-3.83A2 2 0 0 1 9.83 1h4.35a2 2 0 0 1 2 1.82l.35 3.83"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  "trending-up": '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  "skip-forward": '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
  "volume-2": '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',
  "volume-x": '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
  "rotate-ccw": '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  archive: '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  message: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  "arrow-left": '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
};
export function Icono({ n, size = 20, className }: { n: string; size?: number; className?: string }) {
  return <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
    className={cx("shrink-0", className)} dangerouslySetInnerHTML={{ __html: ICONOS[n] ?? "" }} />;
}

// ---------------------------------------------------------------- figura anatómica

export function Figura({ principal, secundarios = [], vista, foco = false, className, titulo }:
  { principal: string; secundarios?: string[]; vista?: "frente" | "espalda"; foco?: boolean; className?: string; titulo?: string }) {
  const f = F.figura(principal, secundarios, vista);
  const ac = foco ? "#4F8BFF" : "#2563EB";
  return (
    <svg viewBox="0 0 100 200" className={className} role="img" aria-label={titulo ?? `${MUSCULOS[principal] ?? principal} · vista de ${f.vista}`}>
      {f.silueta.map((d, i) => <path key={`s${i}`} d={d} fill={foco ? "#243045" : "#E4E7EC"} />)}
      {f.secundarios.map((d, i) => <path key={`b${i}`} d={d} fill={ac} fillOpacity={0.32} />)}
      {f.principal.map((d, i) => <path key={`p${i}`} d={d} fill={ac} />)}
    </svg>
  );
}
/** Miniatura del ejercicio: figura en la vista de su músculo principal. */
export function Mini({ e, foco, className = "h-14 w-8" }: { e?: Ejercicio | null; foco?: boolean; className?: string }) {
  if (!e) return <span className={className} />;
  return <Figura principal={e.primary_muscle} secundarios={e.secondary_muscles} foco={foco} className={className} />;
}

// ---------------------------------------------------------------- controles

export function Etiqueta({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cx("text-xs font-bold uppercase tracking-[0.05em] text-tinta2", className)}>{children}</p>;
}
export function Tarjeta({ children, className, ...r }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return <section {...r} className={cx("rounded-[20px] border border-linea bg-superficie p-4 sm:p-5", className)}>{children}</section>;
}

type TipoBoton = "primario" | "secundario" | "peligro" | "ok" | "fantasma" | "foco";
const BOTON: Record<TipoBoton, string> = {
  primario: "bg-acento text-white hover:bg-acento-tinta shadow-[0_6px_16px_-6px_rgba(37,99,235,0.6)]",
  secundario: "bg-superficie text-tinta border border-linea hover:bg-superficie2",
  peligro: "bg-peligro-suave text-peligro-tinta hover:bg-[#fde4e1]",
  ok: "bg-foco-ok text-foco hover:brightness-105",
  fantasma: "text-acento-tinta hover:bg-acento-suave",
  foco: "bg-foco-tarjeta text-foco-texto border border-foco-linea hover:bg-[#1c2740]",
};
export function Boton({ children, tipo = "primario", grande, icono, className, ...r }:
  { children: ReactNode; tipo?: TipoBoton; grande?: boolean; icono?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...r}
      className={cx("salud-anim inline-flex items-center justify-center gap-2 rounded-[14px] px-5 font-semibold active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento",
        grande ? "min-h-[58px] text-[17px] px-6" : "min-h-12 text-[15px]", BOTON[tipo], className)}>
      {icono ? <Icono n={icono} size={grande ? 22 : 18} /> : null}
      {children}
    </button>
  );
}
export function Chip({ children, activo, icono, foco, tono, className, ...r }:
  { children: ReactNode; activo?: boolean; icono?: string; foco?: boolean; tono?: "aviso" | "mama" | "peligro" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = foco
    ? activo ? "bg-foco-acento text-white border-transparent" : "bg-foco-tarjeta text-foco-texto border-foco-linea hover:bg-[#1c2740]"
    : activo ? (tono === "aviso" ? "bg-aviso text-white border-transparent" : tono === "mama" ? "bg-mama text-white border-transparent" : "bg-tinta text-white border-transparent")
      : tono === "peligro" ? "bg-superficie text-peligro-tinta border-linea hover:bg-peligro-suave" : "bg-superficie text-tinta border-linea hover:bg-superficie2";
  return (
    <button type="button" aria-pressed={activo === undefined ? undefined : !!activo} {...r}
      className={cx("salud-anim inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold active:scale-[0.97] disabled:opacity-45",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento", base, className)}>
      {icono ? <Icono n={icono} size={16} /> : null}
      {children}
    </button>
  );
}
/** Segmento compacto: opciones en una fila (duración, modalidad…). */
export function Segmento<T extends string | number | null>({ opciones, valor, onCambio, etiqueta, foco, testid, lleno }:
  { opciones: { v: T; t: string }[]; valor: T; onCambio: (v: T) => void; etiqueta: string; foco?: boolean; testid?: string; lleno?: boolean }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} data-testid={testid}
      className={cx("max-w-full gap-1 rounded-full p-1", lleno ? "flex w-full" : "inline-flex flex-wrap", foco ? "bg-foco-tarjeta" : "bg-superficie2")}>
      {opciones.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={valor === o.v} onClick={() => onCambio(o.v)} data-testid={testid ? `${testid}-${o.v ?? "completa"}` : undefined}
          className={cx("salud-anim min-h-10 whitespace-nowrap rounded-full text-[15px]", lleno ? "flex-1 px-1.5 sm:px-3.5" : "px-3.5", " font-semibold tabular-nums focus-visible:outline-2 focus-visible:outline-acento",
            valor === o.v ? (foco ? "bg-foco-acento text-white" : "bg-superficie text-tinta shadow-[0_1px_3px_rgba(16,24,40,0.12)]") : foco ? "text-foco-sec hover:text-foco-texto" : "text-tinta2 hover:text-tinta")}>
          {o.t}
        </button>
      ))}
    </div>
  );
}

const leer = (t: string) => { const x = t.trim().replace(",", "."); if (x === "") return null; const v = Number(x); return Number.isFinite(v) ? v : undefined; };
/** − valor + con paso; el valor se escribe directamente (teclado numérico en el móvil). */
export function Paso({ valor, onCambio, paso = 1, min = 0, max = 999, sufijo, etiqueta, decimales, foco, grande, testid }:
  { valor: number | null; onCambio: (v: number | null) => void; paso?: number; min?: number; max?: number; sufijo?: string; etiqueta: string; decimales?: boolean; foco?: boolean; grande?: boolean; testid?: string }) {
  const [texto, setTexto] = useState(valor === null ? "" : String(valor).replace(".", ","));
  const [visto, setVisto] = useState(valor);
  if (visto !== valor) { setVisto(valor); if (leer(texto) !== valor) setTexto(valor === null ? "" : String(valor).replace(".", ",")); }
  const fijar = (v: number | null) => onCambio(v === null ? null : Math.min(max, Math.max(min, Math.round(v * 100) / 100)));
  const id = useId();
  const btn = cx("salud-anim grid shrink-0 place-items-center rounded-[12px] active:scale-95 focus-visible:outline-2 focus-visible:outline-acento",
    grande ? "h-14 w-14" : "h-12 w-12", foco ? "bg-[#1c2740] text-foco-texto hover:bg-[#24314d]" : "bg-superficie2 text-tinta hover:bg-[#e6e9ee]");
  return (
    <div className="min-w-0 flex-1">
      <label htmlFor={id} className={cx("mb-1.5 block text-xs font-bold uppercase tracking-[0.05em]", foco ? "text-foco-sec" : "text-tinta2")}>{etiqueta}</label>
      <div className={cx("flex items-center gap-1.5 rounded-[16px] border p-1.5", foco ? "border-foco-linea bg-foco-tarjeta" : "border-linea bg-superficie")}>
        <button type="button" aria-label={`Menos ${etiqueta.toLowerCase()}`} className={btn} onClick={() => fijar((valor ?? 0) - paso)} data-testid={testid && `${testid}-menos`}><Icono n="minus" size={22} /></button>
        <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1">
          <input id={id} data-testid={testid && `${testid}-input`} inputMode={decimales ? "decimal" : "numeric"} enterKeyHint="done" autoComplete="off" value={texto}
            onChange={(e) => { setTexto(e.target.value); const v = leer(e.target.value); if (v !== undefined) fijar(v); }}
            onBlur={() => setTexto(valor === null ? "" : String(valor).replace(".", ","))}
            onFocus={(e) => e.target.select()} placeholder="—"
            className={cx("w-full min-w-0 bg-transparent text-center font-extrabold tabular-nums outline-none", grande ? "text-[34px]" : "text-[26px]", foco ? "text-foco-texto placeholder:text-foco-sec" : "text-tinta placeholder:text-tinta3")} />
          {sufijo ? <span className={cx("text-sm font-semibold", foco ? "text-foco-sec" : "text-tinta2")}>{sufijo}</span> : null}
        </div>
        <button type="button" aria-label={`Más ${etiqueta.toLowerCase()}`} className={btn} onClick={() => fijar((valor ?? 0) + paso)} data-testid={testid && `${testid}-mas`}><Icono n="plus" size={22} /></button>
      </div>
    </div>
  );
}

export function Interruptor({ si, onCambio, etiqueta, detalle }: { si: boolean; onCambio: (v: boolean) => void; etiqueta: string; detalle?: string }) {
  return (
    <button type="button" role="switch" aria-checked={si} onClick={() => onCambio(!si)} className="flex min-h-12 w-full items-center gap-3 text-left">
      <span className="flex-1"><span className="block text-base font-medium text-tinta">{etiqueta}</span>{detalle ? <span className="block text-sm text-tinta2">{detalle}</span> : null}</span>
      <span className={cx("salud-anim relative h-7 w-12 shrink-0 rounded-full", si ? "bg-acento" : "bg-[#D0D5DD]")}>
        <span className={cx("salud-anim absolute top-1 h-5 w-5 rounded-full bg-white shadow", si ? "left-6" : "left-1")} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------- hoja (abajo en móvil, centrada en escritorio)

export function Hoja({ abierta, onCerrar, titulo, children, foco, ancha, testid }:
  { abierta: boolean; onCerrar: () => void; titulo: string; children: ReactNode; foco?: boolean; ancha?: boolean; testid?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierta) return;
    const previo = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    window.addEventListener("keydown", k);
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = o; previo?.focus?.(); };
  }, [abierta, onCerrar]);
  if (!abierta) return null;
  return (
    <div className="salud fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6" data-testid={testid}>
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-[rgba(11,18,32,0.45)] backdrop-blur-[2px]" onClick={onCerrar} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal aria-label={titulo}
        className={cx("relative flex max-h-[88dvh] w-full flex-col rounded-t-[24px] shadow-[0_-12px_40px_rgba(11,18,32,0.25)] outline-none md:rounded-[24px]",
          ancha ? "md:max-w-3xl" : "md:max-w-lg", foco ? "bg-foco text-foco-texto" : "bg-superficie text-tinta")}>
        <div className="flex items-center gap-3 px-5 pb-2 pt-4">
          <h2 className="flex-1 text-lg font-bold">{titulo}</h2>
          <button type="button" aria-label="Cerrar" onClick={onCerrar} data-testid="hoja-cerrar"
            className={cx("grid h-11 w-11 place-items-center rounded-full", foco ? "hover:bg-foco-tarjeta" : "hover:bg-superficie2")}><Icono n="x" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </div>
  );
}

/** Aviso flotante breve (con «Deshacer» opcional). */
export function Toast({ texto, onDeshacer, foco }: { texto: string; onDeshacer?: () => void; foco?: boolean }) {
  return (
    <div role="status" aria-live="polite" data-testid="toast"
      className={cx("fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl px-4 py-3 shadow-xl md:bottom-8",
        foco ? "bg-[#F2F4F7] text-tinta" : "bg-tinta text-white")}>
      <span className="flex-1 text-[15px]">{texto}</span>
      {onDeshacer ? <button type="button" onClick={onDeshacer} data-testid="toast-deshacer" className={cx("min-h-10 rounded-full px-3 text-sm font-bold", foco ? "text-acento-tinta" : "text-[#93B4FF]")}>Deshacer</button> : null}
    </div>
  );
}

// ---------------------------------------------------------------- selector de ejercicio

/**
 * Búsqueda por nombre/alias/músculo/máquina (motor `buscar`), filtros por músculo y material, sugerencias primero
 * (alternativas al sustituir) y alta rápida de uno personalizado (nombre + músculo + material).
 */
export function SelectorEjercicio({ abierta, onCerrar, ej, onElegir, sugeridos = [], titulo, onCrear, foco }:
  { abierta: boolean; onCerrar: () => void; ej: Record<string, Ejercicio>; onElegir: (e: Ejercicio) => void; sugeridos?: Ejercicio[]; titulo: string;
    onCrear?: (x: { name: string; primary_muscle: string; equipment: string }) => Promise<Ejercicio>; foco?: boolean }) {
  const [q, setQ] = useState("");
  const [musc, setMusc] = useState<string | null>(null);
  const [equipo, setEquipo] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<{ name: string; primary_muscle: string; equipment: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const lista = useMemo(() => (M.buscar(ej, q, { musculo: musc, max: 120 }) as Ejercicio[]).filter((x) => !equipo || x.equipment === equipo), [ej, q, musc, equipo]);
  const sug = q || musc || equipo ? [] : sugeridos;
  const filas = [...sug.map((x) => ({ x, sug: true })), ...lista.filter((x) => !sug.some((y) => y.id === x.id)).map((x) => ({ x, sug: false }))];
  const cerrar = () => { setNuevo(null); setErr(null); onCerrar(); };
  const sec = foco ? "text-foco-sec" : "text-tinta2";
  return (
    <Hoja abierta={abierta} onCerrar={cerrar} titulo={titulo} foco={foco} ancha testid="selector">
      {nuevo ? (
        <div className="space-y-4 pb-2">
          <label className="block"><span className={cx("mb-1 block text-sm", sec)}>Nombre del ejercicio</span>
            <input data-testid="nuevo-ej-nombre" value={nuevo.name} onChange={(e) => setNuevo({ ...nuevo, name: e.target.value })} autoFocus
              className="min-h-12 w-full rounded-[14px] border border-linea bg-superficie2 px-4 text-base text-tinta outline-none focus:border-acento" /></label>
          <Etiqueta className={sec}>Músculo principal</Etiqueta>
          <div className="flex flex-wrap gap-2">{Object.entries(MUSCULOS).map(([k, v]) => <Chip key={k} foco={foco} activo={nuevo.primary_muscle === k} onClick={() => setNuevo({ ...nuevo, primary_muscle: k })}>{v}</Chip>)}</div>
          <Etiqueta className={sec}>Máquina o material</Etiqueta>
          <div className="flex flex-wrap gap-2">{Object.entries(EQUIPOS).map(([k, v]) => <Chip key={k} foco={foco} activo={nuevo.equipment === k} onClick={() => setNuevo({ ...nuevo, equipment: k })}>{v}</Chip>)}</div>
          {err ? <p className="text-peligro">{err}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Boton data-testid="nuevo-ej-guardar" icono="check" disabled={!nuevo.name.trim() || guardando} onClick={async () => {
              if (!onCrear) return;
              setGuardando(true); setErr(null);
              try { const x = await onCrear({ ...nuevo, name: nuevo.name.trim() }); setNuevo(null); onElegir(x); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGuardando(false); }
            }}>{guardando ? "Creando…" : "Crear y usar"}</Boton>
            <Boton tipo={foco ? "foco" : "secundario"} onClick={() => setNuevo(null)}>Volver</Boton>
          </div>
        </div>
      ) : (
        <div className="space-y-3 pb-2">
          <div className="sticky top-0 z-10 space-y-2 pb-1" style={{ background: "inherit" }}>
            <label className={cx("flex min-h-12 items-center gap-2 rounded-[14px] border px-4", foco ? "border-foco-linea bg-foco-tarjeta" : "border-linea bg-superficie2")}>
              <Icono n="search" size={18} className={sec} />
              <input data-testid="buscar-ejercicio" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar: nombre, músculo, máquina…" aria-label="Buscar ejercicio"
                className={cx("min-w-0 flex-1 bg-transparent text-base outline-none", foco ? "text-foco-texto placeholder:text-foco-sec" : "text-tinta placeholder:text-tinta3")} />
            </label>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              <Chip foco={foco} activo={musc === null} onClick={() => setMusc(null)} className="shrink-0">Todos</Chip>
              {Object.entries(MUSCULOS).filter(([k]) => k !== "otro").map(([k, v]) => <Chip key={k} foco={foco} activo={musc === k} onClick={() => setMusc(musc === k ? null : k)} className="shrink-0">{v}</Chip>)}
            </div>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {Object.entries(EQUIPOS).filter(([k]) => k !== "otro").map(([k, v]) => <Chip key={k} foco={foco} activo={equipo === k} onClick={() => setEquipo(equipo === k ? null : k)} className="shrink-0 !min-h-9 !text-sm">{v}</Chip>)}
            </div>
          </div>
          {onCrear ? (
            <button type="button" data-testid="crear-ejercicio" onClick={() => setNuevo({ name: q, primary_muscle: musc || "pecho", equipment: equipo || "maquina" })}
              className={cx("flex min-h-14 w-full items-center gap-3 rounded-[14px] px-4 text-left font-semibold", foco ? "bg-[#1c2740] text-foco-acento" : "bg-acento-suave text-acento-tinta")}>
              <Icono n="plus" /> Crear ejercicio personalizado{q ? ` «${q}»` : ""}
            </button>
          ) : null}
          <ul className="grid gap-2 md:grid-cols-2">
            {filas.map(({ x, sug: esSug }) => (
              <li key={x.id}>
                <button type="button" data-testid={`ej-${x.slug}`} onClick={() => onElegir(x)}
                  className={cx("salud-anim flex min-h-16 w-full items-center gap-3 rounded-[14px] border px-3 py-2 text-left", foco ? "border-foco-linea bg-foco-tarjeta hover:bg-[#1c2740]" : "border-linea bg-superficie hover:bg-superficie2")}>
                  <Mini e={x} foco={foco} className="h-12 w-7 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{x.name}{esSug ? <span className={cx("ml-2 rounded-full px-2 py-0.5 text-xs font-bold", foco ? "bg-foco-acento/20 text-foco-acento" : "bg-acento-suave text-acento-tinta")}>sugerido</span> : null}</span>
                    <span className={cx("block text-sm", sec)}>{MUSCULOS[x.primary_muscle] || x.primary_muscle} · {EQUIPOS[x.equipment] || x.equipment}{x.user_id ? " · tuyo" : ""}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {!filas.length ? <p className={cx("py-6 text-center", sec)}>Nada con «{q}». Puedes crearlo arriba.</p> : null}
        </div>
      )}
    </Hoja>
  );
}

// ---------------------------------------------------------------- marco de las páginas de Salud

const SECCIONES = [
  { href: "/salud", t: "Inicio", i: "home" },
  { href: "/salud/rutinas", t: "Rutinas", i: "list" },
  { href: "/salud/historial", t: "Progreso", i: "trending-up" },
  { href: "/salud/ejercicios", t: "Ejercicios", i: "activity" },
  { href: "/salud/biblioteca", t: "Biblioteca", i: "book" },
];
/** Cabecera de la web + submenú de Salud + avisos de red/guardado. `accion` = botón de la derecha (p. ej. ajustes). */
export function Marco({ titulo, subtitulo, accion, children }: { titulo: string; subtitulo?: ReactNode; accion?: ReactNode; children: ReactNode }) {
  const ruta = usePathname();
  const { sinRed, cola, noGuardados, error } = useGym();
  return (
    <SiteShell active="salud" bleed>
      <div className="salud min-h-full bg-lienzo text-tinta">
        <div className="border-b border-linea bg-superficie">
          <nav aria-label="Salud" className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto [scrollbar-width:none] px-4 py-2 md:px-8">
            {SECCIONES.map((s) => {
              const activo = s.href === "/salud" ? ruta === "/salud" : ruta?.startsWith(s.href);
              return (
                <Link key={s.href} href={s.href} aria-current={activo ? "page" : undefined}
                  className={cx("salud-anim inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-semibold",
                    activo ? "bg-acento-suave text-acento-tinta" : "text-tinta2 hover:bg-superficie2 hover:text-tinta")}>
                  <Icono n={s.i} size={18} />{s.t}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-8 md:pt-8">
          <header className="mb-5 flex flex-wrap items-end gap-3 md:mb-7">
            <div className="min-w-0 flex-1">
              <h1 className="text-[28px] font-extrabold leading-tight tracking-tight md:text-[34px]">{titulo}</h1>
              {subtitulo ? <div className="mt-1 text-[15px] text-tinta2">{subtitulo}</div> : null}
            </div>
            {accion}
          </header>
          {sinRed || cola.length ? (
            <p role="status" className="mb-4 flex items-center gap-2 rounded-[14px] bg-aviso-suave px-4 py-3 text-sm font-medium text-aviso-tinta">
              <Icono n="alert" size={18} />{sinRed ? "Sin conexión: lo que hagas se guarda en este navegador y se sube al volver la red." : `Guardando ${cola.length} cambio${cola.length > 1 ? "s" : ""}…`}
            </p>
          ) : null}
          {error ? <p role="alert" className="mb-4 rounded-[14px] bg-peligro-suave px-4 py-3 text-sm font-medium text-peligro-tinta">{error}</p> : null}
          {noGuardados.length ? (
            <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-[14px] bg-peligro-suave px-4 py-3 text-sm text-peligro-tinta">
              <span className="flex-1"><b>{noGuardados.length} cambio{noGuardados.length > 1 ? "s" : ""} no guardado{noGuardados.length > 1 ? "s" : ""}</b> (siguen en este navegador): {noGuardados[noGuardados.length - 1].motivo}</span>
              <Boton tipo="secundario" icono="rotate-ccw" onClick={reintentarNoGuardados}>Reintentar</Boton>
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </SiteShell>
  );
}

export function Cargando({ texto = "Cargando…" }: { texto?: string }) {
  return <div className="grid min-h-[40vh] place-items-center text-tinta2" role="status"><span className="flex items-center gap-3"><span className="h-5 w-5 animate-spin rounded-full border-2 border-acento border-t-transparent" />{texto}</span></div>;
}
export function Vacio({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <Tarjeta className="py-8 text-center">
      <p className="text-lg font-bold">{titulo}</p>
      {children ? <div className="mx-auto mt-1 max-w-md text-tinta2">{children}</div> : null}
      {accion ? <div className="mt-4 flex flex-wrap justify-center gap-2">{accion}</div> : null}
    </Tarjeta>
  );
}

/** Salud exige sesión, como /agenda: sin usuario se va a /login. */
export function Guardia({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();
  useEffect(() => { if (!loading && !user) window.location.href = "/login"; }, [loading, user]);
  if (loading || !user) return <div className="salud min-h-screen bg-lienzo"><Cargando texto="Comprobando tu sesión…" /></div>;
  return <>{children}</>;
}
