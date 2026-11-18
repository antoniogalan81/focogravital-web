"use client";
// SALUD · GYM · historial y progreso. SÓLO datos reales (gym_session + gym_set) a través del motor (progreso, analisis,
// pechoSemana): sin sesiones o series se dice; nunca se rellena. El 1RM siempre se rotula como «estimado».
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as D from "@/src/salud/gym/datos.js";
import * as M from "@/src/salud/gym/motor.js";
import { Barras, Linea, Musculos, type Punto } from "@/src/salud/Graficas";
import { useGym, vigilar, type Datos, type Sesion } from "@/src/salud/store";
import { Cargando, cx, diaCorto, Etiqueta, Icono, kg, Marco, MUSCULOS, num, Segmento, Tarjeta, Vacio } from "@/src/salud/ui";

const DIA = 86_400_000;
const PERIODOS = [{ v: 28, t: "4 semanas" }, { v: 92, t: "3 meses" }, { v: 366, t: "1 año" }, { v: 3650, t: "Todo" }];
const ESTADO: Record<string, { t: string; c: string }> = {
  completada: { t: "Completa", c: "bg-ok-suave text-ok-tinta" }, parcial: { t: "Parcial", c: "bg-aviso-suave text-aviso-tinta" },
  cancelada: { t: "Abandonada", c: "bg-superficie2 text-tinta2" }, activa: { t: "En curso", c: "bg-acento-suave text-acento-tinta" }, pausada: { t: "En pausa", c: "bg-acento-suave text-acento-tinta" },
};
type Ej = { exercise_id: string; nombre: string; musculo: string; series: number; sesiones: number; historial: { dia: string; peso_max: number; reps_max: number; e1rm: number; volumen: number; series: number }[];
  record_peso: { kg: number; dia: string } | null; record_e1rm: { kg: number; dia: string } | null; ultimo: { peso: number | null; reps: number } | null; mejora_e1rm: number | null };
type Prog = { ejercicios: Ej[]; semanas: { semana: string; volumen: number; series: number; sesiones: number }[]; total_series: number };

export default function HistorialPage() {
  return <Suspense fallback={<Marco titulo="Historial y progreso"><Cargando /></Marco>}><Historial /></Suspense>;
}

function Historial() {
  const q = useSearchParams();
  const { datos } = useGym();
  useEffect(() => vigilar(), []);
  const [tab, setTab] = useState<string>(q.get("vista") === "sesiones" ? "sesiones" : "progreso");
  const [dias, setDias] = useState(92);
  const [ahora] = useState(() => Date.now());
  const desde = ahora - dias * DIA;
  const prog = useMemo(() => (datos ? (M.progreso(datos.sets.filter((s) => datos.sesiones.some((x) => x.id === s.session_id && x.status !== "cancelada")), datos.ej, { desde }) as Prog) : null), [datos, desde]);
  const an = useMemo(() => (datos ? M.analisis({ ...datos }, { dias, ahora }) : null), [datos, dias, ahora]);
  if (!datos || !prog || !an) return <Marco titulo="Historial y progreso"><Cargando /></Marco>;
  return (
    <Marco titulo="Historial y progreso" subtitulo="Sólo lo que has entrenado de verdad: nada se rellena.">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmento etiqueta="Vista" valor={tab} onCambio={setTab} testid="h-vista" opciones={[{ v: "progreso", t: "Progreso" }, { v: "sesiones", t: "Sesiones" }, { v: "pecho", t: "Pecho semanal" }]} />
        <Segmento etiqueta="Periodo" valor={dias} onCambio={setDias} testid="h-periodo" opciones={PERIODOS} />
      </div>
      {tab === "progreso" ? <Progreso prog={prog} an={an} /> : null}
      {tab === "sesiones" ? <Sesiones datos={datos} desde={desde} /> : null}
      {tab === "pecho" ? <PechoSemanas an={an} datos={datos} /> : null}
    </Marco>
  );
}

function Cifra({ v, t, testid }: { v: string | number; t: string; testid?: string }) {
  return <Tarjeta className="!p-4"><p className="text-[28px] font-extrabold tabular-nums leading-none" data-testid={testid}>{v}</p><p className="mt-1 text-sm text-tinta2">{t}</p></Tarjeta>;
}

type An = { resumen: { sesiones: number; completas: number; parciales: number; abandonadas: number; por_semana: number; series: number; minutos_medios: number | null };
  musculos: { musculo: string; por_semana: number; nivel: string }[]; menos_trabajados: string[]; estancados: string[]; pecho_semanas: { semana: string; cumplido: boolean; series: number }[]; notas: string[] };

function Progreso({ prog, an: an0 }: { prog: Prog; an: unknown }) {
  const an = an0 as An;
  const [ejSel, setEjSel] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<"e1rm" | "peso_max" | "reps_max" | "volumen">("e1rm");
  const r = an.resumen;
  if (!prog.ejercicios.length) return <Vacio titulo="Aún no hay series en este periodo">El progreso aparece en cuanto registres series. Nada se inventa.</Vacio>;
  const sel = prog.ejercicios.find((e) => e.exercise_id === ejSel) ?? prog.ejercicios[0];
  const METRICAS = { e1rm: { t: "1RM estimado", u: "kg" }, peso_max: { t: "Peso máximo", u: "kg" }, reps_max: { t: "Repeticiones máximas", u: "reps" }, volumen: { t: "Carga total (kg × reps)", u: "kg" } };
  const conPeso = sel.historial.some((d) => d.peso_max > 0);
  const met = !conPeso && (metrica === "e1rm" || metrica === "peso_max" || metrica === "volumen") ? "reps_max" : metrica;
  const puntos: Punto[] = sel.historial.map((d) => ({ k: diaCorto(d.dia), v: d[met], detalle: `${num(d.peso_max || null)} kg × ${d.reps_max}` }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Cifra v={r.sesiones} t={`entrenamiento${r.sesiones === 1 ? "" : "s"} (${r.completas} complet${r.completas === 1 ? "o" : "os"}, ${r.parciales} parcial${r.parciales === 1 ? "" : "es"})`} testid="p-sesiones" />
        <Cifra v={String(r.por_semana).replace(".", ",")} t="por semana" />
        <Cifra v={prog.total_series} t="series hechas" />
        <Cifra v={r.minutos_medios ?? "—"} t="minutos de media" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Tarjeta>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Ejercicio</span>
              <select value={sel.exercise_id} onChange={(e) => setEjSel(e.target.value)} data-testid="p-ejercicio"
                className="min-h-11 w-full rounded-[12px] border border-linea bg-superficie2 px-3 font-semibold outline-none focus:border-acento">
                {prog.ejercicios.map((e) => <option key={e.exercise_id} value={e.exercise_id}>{e.nombre} · {e.series} series</option>)}
              </select>
            </label>
          </div>
          <div className="mb-3"><Segmento lleno etiqueta="Medida" valor={met} onCambio={setMetrica} testid="p-metrica"
            opciones={(conPeso ? ["e1rm", "peso_max", "reps_max", "volumen"] as const : ["reps_max"] as const).map((k) => ({ v: k, t: k === "e1rm" ? "1RM estimado" : k === "peso_max" ? "Peso" : k === "reps_max" ? "Reps" : "Carga" }))} /></div>
          <Linea puntos={puntos} titulo={`${sel.nombre} · ${METRICAS[met].t} por día`} unidad={METRICAS[met].u} />
          <p className="mt-2 text-sm text-tinta2">
            Récord de peso: {sel.record_peso ? `${kg(sel.record_peso.kg)} (${diaCorto(sel.record_peso.dia)})` : "sin peso anotado"} · 1RM estimado máximo: {sel.record_e1rm ? kg(sel.record_e1rm.kg) : "—"}
            {sel.mejora_e1rm !== null ? <> · cambio del 1RM estimado: <b className={sel.mejora_e1rm >= 0 ? "text-ok-tinta" : "text-peligro-tinta"}>{sel.mejora_e1rm >= 0 ? "+" : ""}{num(sel.mejora_e1rm)} kg</b></> : " · un solo día: aún sin tendencia"}
          </p>
        </Tarjeta>
        <Tarjeta>
          <Etiqueta className="mb-2">Ejercicios del periodo</Etiqueta>
          <ul className="max-h-[420px] space-y-1 overflow-y-auto">
            {prog.ejercicios.map((e) => (
              <li key={e.exercise_id}>
                <button type="button" onClick={() => setEjSel(e.exercise_id)} className={cx("flex w-full items-center gap-2 rounded-[12px] px-3 py-2 text-left", e.exercise_id === sel.exercise_id ? "bg-acento-suave" : "hover:bg-superficie2")}>
                  <span className="min-w-0 flex-1"><span className="block font-semibold leading-snug">{e.nombre}</span><span className="block text-sm text-tinta2">{MUSCULOS[e.musculo] ?? e.musculo} · {e.sesiones} {e.sesiones === 1 ? "sesión" : "sesiones"} · último {e.ultimo ? `${num(e.ultimo.peso)}×${e.ultimo.reps}` : "—"}</span></span>
                  {e.mejora_e1rm !== null ? <span className={cx("text-sm font-bold tabular-nums", e.mejora_e1rm >= 0 ? "text-ok-tinta" : "text-peligro-tinta")}>{e.mejora_e1rm >= 0 ? "+" : ""}{num(e.mejora_e1rm)}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta><Barras titulo="Carga por semana (kg × reps)" unidad="kg" puntos={prog.semanas.map((w) => ({ k: diaCorto(w.semana), v: w.volumen, detalle: `${w.series} series · ${w.sesiones} ${w.sesiones === 1 ? "sesión" : "sesiones"}` }))} /></Tarjeta>
        <Tarjeta><Barras titulo="Entrenamientos por semana" unidad="ses." puntos={prog.semanas.map((w) => ({ k: diaCorto(w.semana), v: w.sesiones, detalle: `${w.series} series` }))} /></Tarjeta>
      </div>
      <Tarjeta>
        <Etiqueta className="mb-2">Músculos · del menos al más trabajado</Etiqueta>
        <Musculos referencia={M.REFERENCIA_SERIES} filas={an.musculos.map((m) => ({ ...m, nombre: MUSCULOS[m.musculo] ?? m.musculo }))} />
        {an.menos_trabajados.length ? <p className="mt-3 text-sm text-aviso-tinta">Por debajo de la referencia: {an.menos_trabajados.map((m) => MUSCULOS[m] ?? m).join(", ")}.</p> : null}
        {an.estancados.length ? <p className="mt-1 text-sm text-tinta2">Sin mejora del 1RM estimado en 3 o más sesiones: {an.estancados.join(", ")}.</p> : null}
      </Tarjeta>
      <ul className="space-y-1 text-sm text-tinta2">{an.notas.map((n) => <li key={n}>· {n}</li>)}</ul>
    </div>
  );
}

function Sesiones({ datos, desde }: { datos: Datos; desde: number }) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const sesiones = datos.sesiones.filter((x) => Date.parse(x.started_at) >= desde);
  const dur = (x: Sesion) => (x.ended_at ? Math.round((Date.parse(x.ended_at) - Date.parse(x.started_at)) / 60000 - x.paused_seconds / 60) : null);
  if (!sesiones.length) return <Vacio titulo="No hay entrenamientos en este periodo" />;
  return (
    <ul className="grid gap-3 lg:grid-cols-2" data-testid="h-sesiones">
      {sesiones.map((x) => {
        const r = M.resultadoSesion(x.plan, D.hechasDe(datos.sets, x.id), datos.ajustes);
        const e = ESTADO[x.status] ?? { t: x.status, c: "" };
        const its = M.itemsDe(x.plan?.blocks ?? []) as { id: string; exercise_id: string; status?: string; from_exercise_id?: string }[];
        const mama = x.updated_by === "mama" || (x.changes || []).some((c) => c.by === "mama") || datos.sets.some((s) => s.session_id === x.id && s.source === "mama");
        const etiquetas = [x.mode === "superseries" ? "superseries" : null, x.adapted ? "adaptada" : null, x.chest_adaptation ? "con pecho añadido" : null,
          x.advances ? "avanzó la rotación" : x.status === "parcial" ? "no avanzó la rotación" : null].filter(Boolean);
        return (
          <li key={x.id}>
            <Tarjeta className="h-full" data-testid={`h-sesion-${x.status}`}>
              <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setAbierta(abierta === x.id ? null : x.id)} aria-expanded={abierta === x.id}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-bold leading-snug">{x.routine_name}</span>
                  <span className="block text-sm text-tinta2">{new Date(x.started_at).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{dur(x) !== null ? ` · ${dur(x)} min` : ""} · {r.hechas}/{r.previstas} series</span>
                  {etiquetas.length ? <span className="block text-sm text-tinta2">{etiquetas.join(" · ")}</span> : null}
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className={cx("rounded-full px-2.5 py-0.5 text-xs font-bold", e.c)}>{e.t}</span>
                  {mama ? <span className="rounded-full bg-mama-suave px-2.5 py-0.5 text-xs font-bold text-mama-tinta">MAMA</span> : null}
                </span>
                <Icono n={abierta === x.id ? "chevron-up" : "chevron-down"} className="mt-1 text-tinta2" />
              </button>
              {abierta === x.id ? (
                <div className="mt-3 space-y-2 border-t border-linea pt-3">
                  {its.map((it) => {
                    const ss = datos.sets.filter((z) => z.session_id === x.id && z.item_id === it.id).sort((a, b) => a.set_index - b.set_index);
                    return (
                      <div key={it.id}>
                        <p className={cx("font-semibold", it.status === "omitido" && "text-tinta2 line-through")}>{datos.ej[it.exercise_id]?.name}{it.from_exercise_id ? <span className="font-normal text-tinta2"> (por {datos.ej[it.from_exercise_id]?.name})</span> : null}</p>
                        <p className="flex flex-wrap gap-1 text-sm tabular-nums">{ss.length ? ss.map((z) => <span key={z.id} className={cx("rounded-full px-2 py-0.5", z.source === "mama" ? "bg-mama-suave text-mama-tinta" : "bg-superficie2")}>{z.source === "mama" ? "MAMA " : ""}{num(z.weight)}×{z.reps}</span>) : <span className="text-tinta2">{it.status === "omitido" ? "omitido" : "sin series"}</span>}</p>
                      </div>
                    );
                  })}
                  {(x.changes || []).length ? (
                    <ul className="mt-2 space-y-1 text-sm">{x.changes.map((c, i) => <li key={i} className={c.by === "mama" ? "text-mama-tinta" : "text-tinta2"}><b>{c.by === "mama" ? "MAMA" : "Tú"}:</b> {c.cambio}</li>)}</ul>
                  ) : null}
                </div>
              ) : null}
            </Tarjeta>
          </li>
        );
      })}
    </ul>
  );
}

function PechoSemanas({ an: an0, datos }: { an: unknown; datos: Datos }) {
  const an = an0 as An;
  const lunesHoy = M.lunesDe(M.diaMadrid()) as string;
  const semanas = [...an.pecho_semanas].reverse();
  return (
    <div className="space-y-3">
      <p className="text-tinta2">Semana de lunes a domingo. Cuenta {M.criterioPecho(datos.ajustes)}; lo programado no cuenta.</p>
      <Tarjeta><Barras titulo="Series de pecho hechas por semana" unidad="series" puntos={an.pecho_semanas.map((w) => ({ k: diaCorto(w.semana), v: w.series, detalle: w.cumplido ? "cumplido" : "no cumplido" }))} /></Tarjeta>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {semanas.map((w) => {
          const actual = w.semana === lunesHoy;
          return (
            <li key={w.semana} data-testid={`pecho-${w.semana}`} className="flex items-center gap-3 rounded-[14px] border border-linea bg-superficie px-4 py-3">
              <span className={cx("grid h-9 w-9 place-items-center rounded-full text-white", w.cumplido ? "bg-ok" : actual ? "bg-aviso" : "bg-tinta3")}><Icono n={w.cumplido ? "check" : actual ? "clock" : "x"} size={18} /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">Semana del {diaCorto(w.semana)}</span>
                <span className="block text-sm text-tinta2">{w.cumplido ? "Cumplido" : actual ? "Pendiente" : "No cumplido"} · {w.series} series de pecho</span></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
