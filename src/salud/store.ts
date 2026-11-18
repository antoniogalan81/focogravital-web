// SALUD · GYM · estado de la web. Misma fuente de datos que la app Android y MAMA (Supabase + datos.js) con:
//  · sesión en curso OPTIMISTA y PERSISTIDA (localStorage): recargar, cerrar la pestaña o quedarse sin red no la pierde;
//  · cola de salida: cada acción se aplica en local al instante y sale en orden; sin red se queda y se reintenta
//    (series con id propio → reintentar no duplica; operaciones con opId → idempotentes). Lo rechazado 5 veces NUNCA se
//    tira: pasa a «no guardados», visible y guardado en este navegador;
//  · la cola sólo se vacía tras cargar datos frescos del servidor; sondeo cada 5 s mientras GYM está a la vista.
// Réplica de APP/src/gym/useGym.ts (Android 1.3.0) sin zustand: un almacén mínimo con useSyncExternalStore.
"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "@/src/lib/supabaseClient";
import * as D from "./gym/datos.js";
import * as M from "./gym/motor.js";

export type Ejercicio = {
  id: string; slug: string; name: string; aliases: string[]; primary_muscle: string; secondary_muscles: string[];
  kind: string; equipment: string; pattern: string | null; alternatives: string[]; default_rest: number | null;
  user_id: string | null; archived_at: string | null; image_url: string | null; description: string | null;
};
export type Item = { id: string; exercise_id: string; sets: number; reps: number; weight: number | null; rest: number; priority: number; notes?: string; status?: string; from_exercise_id?: string };
export type Bloque = { id: string; kind: "single" | "superset"; rest_round?: number; items: Item[] };
export type Rutina = { id: string; name: string; notes: string | null; blocks: Bloque[]; variants: Record<string, unknown>; version: number; rev: number; archived_at: string | null; deleted_at: string | null; created_at: string; updated_by: string; updated_at: string };
export type Cambio = { at: string; by: string; tipo: string; cambio: string; id?: string };
export type Sesion = { id: string; routine_id: string | null; routine_name: string; routine_version: number | null; status: string; mode: string; planned_minutes: number | null;
  estimated_minutes: number | null; plan: { blocks: Bloque[]; mode?: string }; changes: Cambio[]; started_at: string; ended_at: string | null;
  paused_at: string | null; paused_seconds: number; chest_adaptation: boolean; adapted: boolean; advances: boolean; rest_until: string | null; rev: number; updated_by: string };
export type Serie = { id: string; session_id: string; item_id: string; exercise_id: string; set_index: number; weight: number | null; reps: number; rest_seconds: number | null; done_at: string; deleted_at: string | null; source: string };
export type Ajustes = { user_id: string; rotation: string[]; next_routine_id: string | null; next_set_at: string | null; default_minutes: number | null; default_mode: string; rest_default: number; rest_superset: number;
  chest_weekly_min: number; chest_min_sets: number; sound: boolean; vibration: boolean; prepared: Preparada | null; rev: number;
  advance_rule?: string; chest_rule?: string; chest_fraction?: number; chest_floor?: number };
export type Preparada = { routine_id: string; minutes: number | null; mode: string; blocks: Bloque[]; cambios: string[]; estimado?: number; by: string; at: string; dia: string; motivo?: string; adaptacion_pecho?: boolean };
export type Datos = { ej: Record<string, Ejercicio>; ajustes: Ajustes; rutinas: Rutina[]; sesiones: Sesion[]; sets: Serie[]; abierta: Sesion | null };

type Base = { id: string; intentos?: number };
export type Pendiente = Base & (
  | { tipo: "iniciar"; args: { rutina_id: string | null; minutos: number | null; modo: string; plan: unknown } }
  | { tipo: "serie"; args: { session_id: string; item_id: string; weight: number | null; reps: number; rest_seconds: number | null; done_at: string } }
  | { tipo: "op"; args: { session_id: string; op: Record<string, unknown> } }
  | { tipo: "deshacer"; args: { set_id: string } }
  | { tipo: "corregir"; args: { set_id: string; weight: number | null; reps: number } }
  | { tipo: "pausa"; args: { session_id: string; pausa: boolean } }
  | { tipo: "descanso"; args: { session_id: string; hasta: string | null } }
  | { tipo: "finalizar"; args: { session_id: string; guardar: boolean; cancelar: boolean } });

export type Estado = {
  datos: Datos | null;
  noGuardados: (Pendiente & { motivo: string; at: string })[];
  cargando: boolean;
  error: string | null;
  aviso: string | null; // último cambio llegado de MAMA (se muestra un momento)
  sesion: Sesion | null; // abierta (optimista)
  series: Serie[]; // de la sesión abierta (optimistas)
  cola: Pendiente[];
  sinRed: boolean;
  ultimaCarga: number;
  restaurado: boolean; // ya se leyó lo guardado en este navegador
};

const CLAVE = "focogravital-gym-sesion-v1";
const CLAVE_DATOS = "focogravital-gym-datos-v1";
const INTENTOS_MAX = 5;
const SONDEO_MS = 5000;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const esDeRed = (e: unknown) => {
  const x = e as { code?: string; message?: string } | null;
  return !x?.code && /fetch|network|timeout|Failed|abort|Load failed/i.test(String(x?.message || e));
};

const INICIAL: Estado = { datos: null, noGuardados: [], cargando: false, error: null, aviso: null, sesion: null, series: [], cola: [], sinRed: false, ultimaCarga: 0, restaurado: false };
let estado = INICIAL;
const subs = new Set<() => void>();
export const get = () => estado;
function set(p: Partial<Estado>) { estado = { ...estado, ...p }; for (const f of subs) f(); }
const suscribir = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useGym = () => useSyncExternalStore(suscribir, get, () => INICIAL);

// ---------------------------------------------------------------- persistencia local

let restaurado = false;
function guardarLocal() {
  const { sesion, series, cola, noGuardados } = get();
  try { localStorage.setItem(CLAVE, JSON.stringify({ sesion, series, cola, noGuardados })); } catch { /* sin almacenamiento: sigue en memoria */ }
}
function restaurar() {
  if (restaurado || typeof window === "undefined") return;
  restaurado = true;
  try {
    const raw = localStorage.getItem(CLAVE);
    if (raw) { const x = JSON.parse(raw); set({ sesion: x.sesion ?? null, series: x.series ?? [], cola: x.cola ?? [], noGuardados: x.noGuardados ?? [] }); }
    // Última copia de los datos: la pantalla se ve aunque se recargue sin red (la cola NO se vacía con esta copia).
    const d = localStorage.getItem(CLAVE_DATOS);
    if (d && !get().datos) set({ datos: JSON.parse(d) });
  } catch { /* datos locales ilegibles: se recarga del servidor */ }
  set({ restaurado: true });
}
function guardarDatos(datos: Datos) {
  try { localStorage.setItem(CLAVE_DATOS, JSON.stringify(datos)); } catch { /* demasiado grande o sin almacenamiento: no pasa nada */ }
}

export const hechasLocal = (): Record<string, number> => D.hechasDe(get().series, get().sesion?.id);
const ajustesMotor = () => { const a = get().datos?.ajustes; return { descanso: a?.rest_default, descansoSuperserie: a?.rest_superset, pechoSeries: a ? M.minimoPecho(a) : undefined }; };

// ---------------------------------------------------------------- carga y sondeo

let frescos = false; // hay datos del servidor en esta pestaña (la cola sólo sale con ellos)
let cargaEnVuelo: Promise<void> | null = null;
export function cargar(): Promise<void> {
  cargaEnVuelo ??= (async () => {
    await null; // nunca terminar en el mismo tick que la asignación (si no, el finally la deja colgada)
    restaurar();
    set({ cargando: !get().datos });
    const version0 = versionLocal;
    try {
      let datos = (await D.cargar(supabase)) as Datos;
      frescos = true;
      set({ datos });
      if (get().cola.length) { await vaciarCola(); if (!get().cola.length) datos = (await D.cargar(supabase)) as Datos; }
      const st = get();
      const prev = st.sesion;
      // Sólo se adopta lo del servidor si no queda nada local por subir (si no, lo local es más nuevo).
      if (!st.cola.length && versionLocal === version0) {
        const abierta = datos.abierta;
        const nuevosMama = abierta && prev && abierta.id === prev.id
          ? (abierta.changes || []).filter((c) => c.by === "mama" && !(prev.changes || []).some((p) => p.at === c.at && p.cambio === c.cambio)) : [];
        const series = abierta ? datos.sets.filter((s) => s.session_id === abierta.id) : [];
        set({ sesion: abierta, series, aviso: nuevosMama.length ? `MAMA: ${nuevosMama.map((c) => c.cambio).join(" · ")}` : get().aviso });
        const nuevasMama = series.filter((s) => s.source === "mama" && !st.series.some((x) => x.id === s.id));
        if (nuevasMama.length && prev?.id === abierta?.id) set({ aviso: `MAMA registró ${nuevasMama.length} serie${nuevasMama.length > 1 ? "s" : ""}` });
        guardarLocal();
      }
      set({ datos, error: null, sinRed: false, ultimaCarga: Date.now() });
      guardarDatos(datos);
    } catch (e) {
      set({ error: esDeRed(e) ? null : msg(e), sinRed: esDeRed(e) });
    } finally { set({ cargando: false }); cargaEnVuelo = null; }
  })();
  return cargaEnVuelo;
}

let sondeo: ReturnType<typeof setInterval> | null = null, usuarios = 0;
const alVolverRed = () => { void cargar(); };
const alVer = () => { if (document.visibilityState === "visible") void cargar(); };
/** Pantallas de GYM: llamar al montar; devuelve la baja. */
export function vigilar(): () => void {
  restaurar();
  usuarios++;
  void cargar();
  if (!sondeo) {
    sondeo = setInterval(() => { if (document.visibilityState === "visible") void cargar(); }, SONDEO_MS);
    window.addEventListener("online", alVolverRed);
    document.addEventListener("visibilitychange", alVer);
  }
  return () => {
    if (--usuarios <= 0 && sondeo) {
      clearInterval(sondeo); sondeo = null; usuarios = 0;
      window.removeEventListener("online", alVolverRed);
      document.removeEventListener("visibilitychange", alVer);
    }
  };
}
export const limpiarAviso = () => set({ aviso: null });
export const limpiarError = () => set({ error: null });

// ---------------------------------------------------------------- cola de salida

let vaciando: Promise<void> | null = null;
function vaciarCola(): Promise<void> {
  vaciando ??= (async () => {
    await null; // SIEMPRE asíncrona: si terminara en el mismo tick, su finally correría antes de la asignación y quedaría colgada
    try {
      while (get().cola.length) {
        const p = get().cola[0];
        if (!frescos || !get().datos) return; // sin datos del servidor aún: se sube en la próxima carga (nunca se descarta)
        try { await enviar(p); }
        catch (e) {
          if (esDeRed(e)) { set({ sinRed: true }); return; }
          // Rechazo: se reintenta (el orden se respeta); tras INTENTOS_MAX se aparta a «no guardados» (en este navegador, visible).
          const intentos = (p.intentos ?? 0) + 1;
          if (intentos < INTENTOS_MAX) { set({ cola: [{ ...p, intentos }, ...get().cola.slice(1)], error: `Reintentando guardar: ${msg(e)}` }); guardarLocal(); return; }
          set({ noGuardados: [...get().noGuardados, { ...p, motivo: msg(e), at: new Date().toISOString() }].slice(-200), error: `No se pudo guardar un cambio (${msg(e)}): queda apartado en este navegador` });
        }
        set({ cola: get().cola.slice(1), sinRed: false });
        guardarLocal();
      }
    } finally { vaciando = null; }
  })();
  return vaciando;
}
async function enviar(p: Pendiente) {
  const ctx = { by: "app", ej: get().datos?.ej ?? {}, aj: get().datos?.ajustes ?? {} };
  const datos = get().datos;
  switch (p.tipo) {
    case "iniciar": {
      if (!datos) throw new Error("sin datos");
      const r = await D.iniciar(supabase, datos, { id: p.id, rutina_id: p.args.rutina_id, minutos: p.args.minutos, modo: p.args.modo, plan: p.args.plan }, ctx);
      if (r.yaAbierta && r.sesion.id !== p.id) {
        // Ya había otra abierta (p. ej. la empezó MAMA o el móvil): se adopta esa y lo encolado para esta se aparta.
        set({ sesion: r.sesion, error: "Ya había un entrenamiento abierto: sigues con ese" });
        const fuera = get().cola.filter((x) => "session_id" in x.args && x.args.session_id === p.id);
        set({ cola: get().cola.filter((x) => !fuera.includes(x)), noGuardados: [...get().noGuardados, ...fuera.map((x) => ({ ...x, motivo: "Había otro entrenamiento abierto", at: new Date().toISOString() }))] });
      }
      return;
    }
    case "serie": return void (await D.registrarSerie(supabase, { id: p.id, ...p.args }, ctx));
    case "op": return void (await D.operar(supabase, p.args.session_id, p.args.op, { ...ctx, opId: p.id }));
    case "deshacer": return void (await D.deshacerSerie(supabase, p.args.set_id, ctx));
    case "corregir": return void (await D.corregirSerie(supabase, p.args.set_id, { weight: p.args.weight, reps: p.args.reps }, ctx));
    case "pausa": return void (await D.pausar(supabase, p.args.session_id, p.args.pausa, ctx));
    case "descanso": return void (await D.descanso(supabase, p.args.session_id, p.args.hasta, ctx));
    case "finalizar": return void (await D.finalizar(supabase, p.args.session_id, { guardar: p.args.guardar, cancelar: p.args.cancelar }, ctx));
  }
}
let versionLocal = 0; // sube con cada acción local: una lectura empezada antes no pisa lo que se hizo mientras tanto
function encolar(p: Pendiente) {
  versionLocal++;
  set({ cola: [...get().cola, p] });
  guardarLocal();
  void vaciarCola().then(() => (get().cola.length ? undefined : cargar()));
}
/** Vuelve a intentar los «no guardados» (los pone al final de la cola). */
export function reintentarNoGuardados() {
  const xs = get().noGuardados;
  if (!xs.length) return;
  set({ noGuardados: [], cola: [...get().cola, ...xs.map((x) => ({ ...x, motivo: undefined, at: undefined, intentos: 0 }) as unknown as Pendiente)] });
  guardarLocal();
  void vaciarCola().then(() => cargar());
}

// ---------------------------------------------------------------- acciones de la sesión (instantáneas en local)

export type PlanInicio = { blocks: Bloque[]; cambios: string[]; adaptacion_pecho?: boolean };
export function empezar({ rutina_id, minutos, modo, plan }: { rutina_id: string | null; minutos: number | null; modo: string; plan: PlanInicio }) {
  if (get().sesion) return get().sesion;
  const r = get().datos?.rutinas.find((x) => x.id === rutina_id);
  const id = D.uuid() as string;
  const ahora = new Date().toISOString();
  const s: Sesion = { id, routine_id: rutina_id, routine_name: r?.name || "Sesión libre", routine_version: r?.version ?? null, status: "activa", mode: modo, planned_minutes: minutos,
    estimated_minutes: M.estimarMinutos(plan.blocks), plan: { blocks: plan.blocks, mode: modo },
    changes: plan.cambios.length ? [{ at: ahora, by: "app", tipo: "preparar", cambio: plan.cambios.join("; ") }] : [],
    started_at: ahora, ended_at: null, paused_at: null, paused_seconds: 0, chest_adaptation: !!plan.adaptacion_pecho, adapted: plan.cambios.length > 0, advances: false, rest_until: null, rev: 0, updated_by: "app" };
  set({ sesion: s, series: [] });
  encolar({ tipo: "iniciar", id, args: { rutina_id, minutos, modo, plan: { blocks: plan.blocks, mode: modo, cambios: plan.cambios, adaptacion_pecho: plan.adaptacion_pecho } } });
  return s;
}

/** Operación del motor sobre la sesión: se ve al instante y se envía. Devuelve el texto del cambio o lanza el motivo. */
export function operar(op: Record<string, unknown>): string {
  const s = get().sesion;
  if (!s) throw new Error("No hay entrenamiento en curso");
  const { plan, cambio } = M.aplicarOp(s.plan, op, { ej: get().datos?.ej ?? {}, hechas: hechasLocal(), ajustes: ajustesMotor() });
  const id = D.uuid() as string;
  set({ sesion: { ...s, plan, mode: plan.mode || s.mode, adapted: true, changes: [...s.changes, { at: new Date().toISOString(), by: "app", tipo: String(op.tipo), cambio, id }] } });
  encolar({ tipo: "op", id, args: { session_id: s.id, op } });
  return cambio;
}

export function terminarSerie(item_id: string, weight: number | null, reps: number, rest_seconds: number | null): Serie | null {
  const s = get().sesion;
  if (!s) return null;
  const it = (M.itemsDe(s.plan.blocks) as Item[]).find((x) => x.id === item_id);
  if (!it) return null;
  const previas = get().series.filter((x) => x.item_id === item_id);
  const serie: Serie = { id: D.uuid(), session_id: s.id, item_id, exercise_id: it.exercise_id, set_index: Math.max(0, ...previas.map((x) => x.set_index)) + 1, weight, reps, rest_seconds,
    done_at: new Date().toISOString(), deleted_at: null, source: "app" };
  set({ series: [...get().series, serie] });
  encolar({ tipo: "serie", id: serie.id, args: { session_id: s.id, item_id, weight, reps, rest_seconds, done_at: serie.done_at } });
  return serie;
}
export function deshacerSerie(set_id: string) {
  set({ series: get().series.filter((x) => x.id !== set_id) });
  encolar({ tipo: "deshacer", id: D.uuid(), args: { set_id } });
}
export function corregirSerie(set_id: string, weight: number | null, reps: number) {
  set({ series: get().series.map((x) => (x.id === set_id ? { ...x, weight, reps } : x)) });
  encolar({ tipo: "corregir", id: D.uuid(), args: { set_id, weight, reps } });
}
export function pausar(pausa: boolean) {
  const s = get().sesion;
  if (!s) return;
  const ahora = new Date().toISOString();
  set({ sesion: pausa ? { ...s, status: "pausada", paused_at: ahora, rest_until: null }
    : { ...s, status: "activa", paused_at: null, paused_seconds: s.paused_seconds + Math.round((Date.now() - Date.parse(s.paused_at || ahora)) / 1000) } });
  encolar({ tipo: "pausa", id: D.uuid(), args: { session_id: s.id, pausa } });
}
export function marcarDescanso(hasta: string | null) {
  const s = get().sesion;
  if (!s) return;
  set({ sesion: { ...s, rest_until: hasta } });
  encolar({ tipo: "descanso", id: D.uuid(), args: { session_id: s.id, hasta } });
}
/** Termina. Devuelve el resultado calculado en local con las reglas del usuario (el servidor aplica la misma). */
export function finalizar({ guardar, cancelar }: { guardar: boolean; cancelar: boolean }) {
  const s = get().sesion;
  if (!s) return null;
  const res = M.resultadoSesion(s.plan, hechasLocal(), get().datos?.ajustes ?? {});
  set({ sesion: null, series: [] });
  encolar({ tipo: "finalizar", id: D.uuid(), args: { session_id: s.id, guardar, cancelar } });
  return res as { status: string; previstas: number; hechas: number; fraccion: number; avanza: boolean; motivo: string };
}

// ---------------------------------------------------------------- utilidades para pantallas

type Ctx = { by: "app"; ej: Record<string, Ejercicio>; aj: Ajustes };
/** Ejecuta una función de datos.js con el cliente y la sesión del usuario y recarga. Necesita red. */
export async function conDatos<T>(fn: (sb: typeof supabase, datos: Datos, ctx: Ctx) => Promise<T>): Promise<T> {
  let datos = get().datos;
  if (!datos || !frescos) { await cargar(); datos = get().datos; }
  if (!datos) throw new Error("Sin conexión: inténtalo cuando haya red");
  const r = await fn(supabase, datos, { by: "app", ej: datos.ej, aj: datos.ajustes });
  await cargar();
  return r;
}
