"use client";
// SALUD · GYM · catálogo visual de ejercicios: búsqueda (motor `buscar`), filtros por músculo y material, ficha con la
// figura de frente y de espalda, material, alternativas, ejecución (campo description, una línea por paso) y el historial
// de carga real de ese ejercicio.
import { useEffect, useMemo, useState } from "react";
import * as D from "@/src/salud/gym/datos.js";
import * as M from "@/src/salud/gym/motor.js";
import { Linea } from "@/src/salud/Graficas";
import { conDatos, useGym, vigilar, type Datos, type Ejercicio } from "@/src/salud/store";
import { Boton, Cargando, Chip, cx, diaCorto, EQUIPOS, Etiqueta, Figura, Hoja, Icono, Marco, Mini, MUSCULOS, num, Vacio } from "@/src/salud/ui";

const TIPO: Record<string, string> = { compuesto: "Multiarticular", aislamiento: "Aislamiento" };

export default function EjerciciosPage() {
  const { datos } = useGym();
  useEffect(() => vigilar(), []);
  const [q, setQ] = useState("");
  const [musc, setMusc] = useState<string | null>(null);
  const [equipo, setEquipo] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);
  const lista = useMemo(() => (datos ? (M.buscar(datos.ej, q, { musculo: musc, max: 500 }) as Ejercicio[]).filter((x) => !equipo || x.equipment === equipo) : []), [datos, q, musc, equipo]);
  if (!datos) return <Marco titulo="Ejercicios"><Cargando /></Marco>;
  const e = abierto ? datos.ej[abierto] : null;
  return (
    <Marco titulo="Ejercicios" subtitulo={`${Object.values(datos.ej).filter((x) => !x.archived_at).length} ejercicios: el catálogo común y los tuyos.`}
      accion={<Boton tipo="secundario" icono="plus" onClick={() => setNuevo(true)} data-testid="ej-nuevo">Ejercicio propio</Boton>}>
      <div className="mb-4 space-y-2">
        <label className="flex min-h-12 items-center gap-2 rounded-[14px] border border-linea bg-superficie px-4 focus-within:border-acento">
          <Icono n="search" size={18} className="text-tinta2" />
          <input value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Buscar: nombre, músculo, máquina…" aria-label="Buscar ejercicio" data-testid="cat-buscar"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-tinta3" />
        </label>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] md:flex-wrap md:overflow-visible">
          <Chip activo={musc === null} onClick={() => setMusc(null)} className="shrink-0">Todos</Chip>
          {Object.entries(MUSCULOS).filter(([k]) => k !== "otro").map(([k, v]) => <Chip key={k} activo={musc === k} onClick={() => setMusc(musc === k ? null : k)} className="shrink-0" data-testid={`cat-m-${k}`}>{v}</Chip>)}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] md:flex-wrap md:overflow-visible">
          {Object.entries(EQUIPOS).filter(([k]) => k !== "otro").map(([k, v]) => <Chip key={k} activo={equipo === k} onClick={() => setEquipo(equipo === k ? null : k)} className="shrink-0 !min-h-9 !text-sm" data-testid={`cat-e-${k}`}>{v}</Chip>)}
        </div>
      </div>
      {!lista.length ? <Vacio titulo={`Nada con «${q}»`}>Prueba otra palabra o crea tu propio ejercicio.</Vacio> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="catalogo">
        {lista.map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => setAbierto(x.id)} data-testid={`cat-${x.slug}`}
              className="salud-anim flex h-full w-full flex-col items-center gap-2 rounded-[20px] border border-linea bg-superficie p-3 text-center hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(16,24,40,0.25)]">
              <Mini e={x} className="h-28 w-14" />
              <span className="text-[15px] font-semibold leading-snug">{x.name}</span>
              <span className="text-xs text-tinta2">{MUSCULOS[x.primary_muscle] ?? x.primary_muscle} · {EQUIPOS[x.equipment] ?? x.equipment}{x.user_id ? " · tuyo" : ""}</span>
            </button>
          </li>
        ))}
      </ul>
      <Hoja abierta={!!e} onCerrar={() => setAbierto(null)} titulo={e?.name ?? ""} ancha testid="ficha">
        {e ? <Ficha e={e} datos={datos} onAbrir={setAbierto} /> : null}
      </Hoja>
      <NuevoEjercicio abierta={nuevo} onCerrar={() => setNuevo(false)} onCreado={(x) => { setNuevo(false); setAbierto(x.id); }} />
    </Marco>
  );
}

function Ficha({ e, datos, onAbrir }: { e: Ejercicio; datos: Datos; onAbrir: (id: string) => void }) {
  const alts = M.alternativas(e.id, datos.ej, { max: 6 }) as Ejercicio[];
  const pasos = String(e.description ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const prog = useMemo(() => (M.progreso(datos.sets.filter((s) => s.exercise_id === e.id), datos.ej) as { ejercicios: { historial: { dia: string; peso_max: number; reps_max: number; e1rm: number }[]; record_peso: { kg: number } | null }[] }).ejercicios[0], [datos, e.id]);
  const ult = M.ultimosDe(datos.sets, e.id) as { ultima: { peso: number | null; reps: number }[]; dia: string | null };
  const conPeso = prog?.historial.some((d) => d.peso_max > 0);
  return (
    <div className="space-y-5 pb-2">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 sm:gap-6">
        <div className="flex gap-2">
          <figure className="text-center"><Figura principal={e.primary_muscle} secundarios={e.secondary_muscles} vista="frente" className="h-44 w-22 sm:h-56 sm:w-28" /><figcaption className="text-xs text-tinta2">Frente</figcaption></figure>
          <figure className="text-center"><Figura principal={e.primary_muscle} secundarios={e.secondary_muscles} vista="espalda" className="h-44 w-22 sm:h-56 sm:w-28" /><figcaption className="text-xs text-tinta2">Espalda</figcaption></figure>
        </div>
        <dl className="space-y-2 text-[15px]">
          <div><dt className="text-xs font-bold uppercase tracking-[0.05em] text-tinta2">Músculo principal</dt><dd className="font-semibold"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-acento" />{MUSCULOS[e.primary_muscle] ?? e.primary_muscle}</dd></div>
          {e.secondary_muscles?.length ? <div><dt className="text-xs font-bold uppercase tracking-[0.05em] text-tinta2">También trabaja</dt><dd><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-acento/30" />{e.secondary_muscles.map((m) => MUSCULOS[m] ?? m).join(", ")}</dd></div> : null}
          <div><dt className="text-xs font-bold uppercase tracking-[0.05em] text-tinta2">Material</dt><dd>{EQUIPOS[e.equipment] ?? e.equipment}</dd></div>
          <div><dt className="text-xs font-bold uppercase tracking-[0.05em] text-tinta2">Tipo</dt><dd>{TIPO[e.kind] ?? e.kind}{e.default_rest ? ` · descanso habitual ${e.default_rest} s` : ""}</dd></div>
          {e.user_id ? <dd className="inline-flex rounded-full bg-acento-suave px-2.5 py-0.5 text-xs font-bold text-acento-tinta">Ejercicio tuyo</dd> : null}
        </dl>
      </div>
      <section>
        <Etiqueta className="mb-2">Cómo se hace</Etiqueta>
        {pasos.length ? <ol className="list-decimal space-y-1.5 pl-5 text-[15px] leading-relaxed" data-testid="ficha-pasos">{pasos.map((p, i) => <li key={i}>{p}</li>)}</ol>
          : <p className="text-tinta2" data-testid="ficha-sin-pasos">Aún no hay instrucciones para este ejercicio.</p>}
      </section>
      <section>
        <Etiqueta className="mb-2">Tu historial</Etiqueta>
        {prog ? (
          <>
            <p className="mb-2 text-sm text-tinta2">Última vez ({ult.dia ? diaCorto(ult.dia) : "—"}): <span className="tabular-nums text-tinta">{ult.ultima.map((x) => `${num(x.peso)}×${x.reps}`).join(" · ")}</span>{prog.record_peso ? ` · récord ${num(prog.record_peso.kg)} kg` : ""}</p>
            <Linea titulo={conPeso ? "1RM estimado por día" : "Repeticiones máximas por día"} unidad={conPeso ? "kg" : "reps"}
              puntos={prog.historial.map((d) => ({ k: diaCorto(d.dia), v: conPeso ? d.e1rm : d.reps_max, detalle: `${num(d.peso_max || null)} kg × ${d.reps_max}` }))} />
          </>
        ) : <p className="text-tinta2" data-testid="ficha-sin-historial">Todavía no lo has hecho: aquí verás tu carga cuando registres series.</p>}
      </section>
      {alts.length ? (
        <section>
          <Etiqueta className="mb-2">Alternativas (si la máquina está ocupada)</Etiqueta>
          <ul className="grid gap-2 sm:grid-cols-2">
            {alts.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onAbrir(a.id)} className="flex min-h-14 w-full items-center gap-3 rounded-[14px] border border-linea px-3 py-2 text-left hover:bg-superficie2">
                  <Mini e={a} className="h-12 w-7 shrink-0" />
                  <span className="min-w-0 flex-1"><span className="block font-semibold leading-snug">{a.name}</span><span className="block text-sm text-tinta2">{EQUIPOS[a.equipment] ?? a.equipment}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function NuevoEjercicio({ abierta, onCerrar, onCreado }: { abierta: boolean; onCerrar: () => void; onCreado: (x: Ejercicio) => void }) {
  const [f, setF] = useState({ name: "", primary_muscle: "pecho", equipment: "maquina", description: "" });
  const [err, setErr] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Ejercicio propio" testid="hoja-nuevo-ej">
      <div className="space-y-4 pb-2">
        <label className="block"><span className="mb-1 block text-sm text-tinta2">Nombre</span>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="nej-nombre" className="min-h-12 w-full rounded-[14px] border border-linea bg-superficie2 px-4 outline-none focus:border-acento" /></label>
        <Etiqueta>Músculo principal</Etiqueta>
        <div className="flex flex-wrap gap-2">{Object.entries(MUSCULOS).map(([k, v]) => <Chip key={k} activo={f.primary_muscle === k} onClick={() => setF({ ...f, primary_muscle: k })}>{v}</Chip>)}</div>
        <Etiqueta>Material</Etiqueta>
        <div className="flex flex-wrap gap-2">{Object.entries(EQUIPOS).map(([k, v]) => <Chip key={k} activo={f.equipment === k} onClick={() => setF({ ...f, equipment: k })}>{v}</Chip>)}</div>
        <label className="block"><span className="mb-1 block text-sm text-tinta2">Cómo se hace (opcional, un paso por línea)</span>
          <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={4} className="w-full rounded-[14px] border border-linea bg-superficie2 px-4 py-3 outline-none focus:border-acento" /></label>
        {err ? <p role="alert" className="text-peligro-tinta">{err}</p> : null}
        <Boton className={cx("w-full")} icono="check" disabled={!f.name.trim() || guardando} data-testid="nej-guardar" onClick={async () => {
          setGuardando(true); setErr(null);
          try {
            const x = await conDatos<Ejercicio>((sb, _d, ctx) => D.crearEjercicio(sb, { ...f, name: f.name.trim(), description: f.description.trim().slice(0, 2000) || null }, ctx));
            setF({ name: "", primary_muscle: "pecho", equipment: "maquina", description: "" });
            onCreado(x);
          } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGuardando(false); }
        }}>{guardando ? "Creando…" : "Crear ejercicio"}</Boton>
      </div>
    </Hoja>
  );
}
