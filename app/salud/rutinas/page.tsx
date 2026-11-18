"use client";
// SALUD · GYM · rutinas: orden de rotación (sin días fijos), crear/editar, duplicar, archivar, eliminar (recuperable) y
// recuperar. Editar una rutina NO toca las sesiones ya hechas. El editor usa las operaciones del motor (aplicarOp).
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as D from "@/src/salud/gym/datos.js";
import * as M from "@/src/salud/gym/motor.js";
import { conDatos, get as estadoGym, useGym, vigilar, type Bloque, type Ejercicio, type Item, type Rutina } from "@/src/salud/store";
import { Boton, Cargando, Chip, cx, Etiqueta, Icono, Marco, Mini, MUSCULOS, Paso, SelectorEjercicio, Tarjeta, Vacio } from "@/src/salud/ui";

const PRIORIDAD = { 1: "Principal", 2: "Normal", 3: "Accesorio" } as const;
const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function RutinasPage() {
  return <Suspense fallback={<Marco titulo="Rutinas"><Cargando /></Marco>}><Rutinas /></Suspense>;
}

function Rutinas() {
  const q = useSearchParams();
  const router = useRouter();
  const { datos } = useGym();
  useEffect(() => vigilar(), []);
  const id = q.get("id"), nueva = q.get("nueva");
  if (!datos) return <Marco titulo="Rutinas"><Cargando /></Marco>;
  if (id || nueva) {
    const r = id ? datos.rutinas.find((x) => x.id === id) ?? null : null;
    return <Editor key={id || "nueva"} rutina={r} onSalir={() => router.push("/salud/rutinas")} />;
  }
  return <Lista />;
}

function Lista() {
  const { datos } = useGym();
  const [borradas, setBorradas] = useState<{ id: string; name: string; deleted_at: string }[]>([]);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const nRutinas = datos?.rutinas.length ?? 0;
  useEffect(() => { void conDatos<{ id: string; name: string; deleted_at: string }[]>((sb) => D.borradas(sb)).then((x) => setBorradas(x)).catch(() => {}); }, [nRutinas]);
  if (!datos) return null;
  const orden = M.rotacion(datos.ajustes, datos.rutinas) as string[];
  const sig = M.siguiente({ ...datos });
  const archivadas = datos.rutinas.filter((r) => r.archived_at);
  const hacer = async (f: () => Promise<unknown>, t: string) => { try { await f(); setMsg({ t, ok: true }); } catch (e) { setMsg({ t: err(e), ok: false }); } };
  const mover = (i: number, d: number) => {
    const o = [...orden]; const j = i + d; if (j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]];
    void hacer(() => conDatos((sb, _d, ctx) => D.guardarAjustes(sb, { rotation: o }, ctx)), "Orden de rotación guardado");
  };
  return (
    <Marco titulo="Rutinas" subtitulo="La rotación sigue este orden, sin días fijos: al terminar una rutina queda preparada la siguiente."
      accion={<Link href="/salud/rutinas?nueva=1" data-testid="rutina-nueva" className="inline-flex min-h-12 items-center gap-2 rounded-[14px] bg-acento px-5 font-semibold text-white hover:bg-acento-tinta"><Icono n="plus" />Nueva rutina</Link>}>
      {msg ? <p role="status" data-testid="rutinas-msg" className={cx("mb-4 rounded-[14px] px-4 py-3 text-sm font-medium", msg.ok ? "bg-ok-suave text-ok-tinta" : "bg-peligro-suave text-peligro-tinta")}>{msg.t}</p> : null}
      {!orden.length ? <Vacio titulo="Aún no tienes rutinas">Crea la primera o vuelve a GYM para crear la rotación A·B·C·D.</Vacio> : null}
      <ol className="grid gap-3 lg:grid-cols-2">
        {orden.map((rid, i) => {
          const r = datos.rutinas.find((x) => x.id === rid)!;
          const bs = M.normalizar(r.blocks) as Bloque[];
          const its = M.itemsDe(bs) as Item[];
          const musc = [...new Set(its.map((it) => datos.ej[it.exercise_id]?.primary_muscle).filter(Boolean))];
          return (
            <li key={rid}>
              <Tarjeta data-testid={`rutina-${i}`} className="h-full">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-superficie2 font-extrabold tabular-nums text-tinta2">{i + 1}</span>
                  <Link href={`/salud/rutinas?id=${rid}`} className="min-w-0 flex-1" data-testid={`rutina-editar-${i}`}>
                    <p className="text-lg font-bold leading-snug">{r.name}{sig.rotacion_id === rid ? <span className="ml-2 rounded-full bg-acento-suave px-2 py-0.5 align-middle text-xs font-bold text-acento-tinta">siguiente</span> : null}</p>
                    <p className="text-sm text-tinta2">{its.length} ejercicios · ~{M.estimarMinutos(bs)} min · {musc.map((m) => MUSCULOS[m] ?? m).join(", ")}</p>
                    {r.updated_by === "mama" ? <p className="mt-1 inline-flex rounded-full bg-mama-suave px-2.5 py-0.5 text-xs font-bold text-mama-tinta">MAMA · último cambio</p> : null}
                  </Link>
                  <div className="flex flex-col">
                    <button type="button" aria-label="Subir en la rotación" onClick={() => mover(i, -1)} disabled={i === 0} data-testid={`rot-subir-${i}`} className="grid h-10 w-10 place-items-center rounded-full hover:bg-superficie2 disabled:opacity-30"><Icono n="chevron-up" /></button>
                    <button type="button" aria-label="Bajar en la rotación" onClick={() => mover(i, 1)} disabled={i === orden.length - 1} data-testid={`rot-bajar-${i}`} className="grid h-10 w-10 place-items-center rounded-full hover:bg-superficie2 disabled:opacity-30"><Icono n="chevron-down" /></button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Chip icono="skip-forward" data-testid={`rutina-siguiente-${i}`} onClick={() => hacer(() => conDatos((sb, _d, ctx) => D.guardarAjustes(sb, { next_routine_id: rid }, ctx)), `${r.name} será la siguiente`)}>Hacerla la siguiente</Chip>
                  <Chip icono="copy" data-testid={`rutina-duplicar-${i}`} onClick={() => hacer(() => conDatos((sb, _d, ctx) => D.duplicarRutina(sb, rid, ctx)), "Duplicada")}>Duplicar</Chip>
                  <Chip icono="archive" data-testid={`rutina-archivar-${i}`} onClick={() => hacer(() => conDatos((sb, _d, ctx) => D.estadoRutina(sb, rid, "archivar", ctx)), "Archivada (fuera de la rotación)")}>Archivar</Chip>
                  {confirmar === rid
                    ? <Chip tono="peligro" icono="trash" data-testid={`rutina-eliminar-ok-${i}`} onClick={() => { setConfirmar(null); void hacer(() => conDatos((sb, _d, ctx) => D.estadoRutina(sb, rid, "eliminar", ctx)), "Eliminada (se puede recuperar abajo)"); }}>Sí, eliminar</Chip>
                    : <Chip tono="peligro" icono="trash" data-testid={`rutina-eliminar-${i}`} onClick={() => setConfirmar(rid)}>Eliminar</Chip>}
                </div>
              </Tarjeta>
            </li>
          );
        })}
      </ol>
      {archivadas.length ? (
        <section className="mt-8">
          <Etiqueta className="mb-2">Archivadas</Etiqueta>
          <ul className="grid gap-2 lg:grid-cols-2">{archivadas.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-[14px] border border-linea bg-superficie px-4 py-2">
              <span className="flex-1 font-medium">{r.name}</span>
              <Chip icono="rotate-ccw" data-testid={`desarchivar-${r.id}`} onClick={() => hacer(() => conDatos((sb, _d, ctx) => D.estadoRutina(sb, r.id, "desarchivar", ctx)), "Vuelve a la rotación")}>Recuperar</Chip>
            </li>
          ))}</ul>
        </section>
      ) : null}
      {borradas.length ? (
        <section className="mt-8">
          <Etiqueta className="mb-2">Eliminadas (recuperables)</Etiqueta>
          <ul className="grid gap-2 lg:grid-cols-2">{borradas.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-[14px] border border-linea bg-superficie px-4 py-2">
              <span className="flex-1 text-tinta2">{r.name}</span>
              <Chip icono="rotate-ccw" data-testid={`recuperar-${r.id}`} onClick={() => hacer(() => conDatos((sb, _d, ctx) => D.estadoRutina(sb, r.id, "recuperar", ctx)), "Recuperada")}>Recuperar</Chip>
            </li>
          ))}</ul>
        </section>
      ) : null}
    </Marco>
  );
}

function Editor({ rutina, onSalir }: { rutina: Rutina | null; onSalir: () => void }) {
  const { datos } = useGym();
  const ej = useMemo(() => datos?.ej ?? {}, [datos]);
  const [nombre, setNombre] = useState(rutina?.name ?? "");
  const [blocks, setBlocks] = useState<Bloque[]>(() => M.normalizar(rutina?.blocks ?? [], { descanso: datos?.ajustes?.rest_default, descansoSuperserie: datos?.ajustes?.rest_superset }));
  const [sel, setSel] = useState(false);
  const [sust, setSust] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const op = (o: Record<string, unknown>) => {
    try { setBlocks(M.aplicarOp({ blocks }, o, { ej: estadoGym().datos?.ej ?? ej, hechas: {}, ajustes: { descanso: datos?.ajustes?.rest_default, descansoSuperserie: datos?.ajustes?.rest_superset } }).plan.blocks); setMsg(null); }
    catch (e) { setMsg(err(e)); }
  };
  const editar = (item_id: string, c: Record<string, unknown>) => op({ tipo: "editar", item_id, ...c });
  const items = M.itemsDe(blocks) as Item[];
  const guardar = async () => {
    if (!nombre.trim()) return setMsg("Ponle un nombre a la rutina");
    if (!blocks.length) return setMsg("Añade al menos un ejercicio");
    setGuardando(true);
    try {
      if (rutina) await conDatos((sb, _d, ctx) => D.editarRutina(sb, rutina.id, () => ({ name: nombre.trim(), blocks, resumen: "editada en la web" }), ctx));
      else await conDatos((sb, _d, ctx) => D.crearRutina(sb, { name: nombre.trim(), blocks }, ctx));
      onSalir();
    } catch (e) { setMsg(err(e)); } finally { setGuardando(false); }
  };
  const crear = (x: { name: string; primary_muscle: string; equipment: string }) => conDatos<Ejercicio>((sb, _d, ctx) => D.crearEjercicio(sb, x, ctx));

  const resumen = (
    <Tarjeta className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-bold uppercase tracking-[0.05em] text-tinta2">Nombre</span>
        <input data-testid="rutina-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="p. ej. A · Pecho y tríceps"
          className="min-h-12 w-full rounded-[14px] border border-linea bg-superficie2 px-4 text-lg font-semibold outline-none focus:border-acento" />
      </label>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-[14px] bg-superficie2 py-2"><p className="text-[22px] font-extrabold tabular-nums">{M.estimarMinutos(blocks)}</p><p className="text-xs text-tinta2">min aprox.</p></div>
        <div className="rounded-[14px] bg-superficie2 py-2"><p className="text-[22px] font-extrabold tabular-nums">{items.length}</p><p className="text-xs text-tinta2">ejercicios</p></div>
        <div className="rounded-[14px] bg-superficie2 py-2"><p className="text-[22px] font-extrabold tabular-nums">{M.seriesPechoPlan(blocks, ej)}</p><p className="text-xs text-tinta2">series de pecho</p></div>
      </div>
      {msg ? <p role="alert" className="rounded-[14px] bg-peligro-suave px-3 py-2 text-sm text-peligro-tinta">{msg}</p> : null}
      <Boton grande className="w-full" icono="check" disabled={guardando} onClick={guardar} data-testid="ed-guardar">{guardando ? "Guardando…" : rutina ? "Guardar cambios" : "Crear rutina"}</Boton>
      <Boton tipo="secundario" className="w-full" onClick={onSalir}>Cancelar</Boton>
      {rutina ? <p className="text-xs text-tinta2">Versión {rutina.version}. Cambiarla no toca los entrenamientos ya hechos.</p> : null}
    </Tarjeta>
  );

  return (
    <Marco titulo={rutina ? "Editar rutina" : "Nueva rutina"} accion={<Boton tipo="secundario" icono="arrow-left" onClick={onSalir}>Rutinas</Boton>}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-6">
        <div className="space-y-3 lg:order-1">
          <div className="lg:hidden">{resumen}</div>
          {!blocks.length ? <Vacio titulo="Sin ejercicios">Añade el primero con el botón de abajo.</Vacio> : null}
          {blocks.map((b, bi) => (
            <div key={b.id} className={cx(b.kind === "superset" && "space-y-2 rounded-[22px] border border-acento/30 bg-acento-suave/60 p-2")}>
              {b.kind === "superset" ? (
                <div className="flex flex-wrap items-center gap-2 px-2 pt-1">
                  <p className="flex-1 text-xs font-bold uppercase tracking-[0.05em] text-acento-tinta">Superserie · descanso {b.rest_round} s por vuelta</p>
                  <Chip icono="scissors" onClick={() => op({ tipo: "separar", block_id: b.id })}>Separar</Chip>
                </div>
              ) : null}
              {b.items.map((it) => {
                const e = ej[it.exercise_id];
                return (
                  <Tarjeta key={it.id} data-testid={`ed-${e?.slug ?? it.id}`}>
                    <div className="flex items-start gap-3">
                      <Mini e={e} className="h-16 w-16 shrink-0" />
                      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSust(it.id)}>
                        <span className="block text-[17px] font-bold leading-snug">{e?.name ?? "Ejercicio"}</span>
                        <span className="block text-sm text-tinta2">{MUSCULOS[e?.primary_muscle ?? ""] ?? ""} · toca para cambiar de ejercicio</span>
                      </button>
                      <div className="flex shrink-0">
                        <button type="button" aria-label="Subir" onClick={() => op({ tipo: "mover", item_id: it.id, dir: -1 })} className="grid h-10 w-10 place-items-center rounded-full hover:bg-superficie2"><Icono n="chevron-up" /></button>
                        <button type="button" aria-label="Bajar" onClick={() => op({ tipo: "mover", item_id: it.id, dir: 1 })} className="grid h-10 w-10 place-items-center rounded-full hover:bg-superficie2"><Icono n="chevron-down" /></button>
                        <button type="button" aria-label="Quitar" data-testid={`ed-quitar-${e?.slug}`} onClick={() => op({ tipo: "quitar", item_id: it.id, borrar: true })} className="grid h-10 w-10 place-items-center rounded-full text-peligro-tinta hover:bg-peligro-suave"><Icono n="trash" /></button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-3 sm:gap-3">
                      <Paso compacto etiqueta="Series" valor={it.sets} min={1} max={20} onCambio={(v) => editar(it.id, { sets: v ?? 1 })} testid={`ed-series-${e?.slug}`} />
                      <Paso compacto etiqueta="Repeticiones" valor={it.reps} min={1} max={100} onCambio={(v) => editar(it.id, { reps: v ?? 1 })} testid={`ed-reps-${e?.slug}`} />
                      <Paso compacto etiqueta="Peso (kg)" valor={it.weight} paso={2.5} sufijo="kg" decimales max={1000} onCambio={(v) => editar(it.id, { weight: v })} />
                      <Paso compacto etiqueta={b.kind === "superset" ? "Descanso/vuelta (s)" : "Descanso (s)"} valor={b.kind === "superset" ? b.rest_round ?? 90 : it.rest} paso={15} max={600} sufijo="s" onCambio={(v) => editar(it.id, { rest: v ?? 90 })} />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {([1, 2, 3] as const).map((p) => <Chip key={p} activo={it.priority === p} onClick={() => editar(it.id, { priority: p })}>{PRIORIDAD[p]}</Chip>)}
                      {b.kind !== "superset" && blocks[bi + 1] ? <Chip icono="link" data-testid={`ed-unir-${e?.slug}`} onClick={() => op({ tipo: "unir", item_ids: [it.id, blocks[bi + 1].items[0].id] })}>Superserie con el siguiente</Chip> : null}
                    </div>
                    <input value={it.notes ?? ""} onChange={(ev) => editar(it.id, { notes: ev.target.value })} placeholder="Observaciones (opcional)" aria-label="Observaciones"
                      className="mt-3 min-h-11 w-full rounded-[12px] border border-linea bg-superficie2 px-3 text-[15px] outline-none focus:border-acento" />
                  </Tarjeta>
                );
              })}
            </div>
          ))}
          <Boton tipo="secundario" icono="plus" className="w-full" onClick={() => setSel(true)} data-testid="ed-anadir">Añadir ejercicio</Boton>
        </div>
        <div className="hidden lg:order-2 lg:block"><div className="sticky top-6">{resumen}</div></div>
      </div>
      <SelectorEjercicio abierta={sel} onCerrar={() => setSel(false)} ej={ej} titulo="Añadir ejercicio" onCrear={crear}
        onElegir={(x) => { setSel(false); op({ tipo: "anadir", exercise_id: x.id, rest: x.default_rest ?? datos?.ajustes?.rest_default ?? 90, priority: blocks.length < 2 ? 1 : 2 }); }} />
      <SelectorEjercicio abierta={!!sust} onCerrar={() => setSust(null)} ej={ej} titulo="Cambiar ejercicio" onCrear={crear}
        sugeridos={sust ? M.alternativas(items.find((x) => x.id === sust)?.exercise_id, ej) : []}
        onElegir={(x) => { const id = sust; setSust(null); if (id) op({ tipo: "sustituir", item_id: id, exercise_id: x.id }); }} />
    </Marco>
  );
}
