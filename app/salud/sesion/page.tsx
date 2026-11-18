"use client";
// SALUD · GYM · entrenamiento en curso (modo foco oscuro). Cada toque se ve al instante (motor local) y entra en la cola
// persistente: recargar, quedarse sin red o cerrar la pestaña no pierde nada. Pantalla encendida (Wake Lock) mientras se ve.
// Escritorio: 2 columnas (ejercicio actual + registro | descanso + plan completo).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as D from "@/src/salud/gym/datos.js";
import * as M from "@/src/salud/gym/motor.js";
import * as R from "@/src/salud/descanso";
import { conDatos, corregirSerie, deshacerSerie, finalizar, limpiarAviso, operar, pausar, terminarSerie, useGym, vigilar, type Bloque, type Datos, type Item, type Serie, type Sesion } from "@/src/salud/store";
import { Boton, Chip, cx, EQUIPOS, Figura, Hoja, Icono, Interruptor, kg, mmss, MUSCULOS, num, Paso, SelectorEjercicio, Toast } from "@/src/salud/ui";

const PASO_KG = 2.5;
const TRANSICION = 15; // dentro de una superserie, entre un ejercicio y el siguiente
type HojaId = null | "sustituir" | "anadir" | "unir" | "tiempo" | "fin" | "menu" | "corregir" | "cambios";
type Resultado = { status: string; previstas: number; hechas: number; fraccion: number; avanza: boolean; motivo: string };

function usePantallaEncendida() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null, vivo = true;
    const pedir = async () => {
      try {
        const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && document.visibilityState === "visible" && vivo) lock = await wl.request("screen");
      } catch { /* sin permiso o no disponible */ }
    };
    const alVer = () => { if (document.visibilityState === "visible") void pedir(); };
    void pedir();
    document.addEventListener("visibilitychange", alVer);
    return () => { vivo = false; document.removeEventListener("visibilitychange", alVer); void lock?.release().catch(() => {}); };
  }, []);
}

export default function SesionPage() {
  usePantallaEncendida();
  const router = useRouter();
  const { datos, sesion, series, aviso, error, sinRed, cola, noGuardados, restaurado } = useGym();
  const descanso = R.useDescanso();
  const [ahora, setAhora] = useState(() => Date.now());
  const [elegido, setElegido] = useState<string | null>(null);
  const [hoja, setHoja] = useState<HojaId>(null);
  const [corrigiendo, setCorrigiendo] = useState<Serie | null>(null);
  const [toast, setToast] = useState<{ texto: string; deshacer?: () => void; at: number } | null>(null);
  const [resultado, setResultado] = useState<(Resultado & { guardado: boolean }) | null>(null);
  const cerrarHoja = useCallback(() => setHoja(null), []);
  const avisar = useCallback((texto: string, deshacer?: () => void) => setToast({ texto, deshacer, at: Date.now() }), []);

  useEffect(() => vigilar(), []);
  useEffect(() => { R.restaurarDescanso(); }, []);
  useEffect(() => { R.fijarOpciones({ sonido: datos?.ajustes?.sound ?? true, vibracion: datos?.ajustes?.vibration ?? true }); }, [datos?.ajustes?.sound, datos?.ajustes?.vibration]);
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 250); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => { avisar(aviso); limpiarAviso(); }, 0); return () => clearTimeout(t); }, [aviso, avisar]);
  // Medida: de «Terminar serie» a la interfaz actualizada (performance.measure «salud:serie»).
  useEffect(() => {
    if (!performance.getEntriesByName("salud:serie:inicio").length) return;
    try { performance.measure("salud:serie", "salud:serie:inicio"); performance.clearMarks("salud:serie:inicio"); } catch { /* */ }
  }, [series.length]);

  const ej = useMemo(() => datos?.ej ?? {}, [datos]);
  const hechas = useMemo<Record<string, number>>(() => (sesion ? D.hechasDe(series, sesion.id) : {}), [series, sesion]);
  const blocks: Bloque[] = useMemo(() => sesion?.plan?.blocks ?? [], [sesion]);
  const items = useMemo(() => M.itemsDe(blocks) as (Item & { block_id: string })[], [blocks]);
  const auto = M.itemActual(blocks, hechas) as Item | null;
  const actual = items.find((x) => x.id === elegido && x.status !== "omitido" && (hechas[x.id] || 0) < x.sets) ?? auto;
  const bloqueActual = blocks.find((b) => b.items.some((it) => it.id === actual?.id));
  const delItem = series.filter((x) => x.item_id === actual?.id).sort((a, b) => a.set_index - b.set_index);
  const historico = useMemo(() => (actual && datos ? M.ultimosDe(datos.sets, actual.exercise_id, { excluirSesion: sesion?.id }) : { ultima: [], dia: null }) as { ultima: { peso: number | null; reps: number }[]; dia: string | null },
    [actual, datos, sesion?.id]);

  // Valores propuestos para la serie: la anterior de hoy → la misma serie de la última vez → el plan.
  const n = (hechas[actual?.id ?? ""] || 0) + 1;
  const clave = actual ? `${actual.id}:${actual.exercise_id}:${n}` : "";
  const [form, setForm] = useState<{ clave: string; peso: number | null; reps: number | null }>({ clave: "", peso: null, reps: null });
  if (actual && form.clave !== clave) {
    const hoyUlt = delItem[delItem.length - 1];
    const ult = historico.ultima[n - 1] || historico.ultima[historico.ultima.length - 1];
    setForm({ clave, peso: hoyUlt?.weight ?? ult?.peso ?? actual.weight ?? null, reps: hoyUlt?.reps ?? actual.reps ?? ult?.reps ?? 10 });
  }
  const { peso, reps } = form;

  if (!restaurado) return <Foco><p className="grid min-h-screen place-items-center text-foco-sec" role="status">Cargando…</p></Foco>;
  if (!sesion) {
    return (
      <Foco>
        <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-5 px-6 text-center" data-testid="sin-sesion">
          {resultado ? (
            <>
              <span className={cx("grid h-16 w-16 place-items-center rounded-full", resultado.status === "cancelada" ? "bg-foco-tarjeta" : "bg-foco-ok text-foco")}><Icono n={resultado.status === "cancelada" ? "x" : "check"} size={30} /></span>
              <h1 className="text-[28px] font-extrabold" data-testid="resultado">{resultado.status === "completada" ? "Entrenamiento completado" : resultado.status === "parcial" ? "Entrenamiento parcial guardado" : "Sesión descartada"}</h1>
              <p className="text-foco-sec">{resultado.hechas} de {resultado.previstas} series{resultado.guardado ? " · cambios guardados en tu rutina" : ""}</p>
              <p className="rounded-[14px] bg-foco-tarjeta px-4 py-3 text-foco-texto" data-testid="resultado-motivo">{resultado.motivo}</p>
            </>
          ) : <h1 className="text-xl font-bold">No hay ningún entrenamiento en curso</h1>}
          {!datos && sinRed ? <p className="text-foco-sec">Sin conexión: GYM necesita red la primera vez.</p> : null}
          <Link href="/salud" className="inline-flex min-h-12 items-center gap-2 rounded-[14px] bg-foco-acento px-6 font-semibold text-white"><Icono n="arrow-left" />Volver a GYM</Link>
        </div>
      </Foco>
    );
  }

  const pausada = sesion.status === "pausada";
  const transcurrido = Math.max(0, Math.round((ahora - Date.parse(sesion.started_at)) / 1000) - sesion.paused_seconds - (pausada && sesion.paused_at ? Math.round((ahora - Date.parse(sesion.paused_at)) / 1000) : 0));
  const res = M.resultadoSesion(sesion.plan, hechas, datos?.ajustes ?? {}) as Resultado;
  const queda = M.estimarMinutos(blocks, hechas) as number;
  const nombre = (id?: string) => (id && ej[id]?.name) || "Ejercicio";
  const intentar = (f: () => string | void, ok?: string) => {
    try { const r = f(); if (ok || typeof r === "string") avisar(ok ?? (r as string)); } catch (e) { avisar(`No se pudo: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const descansoActual = bloqueActual?.kind === "superset" ? bloqueActual.rest_round ?? 90 : actual?.rest ?? 90;

  function onTerminarSerie() {
    if (!actual || pausada) return;
    if (reps === null || reps < 0) return avisar("Pon las repeticiones");
    performance.mark("salud:serie:inicio");
    R.prepararAudio();
    const serie = terminarSerie(actual.id, peso, reps, null);
    if (!serie) return;
    setElegido(null);
    // Descanso automático: en superserie, transición si falta el compañero en esta vuelta; si no, el de la vuelta/ejercicio.
    const h2 = { ...hechas, [actual.id]: (hechas[actual.id] || 0) + 1 };
    let seg = actual.rest;
    if (bloqueActual?.kind === "superset") {
      const vuelta = h2[actual.id];
      const compa = bloqueActual.items.filter((it) => it.id !== actual.id && it.status !== "omitido" && (h2[it.id] || 0) < Math.min(vuelta, it.sets));
      seg = compa.length ? TRANSICION : bloqueActual.rest_round ?? 90;
    }
    const prox = M.itemActual(blocks, h2) as Item | null;
    if (prox && seg > 0) R.empezarDescanso(seg, `${nombre(prox.exercise_id)} · serie ${(h2[prox.id] || 0) + 1} de ${prox.sets}`); else R.saltar();
    avisar(`Serie ${serie.set_index} guardada: ${kg(peso)} × ${reps}`, () => { deshacerSerie(serie.id); R.saltar(); avisar("Serie deshecha"); });
    if (!prox) setHoja("fin");
  }

  const cambioEstructural = (sesion.changes || []).some((c) => ["sustituir", "anadir", "quitar", "unir", "separar", "mover", "serie_mas", "serie_menos", "editar", "modo", "tiempo_restante", "descanso_todos", "incorporar_pecho"].includes(c.tipo));
  const eActual = actual ? ej[actual.exercise_id] : null;

  const botonSerie = actual ? (
    <Boton grande tipo="primario" icono={pausada ? "pause" : "check"} disabled={pausada} onClick={onTerminarSerie} data-testid="terminar-serie"
      className="w-full !bg-foco-acento !shadow-[0_10px_30px_-10px_rgba(79,139,255,0.8)] hover:!brightness-110">
      {pausada ? "En pausa" : `Terminar serie ${n}`}
    </Boton>
  ) : null;

  return (
    <Foco>
      {/* Cabecera */}
      <header className="sticky top-0 z-30 border-b border-foco-linea bg-foco/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center gap-2 px-3 py-2 md:px-6">
          <button type="button" aria-label="Minimizar (el entrenamiento sigue)" onClick={() => router.push("/salud")} data-testid="sesion-salir"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-foco-tarjeta"><Icono n="chevron-down" size={24} /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold leading-tight">{sesion.routine_name}</p>
            <p className="text-sm tabular-nums text-foco-sec" data-testid="sesion-reloj">{pausada ? "En pausa · " : ""}{mmss(transcurrido)} · {res.hechas}/{res.previstas} series · quedan ~{queda} min{sesion.mode === "superseries" ? " · superseries" : ""}</p>
          </div>
          <button type="button" aria-label="Más opciones" onClick={() => setHoja("menu")} data-testid="sesion-menu" className="grid h-11 w-11 shrink-0 place-items-center rounded-full hover:bg-foco-tarjeta"><Icono n="more" size={24} /></button>
        </div>
        <div className="h-1 bg-foco-tarjeta"><div className="salud-anim h-full bg-foco-ok" style={{ width: `${Math.round((res.fraccion || 0) * 100)}%` }} /></div>
      </header>
      {sinRed || cola.length ? <p role="status" className="bg-[#3a2a0c] px-4 py-1.5 text-center text-sm text-[#FEC84B]">{sinRed ? "Sin conexión · todo se guarda en este navegador y se sube al volver" : `Guardando ${cola.length}…`}</p> : null}
      {error ? <p role="alert" className="bg-[#3b1512] px-4 py-1.5 text-center text-sm text-[#FDA29B]">{error}</p> : null}
      {noGuardados.length ? <p role="alert" className="bg-[#3b1512] px-4 py-1.5 text-center text-sm text-[#FDA29B]">{noGuardados.length} cambio(s) no guardados quedan en este navegador (se pueden reintentar desde GYM)</p> : null}

      <main className="mx-auto grid max-w-[1280px] gap-4 px-4 pb-44 pt-4 md:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6 lg:pb-12">
        {/* Columna 1: ejercicio actual y registro */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="flex flex-wrap gap-2" aria-label="Acciones de la sesión">
            <Chip foco icono="watch" onClick={() => setHoja("tiempo")} data-testid="me-quedan">Me quedan…</Chip>
            <Chip foco icono="layers" onClick={() => intentar(() => operar({ tipo: "modo", modo: sesion.mode === "superseries" ? "normal" : "superseries" }))} data-testid="modo">
              {sesion.mode === "superseries" ? "Pasar a normal" : "Pasar a superseries"}</Chip>
            <Chip foco icono={pausada ? "play" : "pause"} onClick={() => { pausar(!pausada); if (!pausada) R.pausarDescanso(); }} data-testid="pausa">{pausada ? "Reanudar" : "Pausar"}</Chip>
            <Chip foco icono="flag" onClick={() => setHoja("fin")} data-testid="terminar" className="!text-[#FDA29B]">Terminar</Chip>
          </div>
          <div className="lg:hidden"><TarjetaDescanso d={descanso} ahora={ahora} oculto /></div>
          {actual ? (
            <section className="rounded-[20px] border border-foco-linea bg-foco-tarjeta p-4 sm:p-5" data-testid="actual">
              {bloqueActual?.kind === "superset" ? <p className="mb-2 text-xs font-bold uppercase tracking-[0.05em] text-foco-acento">Superserie · {bloqueActual.items.map((it) => nombre(it.exercise_id)).join(" + ")}</p> : null}
              <div className="flex gap-4">
                {eActual ? <Figura principal={eActual.primary_muscle} secundarios={eActual.secondary_muscles} foco className="h-32 w-16 shrink-0 sm:h-40 sm:w-20" /> : null}
                <div className="min-w-0 flex-1">
                  <h1 className="text-[24px] font-extrabold leading-tight sm:text-[28px]" data-testid="actual-nombre">{nombre(actual.exercise_id)}</h1>
                  <p className="mt-1 text-sm text-foco-sec">{MUSCULOS[eActual?.primary_muscle ?? ""] ?? ""} · {EQUIPOS[eActual?.equipment ?? ""] ?? ""}{actual.from_exercise_id ? ` · sustituye a ${nombre(actual.from_exercise_id)}` : ""}</p>
                  <p className="mt-3 text-[22px] font-extrabold tabular-nums text-foco-acento" data-testid="actual-serie">Serie {n} de {actual.sets}</p>
                  <p className="text-[15px] text-foco-texto">Objetivo {actual.reps} reps{actual.weight != null ? ` · ${kg(actual.weight)}` : ""}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-foco-sec" data-testid="actual-ultima">
                {historico.ultima.length ? <>Última vez ({historico.dia ? new Date(`${historico.dia}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }) : ""}): <span className="tabular-nums text-foco-texto">{historico.ultima.map((x) => `${num(x.peso)}×${x.reps}`).join(" · ")}</span></> : "Primera vez con este ejercicio"}
              </p>
              {actual.notes ? <p className="mt-1 text-sm italic text-foco-sec">{actual.notes}</p> : null}
              {delItem.length ? (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Series de hoy">
                  {delItem.map((x) => (
                    <button key={x.id} type="button" onClick={() => { setCorrigiendo(x); setHoja("corregir"); }} data-testid={`hoy-${x.set_index}`}
                      className={cx("min-h-10 rounded-full px-3 text-sm font-bold tabular-nums", x.source === "mama" ? "bg-mama text-white" : "bg-foco-ok/15 text-foco-ok")}>
                      {x.source === "mama" ? "MAMA · " : ""}{x.set_index}: {num(x.weight)}×{x.reps}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Paso foco grande etiqueta="Peso" sufijo="kg" decimales paso={PASO_KG} max={1000} valor={peso} onCambio={(v) => setForm({ ...form, peso: v })} testid="peso" />
                <Paso foco grande etiqueta="Repeticiones" paso={1} max={500} valor={reps} onCambio={(v) => setForm({ ...form, reps: v === null ? null : Math.round(v) })} testid="reps" />
              </div>
              <div className="fixed inset-x-0 bottom-0 z-30 border-t border-foco-linea bg-foco/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:static lg:mt-4 lg:border-0 lg:bg-transparent lg:p-0">
                <div className="mx-auto max-w-[1280px]">{botonSerie}</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Chip foco icono="repeat" onClick={() => setHoja("sustituir")} data-testid="accion-sustituir">Máquina ocupada</Chip>
                <Chip foco icono="plus" onClick={() => intentar(() => operar({ tipo: "serie_mas", item_id: actual.id }))} data-testid="accion-serie-mas">Serie</Chip>
                <Chip foco icono="minus" onClick={() => intentar(() => operar({ tipo: "serie_menos", item_id: actual.id }))} data-testid="accion-serie-menos">Serie</Chip>
                <Chip foco icono="clock" data-testid="accion-descanso" onClick={() => {
                  const sig = [60, 75, 90, 120, 150, 180].find((x) => x > descansoActual) ?? 45;
                  intentar(() => operar({ tipo: "editar", item_id: actual.id, rest: sig }));
                }}>Descanso {descansoActual} s</Chip>
                {bloqueActual?.kind === "superset"
                  ? <Chip foco icono="scissors" onClick={() => intentar(() => operar({ tipo: "separar", item_id: actual.id }))} data-testid="accion-separar">Separar</Chip>
                  : <Chip foco icono="link" onClick={() => setHoja("unir")} data-testid="accion-unir">Superserie con…</Chip>}
                <Chip foco icono="x" onClick={() => intentar(() => operar({ tipo: "quitar", item_id: actual.id }))} data-testid="accion-quitar">Quitar</Chip>
              </div>
            </section>
          ) : (
            <section className="rounded-[20px] border border-foco-linea bg-foco-tarjeta p-6 text-center" data-testid="todo-hecho">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-foco-ok text-foco"><Icono n="flag" size={26} /></span>
              <p className="mt-3 text-[22px] font-extrabold">Todo lo previsto está hecho</p>
              <Boton grande className="mt-4 w-full !bg-foco-acento" icono="flag" onClick={() => setHoja("fin")} data-testid="fin-abrir">Terminar entrenamiento</Boton>
            </section>
          )}
        </div>

        {/* Columna 2: descanso y plan completo */}
        <div className="space-y-4">
          <div className="hidden lg:block"><TarjetaDescanso d={descanso} ahora={ahora} /></div>
          <Plan blocks={blocks} hechas={hechas} series={series} ej={ej} actualId={actual?.id ?? null}
            onElegir={setElegido} onCorregir={(s) => { setCorrigiendo(s); setHoja("corregir"); }} intentar={intentar} />
          <div className="flex flex-wrap gap-2">
            <Boton tipo="foco" icono="plus" onClick={() => setHoja("anadir")} data-testid="anadir-ejercicio">Añadir ejercicio</Boton>
            {(sesion.changes || []).length ? <Boton tipo="foco" icono="list" onClick={() => setHoja("cambios")} data-testid="ver-cambios">Cambios de hoy ({sesion.changes.length})</Boton> : null}
          </div>
        </div>
      </main>

      {toast ? <Toast foco texto={toast.texto} onDeshacer={toast.deshacer ? () => { toast.deshacer?.(); } : undefined} /> : null}

      {/* Hojas */}
      <SelectorEjercicio foco abierta={hoja === "sustituir"} onCerrar={cerrarHoja} ej={ej} titulo={`Máquina ocupada: sustituir ${actual ? nombre(actual.exercise_id) : ""}`}
        sugeridos={actual ? M.alternativas(actual.exercise_id, ej) : []}
        onCrear={(x) => conDatos((sb, _d, ctx) => D.crearEjercicio(sb, x, ctx))}
        onElegir={(x) => { setHoja(null); if (actual) intentar(() => operar({ tipo: "sustituir", item_id: actual.id, exercise_id: x.id })); }} />
      <SelectorEjercicio foco abierta={hoja === "anadir"} onCerrar={cerrarHoja} ej={ej} titulo="Añadir ejercicio"
        onCrear={(x) => conDatos((sb, _d, ctx) => D.crearEjercicio(sb, x, ctx))}
        onElegir={(x) => { setHoja(null); intentar(() => operar({ tipo: "anadir", exercise_id: x.id, rest: x.default_rest ?? datos?.ajustes?.rest_default ?? 90, after_item_id: actual?.id })); }} />
      <Hoja foco abierta={hoja === "unir"} onCerrar={cerrarHoja} titulo="Superserie con…" testid="hoja-unir">
        <ul className="space-y-2 pb-2">
          {items.filter((it) => it.id !== actual?.id && it.status !== "omitido" && (hechas[it.id] || 0) < it.sets).map((it) => (
            <li key={it.id}>
              <button type="button" data-testid={`unir-${ej[it.exercise_id]?.slug}`} onClick={() => { setHoja(null); if (actual) intentar(() => operar({ tipo: "unir", item_ids: [actual.id, it.id] })); }}
                className="flex min-h-14 w-full items-center gap-3 rounded-[14px] border border-foco-linea bg-foco-tarjeta px-3 text-left hover:bg-[#1c2740]">
                <span className="flex-1 font-semibold">{nombre(it.exercise_id)}</span>
                <span className={cx("text-sm", actual && M.compatibles(ej, actual, it) ? "text-foco-ok" : "text-foco-sec")}>{actual && M.compatibles(ej, actual, it) ? "compatible" : "mismo músculo"}</span>
              </button>
            </li>
          ))}
        </ul>
      </Hoja>
      <HojaTiempo abierta={hoja === "tiempo"} onCerrar={cerrarHoja} queda={queda} onAplicar={(m) => { setHoja(null); intentar(() => operar({ tipo: "tiempo_restante", minutos: m })); }} />
      <Hoja foco abierta={hoja === "corregir" && !!corrigiendo} onCerrar={() => { setHoja(null); setCorrigiendo(null); }} titulo={corrigiendo ? `Corregir serie ${corrigiendo.set_index} · ${nombre(corrigiendo.exercise_id)}` : ""} testid="hoja-corregir">
        {corrigiendo ? <CorregirSerie key={corrigiendo.id} serie={corrigiendo} onListo={(t) => { setHoja(null); setCorrigiendo(null); avisar(t); }} /> : null}
      </Hoja>
      <Hoja foco abierta={hoja === "cambios"} onCerrar={cerrarHoja} titulo="Cambios de hoy">
        <ul className="space-y-2 pb-2">
          {[...(sesion.changes || [])].reverse().map((c, i) => (
            <li key={i} className={cx("rounded-[14px] border px-4 py-3", c.by === "mama" ? "border-mama/40 bg-mama/15" : "border-foco-linea bg-foco-tarjeta")}>
              <p className={cx("text-xs font-bold", c.by === "mama" ? "text-[#BDB4FE]" : "text-foco-sec")}>{c.by === "mama" ? "MAMA" : "Tú"} · {new Date(c.at).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</p>
              <p>{c.cambio}</p>
            </li>
          ))}
        </ul>
      </Hoja>
      <HojaMenu abierta={hoja === "menu"} onCerrar={cerrarHoja} datos={datos} blocks={blocks} intentar={intentar} verCambios={() => setHoja("cambios")}
        actualRest={actual ? descansoActual : null} onRestActual={(s) => actual && intentar(() => operar({ tipo: "editar", item_id: actual.id, rest: s }))} />
      <HojaFin abierta={hoja === "fin"} onCerrar={cerrarHoja} res={res} sesion={sesion} cambioEstructural={cambioEstructural}
        onTerminar={(guardar) => {
          R.saltar();
          const r = finalizar({ guardar, cancelar: res.hechas === 0 });
          setHoja(null);
          if (r) setResultado({ ...r, guardado: guardar && r.hechas > 0 });
        }} />
    </Foco>
  );
}

function Foco({ children }: { children: React.ReactNode }) {
  return <div className="salud min-h-screen bg-foco text-foco-texto [color-scheme:dark]">{children}</div>;
}

function TarjetaDescanso({ d, ahora, oculto }: { d: R.Descanso; ahora: number; oculto?: boolean }) {
  const activo = d.hasta !== null || d.pausadoQueda !== null;
  if (!activo) {
    if (oculto) return null; // en el móvil sólo aparece cuando hay descanso
    return (
      <section className="rounded-[20px] border border-foco-linea bg-foco-tarjeta px-4 py-3 text-sm text-foco-sec" data-testid="descanso-inactivo">
        <span className="flex items-center gap-2"><Icono n="clock" size={18} />El descanso empieza solo al terminar cada serie.</span>
      </section>
    );
  }
  const restante = d.pausadoQueda !== null ? Math.round(d.pausadoQueda / 1000) : d.hasta ? Math.max(0, Math.ceil((d.hasta - ahora) / 1000)) : 0;
  const fin = restante === 0 && d.pausadoQueda === null;
  const fr = d.total ? Math.min(1, restante / d.total) : 0;
  return (
    <section className={cx("rounded-[20px] border p-4 sm:p-5", fin ? "border-foco-ok/40 bg-foco-ok/10" : "border-foco-linea bg-foco-tarjeta")} data-testid="descanso" aria-live="polite">
      <p className={cx("text-xs font-bold uppercase tracking-[0.05em]", fin ? "text-foco-ok" : "text-foco-sec")}>{fin ? "¡A por la siguiente!" : d.pausadoQueda !== null ? "Descanso en pausa" : "Descanso"}</p>
      <p className={cx("my-1 text-center text-[76px] font-extrabold leading-none tabular-nums sm:text-[88px]", fin ? "text-foco-ok" : "text-foco-texto")} data-testid="descanso-cuenta">{mmss(restante)}</p>
      <div className="mx-auto h-1.5 max-w-sm overflow-hidden rounded-full bg-[#243045]"><div className="h-full rounded-full bg-foco-acento" style={{ width: `${fr * 100}%` }} /></div>
      <p className="mt-2 text-center text-[15px] text-foco-texto">{d.etiqueta}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Chip foco onClick={() => R.sumar(-15)} data-testid="descanso-menos">−15 s</Chip>
        {d.pausadoQueda !== null ? <Chip foco icono="play" onClick={R.reanudarDescanso} data-testid="descanso-reanudar">Seguir</Chip> : <Chip foco icono="pause" onClick={R.pausarDescanso} data-testid="descanso-pausa">Pausa</Chip>}
        <Chip foco onClick={() => R.sumar(15)} data-testid="descanso-mas">+15 s</Chip>
        <Chip foco icono={d.silencio ? "volume-x" : "volume-2"} activo={d.silencio} onClick={() => { R.prepararAudio(); R.silenciar(!d.silencio); }} data-testid="descanso-silencio">{d.silencio ? "Silenciado" : "Sonido"}</Chip>
        <Chip foco icono="skip-forward" onClick={R.saltar} data-testid="descanso-saltar">Saltar</Chip>
      </div>
    </section>
  );
}

function Plan({ blocks, hechas, series, ej, actualId, onElegir, onCorregir, intentar }:
  { blocks: Bloque[]; hechas: Record<string, number>; series: Serie[]; ej: Datos["ej"]; actualId: string | null; onElegir: (id: string) => void; onCorregir: (s: Serie) => void;
    intentar: (f: () => string | void) => void }) {
  return (
    <section aria-label="Plan de hoy">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.05em] text-foco-sec">Plan de hoy · toca un ejercicio para hacerlo ahora</p>
      <ol className="space-y-2">
        {blocks.map((b) => (
          <li key={b.id} className={cx(b.kind === "superset" && "rounded-[18px] border border-foco-acento/30 p-1.5")}>
            {b.kind === "superset" ? <p className="px-2 pb-1 pt-1 text-xs font-bold uppercase tracking-[0.05em] text-foco-acento">Superserie · {b.rest_round} s por vuelta</p> : null}
            <ul className="space-y-1.5">
              {b.items.map((it) => {
                const h = hechas[it.id] || 0, omit = it.status === "omitido", act = it.id === actualId, hecho = !omit && h >= it.sets;
                const ss = series.filter((x) => x.item_id === it.id).sort((a, c) => a.set_index - c.set_index);
                return (
                  <li key={it.id} data-testid={`plan-${ej[it.exercise_id]?.slug ?? it.id}`}
                    className={cx("flex items-start gap-2 rounded-[14px] border p-2.5", act ? "border-foco-acento bg-[#17233a]" : "border-foco-linea bg-foco-tarjeta", omit && "opacity-50")}>
                    <button type="button" disabled={omit || hecho} onClick={() => onElegir(it.id)} className="min-w-0 flex-1 text-left">
                      <span className={cx("block font-semibold leading-snug", omit && "line-through")}>{ej[it.exercise_id]?.name ?? "Ejercicio"}</span>
                      <span className="block text-sm text-foco-sec">{omit ? "omitido" : `${h}/${it.sets} series · ${it.reps} reps${it.weight != null ? ` · ${kg(it.weight)}` : ""}`}</span>
                    </button>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="flex flex-wrap justify-end gap-1">
                        {Array.from({ length: Math.max(it.sets, h) }).map((_, k) => {
                          const se = ss[k];
                          return (
                            <button key={k} type="button" disabled={!se} onClick={() => se && onCorregir(se)} aria-label={se ? `Corregir serie ${k + 1}` : `Serie ${k + 1} pendiente`}
                              className={cx("h-7 min-w-7 rounded-full px-1.5 text-[11px] font-bold tabular-nums", se ? (se.source === "mama" ? "bg-mama text-white" : "bg-foco-ok text-foco") : "border border-foco-linea text-foco-sec")}>
                              {se ? `${num(se.weight)}×${se.reps}` : k + 1}
                            </button>
                          );
                        })}
                      </div>
                      {omit ? <button type="button" onClick={() => intentar(() => operar({ tipo: "restaurar", item_id: it.id }))} className="min-h-9 rounded-full px-3 text-sm font-semibold text-foco-acento">Recuperar</button> : (
                        <div className="flex gap-1">
                          <button type="button" aria-label="Subir" onClick={() => intentar(() => operar({ tipo: "mover", item_id: it.id, dir: -1 }))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#24314d]" data-testid={`subir-${ej[it.exercise_id]?.slug}`}><Icono n="chevron-up" size={18} /></button>
                          <button type="button" aria-label="Bajar" onClick={() => intentar(() => operar({ tipo: "mover", item_id: it.id, dir: 1 }))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#24314d]" data-testid={`bajar-${ej[it.exercise_id]?.slug}`}><Icono n="chevron-down" size={18} /></button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HojaTiempo({ abierta, onCerrar, queda, onAplicar }: { abierta: boolean; onCerrar: () => void; queda: number; onAplicar: (m: number) => void }) {
  const [otro, setOtro] = useState("");
  return (
    <Hoja foco abierta={abierta} onCerrar={onCerrar} titulo="¿Cuánto tiempo te queda?" testid="hoja-tiempo">
      <div className="space-y-4 pb-2">
        <p className="text-foco-sec">Se reorganiza sólo lo pendiente; lo ya hecho se conserva. Ahora quedan ~{queda} min.</p>
        <div className="flex flex-wrap gap-2">{[10, 15, 20, 30, 45].map((m) => <Chip foco key={m} onClick={() => onAplicar(m)} data-testid={`quedan-${m}`}>{m} min</Chip>)}</div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const m = Math.round(Number(otro)); if (m > 0) { setOtro(""); onAplicar(m); } }}>
          <input inputMode="numeric" value={otro} onChange={(e) => setOtro(e.target.value)} placeholder="Otro (min)" aria-label="Otros minutos"
            className="min-h-12 min-w-0 flex-1 rounded-[14px] border border-foco-linea bg-foco-tarjeta px-4 text-foco-texto outline-none focus:border-foco-acento" />
          <Boton type="submit" className="!bg-foco-acento">Aplicar</Boton>
        </form>
      </div>
    </Hoja>
  );
}

function HojaMenu({ abierta, onCerrar, datos, blocks, intentar, verCambios, actualRest, onRestActual }:
  { abierta: boolean; onCerrar: () => void; datos: Datos | null; blocks: Bloque[]; intentar: (f: () => string | void, ok?: string) => void; verCambios: () => void;
    actualRest: number | null; onRestActual: (s: number) => void }) {
  const ej = datos?.ej ?? {};
  const pe = datos ? M.pechoSemana(datos.sesiones, datos.sets, ej, { ajustes: datos.ajustes }) : null;
  const ajustar = (c: Record<string, boolean>, t: string) => intentar(() => { void conDatos((sb, _d, ctx) => D.guardarAjustes(sb, c, ctx)); return t; });
  return (
    <Hoja foco abierta={abierta} onCerrar={onCerrar} titulo="Más opciones" testid="hoja-menu">
      <div className="space-y-5 pb-2">
        {actualRest !== null ? (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.05em] text-foco-sec">Descanso de este ejercicio</p>
            <div className="flex flex-wrap gap-2">{[45, 60, 75, 90, 120, 150, 180].map((x) => <Chip foco key={x} activo={actualRest === x} onClick={() => { onCerrar(); onRestActual(x); }}>{x} s</Chip>)}</div>
          </div>
        ) : null}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.05em] text-foco-sec">Descanso de todos los ejercicios</p>
          <div className="flex flex-wrap gap-2">{[60, 75, 90, 120, 150].map((x) => <Chip foco key={x} onClick={() => { onCerrar(); intentar(() => operar({ tipo: "descanso_todos", rest: x })); }} data-testid={`desc-todos-${x}`}>{x} s</Chip>)}</div>
        </div>
        <div className="rounded-[14px] bg-foco-tarjeta px-4 [&_*]:!text-foco-texto">
          <Interruptor si={datos?.ajustes?.sound ?? true} onCambio={(v) => ajustar({ sound: v }, v ? "Sonido activado" : "Sonido desactivado")} etiqueta="Sonido al acabar el descanso" />
          <Interruptor si={datos?.ajustes?.vibration ?? true} onCambio={(v) => ajustar({ vibration: v }, v ? "Vibración activada" : "Vibración desactivada")} etiqueta="Vibración" />
          <Interruptor si={typeof Notification !== "undefined" && Notification.permission === "granted"} onCambio={() => { R.pedirNotificaciones(); onCerrar(); }}
            etiqueta="Aviso del sistema" detalle="Notificación al acabar el descanso con la pestaña en segundo plano" />
        </div>
        {pe && !pe.cumplido && (M.seriesPechoPlan(blocks, ej) as number) < (M.minimoPecho(datos?.ajustes) as number)
          ? <Boton tipo="foco" icono="plus" className="w-full" onClick={() => { onCerrar(); intentar(() => operar({ tipo: "incorporar_pecho" })); }} data-testid="incorporar-pecho">Añadir pecho (objetivo semanal)</Boton> : null}
        <Boton tipo="foco" icono="list" className="w-full" onClick={verCambios}>Ver cambios de hoy</Boton>
      </div>
    </Hoja>
  );
}

function HojaFin({ abierta, onCerrar, res, sesion, cambioEstructural, onTerminar }:
  { abierta: boolean; onCerrar: () => void; res: Resultado; sesion: Sesion; cambioEstructural: boolean; onTerminar: (guardar: boolean) => void }) {
  const [permanente, setPermanente] = useState(false);
  const titulo = res.hechas === 0 ? "No has registrado ninguna serie" : res.status === "completada" ? "¡Completado!" : `Parcial: ${res.hechas} de ${res.previstas} series (${Math.round(res.fraccion * 100)} %)`;
  return (
    <Hoja foco abierta={abierta} onCerrar={onCerrar} titulo="Terminar entrenamiento" testid="hoja-fin">
      <div className="space-y-4 pb-2" data-testid="fin">
        <p className="text-[22px] font-extrabold" data-testid="fin-resumen">{titulo}</p>
        <p className={cx("rounded-[14px] px-4 py-3", res.avanza ? "bg-foco-ok/15 text-foco-ok" : "bg-foco-tarjeta text-foco-texto")} data-testid="fin-motivo">{res.motivo}</p>
        {cambioEstructural && res.hechas > 0 && sesion.routine_id ? (
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.05em] text-foco-sec">Has cambiado la rutina hoy</p>
            <div role="radiogroup" aria-label="Qué hacer con los cambios" className="grid gap-2 sm:grid-cols-2">
              {[{ v: false, t: "Solo hoy", d: "Tu rutina no cambia" }, { v: true, t: "Guardar en mi rutina", d: "Los cambios de hoy pasan a la rutina" }].map((o) => (
                <button key={String(o.v)} type="button" role="radio" aria-checked={permanente === o.v} onClick={() => setPermanente(o.v)} data-testid={o.v ? "fin-permanente" : "fin-solo-hoy"}
                  className={cx("rounded-[14px] border px-4 py-3 text-left", permanente === o.v ? "border-foco-acento bg-[#17233a]" : "border-foco-linea bg-foco-tarjeta")}>
                  <span className="block font-semibold">{o.t}</span><span className="block text-sm text-foco-sec">{o.d}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <Boton grande className={cx("w-full", res.hechas === 0 ? "!bg-peligro" : "!bg-foco-acento")} icono="flag" onClick={() => onTerminar(permanente)} data-testid="fin-confirmar">
          {res.hechas === 0 ? "Descartar" : "Terminar y guardar"}</Boton>
        <Boton tipo="foco" className="w-full" onClick={onCerrar}>Seguir entrenando</Boton>
      </div>
    </Hoja>
  );
}

function CorregirSerie({ serie, onListo }: { serie: Serie; onListo: (t: string) => void }) {
  const [w, setW] = useState<number | null>(serie.weight);
  const [r, setR] = useState<number | null>(serie.reps);
  return (
    <div className="space-y-4 pb-2">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Paso foco etiqueta="Peso" sufijo="kg" decimales paso={PASO_KG} max={1000} valor={w} onCambio={setW} testid="corr-peso" />
        <Paso foco etiqueta="Repeticiones" max={500} valor={r} onCambio={(v) => setR(v === null ? null : Math.round(v))} testid="corr-reps" />
      </div>
      <Boton className="w-full !bg-foco-acento" icono="check" onClick={() => { corregirSerie(serie.id, w, r ?? 0); onListo("Serie corregida"); }} data-testid="corr-guardar">Guardar corrección</Boton>
      <Boton tipo="peligro" className="w-full" icono="trash" onClick={() => { deshacerSerie(serie.id); onListo("Serie borrada"); }} data-testid="corr-borrar">Borrar esta serie</Boton>
    </div>
  );
}
