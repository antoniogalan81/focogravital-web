"use client";
// SALUD · GYM · inicio: el siguiente entrenamiento listo para «Empezar». Duración y modalidad re-planifican al instante con
// el motor (sin IA ni red). Pecho de la semana visible. Escritorio en 2 columnas: entrenamiento | semana y accesos.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import * as D from "@/src/salud/gym/datos.js";
import * as M from "@/src/salud/gym/motor.js";
import { HojaAjustes } from "@/src/salud/Ajustes";
import { conDatos, empezar, useGym, vigilar, type Bloque, type Datos, type Item } from "@/src/salud/store";
import { Boton, Cargando, Chip, cx, diaCorto, Etiqueta, Icono, kg, Marco, Mini, MUSCULOS, Segmento, Tarjeta } from "@/src/salud/ui";

const TIEMPOS = [30, 40, 60, 90];
const PLANTILLA: { name: string; ej: [string, number, number, number?][] }[] = [
  { name: "A · Pecho y tríceps", ej: [["press-banca", 4, 8, 1], ["press-inclinado-mancuernas", 3, 10, 1], ["contractora", 3, 12, 2], ["fondos-pecho", 3, 10, 2], ["extension-triceps-polea", 3, 12, 3], ["press-frances", 3, 12, 3]] },
  { name: "B · Espalda y bíceps", ej: [["jalon-pecho", 4, 10, 1], ["remo-barra", 4, 8, 1], ["remo-polea-baja", 3, 12, 2], ["pullover-polea", 3, 12, 3], ["curl-barra", 3, 10, 2], ["curl-martillo", 3, 12, 3]] },
  { name: "C · Piernas", ej: [["sentadilla", 4, 8, 1], ["prensa", 3, 12, 1], ["peso-muerto-rumano", 3, 10, 2], ["curl-femoral-tumbado", 3, 12, 2], ["extension-cuadriceps", 3, 12, 3], ["gemelos-de-pie", 4, 15, 3]] },
  { name: "D · Hombros y abdomen", ej: [["press-militar", 4, 8, 1], ["elevaciones-laterales", 4, 15, 1], ["pajaros", 3, 15, 2], ["face-pull", 3, 15, 3], ["crunch-polea", 3, 15, 2], ["plancha", 3, 1, 3]] },
];
function crearPlantilla(datos: Datos) {
  const porSlug = Object.fromEntries(Object.values(datos.ej).filter((x) => !x.user_id).map((x) => [x.slug, x.id]));
  return conDatos(async (sb, _d, ctx) => {
    for (const r of PLANTILLA)
      await D.crearRutina(sb, { name: r.name, blocks: r.ej.filter(([slug]) => porSlug[slug]).map(([slug, sets, reps, priority]) => ({ items: [{ exercise_id: porSlug[slug], sets, reps, priority, rest: datos.ej[porSlug[slug]].default_rest ?? 90 }] })) }, ctx);
  });
}

type Eleccion = { rutina?: string; minutos?: number | null; modo?: string; pecho?: boolean };
type Plan = { blocks: Bloque[]; cambios: string[]; minutos: number; adaptacion_pecho: boolean; sugerencia?: string | null };

export default function InicioSalud() {
  const router = useRouter();
  const { datos, sesion, series, cola, sinRed } = useGym();
  useEffect(() => vigilar(), []);
  const [eleccion, setEleccion] = useState<Eleccion>({});
  const [otro, setOtro] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [ajustes, setAjustes] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sig = useMemo(() => (datos ? M.siguiente({ ...datos }) : null), [datos]);
  const hoy = useMemo(() => M.diaMadrid() as string, []);
  const prep = datos?.ajustes?.prepared && datos.ajustes.prepared.dia === hoy ? datos.ajustes.prepared : null;
  const rutinaId: string | null = eleccion.rutina ?? prep?.routine_id ?? sig?.rutina_id ?? null;
  const dePrep = !!prep && prep.routine_id === rutinaId;
  const minutos = eleccion.minutos !== undefined ? eleccion.minutos : dePrep ? prep!.minutes : null; // como en Android: abre con la rutina completa; el tiempo se elige con un toque
  const modo = eleccion.modo ?? (dePrep ? prep!.mode : datos?.ajustes?.default_mode) ?? "normal";
  const pecho = eleccion.pecho ?? (dePrep ? !!prep!.adaptacion_pecho : false);
  const usaPreparada = dePrep && prep!.minutes === minutos && prep!.mode === modo && !!prep!.adaptacion_pecho === pecho;

  const plan: Plan | null = useMemo(() => {
    if (!datos || !rutinaId || !datos.rutinas.some((r) => r.id === rutinaId)) return null;
    if (usaPreparada && prep) return { blocks: prep.blocks, cambios: prep.cambios || [], minutos: prep.estimado ?? M.estimarMinutos(prep.blocks), adaptacion_pecho: !!prep.adaptacion_pecho, sugerencia: null };
    return D.planPara(datos, { rutina_id: rutinaId, minutos, modo, pecho }) as Plan;
  }, [datos, rutinaId, minutos, modo, pecho, usaPreparada, prep]);
  // Medida: del toque en un segmento a la lista re-planificada en el DOM (performance.measure «salud:replan»).
  useEffect(() => {
    if (!performance.getEntriesByName("salud:replan:inicio").length) return;
    try { performance.measure("salud:replan", "salud:replan:inicio"); performance.clearMarks("salud:replan:inicio"); } catch { /* */ }
  }, [plan]);
  const elegir = (c: Eleccion) => { performance.mark("salud:replan:inicio"); setEleccion({ ...eleccion, ...c }); };

  if (!datos) return <Marco titulo="GYM"><Cargando /></Marco>;
  const rutinas = datos.rutinas.filter((r) => !r.archived_at);
  const nombreR = (id: string | null) => datos.rutinas.find((r) => r.id === id)?.name ?? "";
  const accion = <Boton tipo="secundario" icono="sliders" onClick={() => setAjustes(true)} data-testid="abrir-ajustes">Ajustes</Boton>;
  const hojaAjustes = <HojaAjustes abierta={ajustes} onCerrar={() => setAjustes(false)} ajustes={datos.ajustes} />;

  if (!rutinas.length && !sesion) {
    return (
      <Marco titulo="GYM" accion={accion}>
        <Tarjeta className="mx-auto max-w-2xl p-6 sm:p-8" data-testid="gym-vacio">
          <p className="text-[22px] font-extrabold">Empieza en un toque</p>
          <p className="mt-2 text-tinta2">Crea una rotación A·B·C·D (pecho y tríceps, espalda y bíceps, piernas, hombros y abdomen) y ajústala luego a tu gusto, o crea tu propia rutina.</p>
          {err ? <p role="alert" className="mt-3 text-peligro-tinta">{err}</p> : null}
          <div className="mt-6 flex flex-wrap gap-3">
            <Boton grande icono="zap" disabled={creando} data-testid="gym-plantilla" onClick={async () => {
              setCreando(true); setErr(null);
              try { await crearPlantilla(datos); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setCreando(false); }
            }}>{creando ? "Creando…" : "Crear rotación A·B·C·D"}</Boton>
            <Link href="/salud/rutinas?nueva=1" className="inline-flex min-h-[58px] items-center gap-2 rounded-[14px] border border-linea bg-superficie px-6 font-semibold hover:bg-superficie2"><Icono n="plus" />Crear mi rutina</Link>
          </div>
        </Tarjeta>
        {hojaAjustes}
      </Marco>
    );
  }

  const pe = sig?.pecho;
  const derecha = (
    <div className="space-y-3">
      {pe ? <TarjetaPecho pe={pe} /> : null}
      <Semana datos={datos} />
      <nav aria-label="Accesos" className="grid grid-cols-2 gap-3">
        {[{ h: "/salud/rutinas", t: "Rutinas", d: `${rutinas.length} en rotación`, i: "list" }, { h: "/salud/historial", t: "Historial", d: "Sesiones y progreso", i: "trending-up" },
          { h: "/salud/ejercicios", t: "Ejercicios", d: "Catálogo visual", i: "activity" }, { h: "/salud/biblioteca", t: "Biblioteca", d: "Tus libros", i: "book" }].map((a) => (
          <Link key={a.h} href={a.h} className="salud-anim flex min-h-[92px] flex-col justify-between rounded-[20px] border border-linea bg-superficie p-4 hover:bg-superficie2">
            <Icono n={a.i} className="text-acento" size={22} />
            <span><span className="block font-bold">{a.t}</span><span className="block text-sm text-tinta2">{a.d}</span></span>
          </Link>
        ))}
      </nav>
    </div>
  );

  if (sesion) {
    const res = M.resultadoSesion(sesion.plan, D.hechasDe(series, sesion.id), datos.ajustes);
    return (
      <Marco titulo="GYM" accion={accion}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6">
          <Tarjeta className="border-2 border-acento" data-testid="gym-en-curso">
            <Etiqueta className="text-acento-tinta">{sesion.status === "pausada" ? "En pausa" : "Entrenamiento en curso"}</Etiqueta>
            <p className="mt-1 text-[28px] font-extrabold leading-tight">{sesion.routine_name}</p>
            <p className="mt-1 text-tinta2">{res.hechas} de {res.previstas} series · {sesion.mode === "superseries" ? "superseries" : "normal"}{sesion.updated_by === "mama" ? " · último cambio de MAMA" : ""}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-superficie2"><div className="h-full rounded-full bg-ok" style={{ width: `${Math.round((res.fraccion || 0) * 100)}%` }} /></div>
            <Boton grande icono="play" className="mt-5 w-full" data-testid="gym-continuar" onClick={() => router.push("/salud/sesion")}>Continuar entrenamiento</Boton>
          </Tarjeta>
          {derecha}
        </div>
        {hojaAjustes}
      </Marco>
    );
  }

  const seriesPecho = plan ? (M.seriesPechoPlan(plan.blocks, datos.ej) as number) : 0;
  const musculos = plan ? [...new Set((M.itemsDe(plan.blocks) as Item[]).filter((it) => it.status !== "omitido").map((it) => datos.ej[it.exercise_id]?.primary_muscle).filter(Boolean))] : [];
  const nEj = plan ? (M.itemsDe(plan.blocks) as Item[]).filter((it) => it.status !== "omitido").length : 0;
  const otroActivo = minutos !== null && !TIEMPOS.includes(minutos);
  const ofrecerPecho = pe && !pe.cumplido && (pecho || seriesPecho < (M.minimoPecho(datos.ajustes) as number));
  const fijarOtro = () => { const v = Math.round(Number(otro)); if (v >= 5 && v <= 240) elegir({ minutos: v }); setOtro(null); };

  return (
    <Marco titulo="GYM" subtitulo={sig ? <span>{sig.motivo}</span> : null} accion={accion}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-6">
        <div className="space-y-3">
          <Tarjeta className="p-5 sm:p-6" data-testid="gym-siguiente">
            <Etiqueta className="text-acento-tinta">{eleccion.rutina ? "Elegida ahora" : usaPreparada ? `Preparada por ${prep!.by === "mama" ? "MAMA" : "ti"}` : "Te toca"}</Etiqueta>
            <h2 data-testid="gym-siguiente-nombre" className="mt-1 text-[28px] font-extrabold leading-tight">{nombreR(rutinaId)}</h2>
            {usaPreparada && prep!.by === "mama" ? <p className="mt-1 inline-flex rounded-full bg-mama-suave px-3 py-1 text-sm font-semibold text-mama-tinta">MAMA · {prep!.motivo || "preparada para hoy"}</p> : null}
            {musculos.length ? <div className="mt-3 flex flex-wrap gap-1.5">{musculos.map((m) => <span key={m} className="rounded-full bg-superficie2 px-3 py-1 text-sm font-semibold text-tinta2">{MUSCULOS[m] ?? m}</span>)}</div> : null}
            {(sig?.avisos ?? []).map((a: string) => <p key={a} className="mt-3 flex items-start gap-2 rounded-[14px] bg-aviso-suave px-3 py-2 text-sm text-aviso-tinta"><Icono n="alert" size={16} className="mt-0.5" />{a}</p>)}

            <div className="mt-5 grid gap-3 sm:grid-cols-[auto_auto] sm:justify-start sm:gap-x-6">
              <div>
                <Etiqueta className="mb-1.5">Tiempo</Etiqueta>
                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <Segmento lleno etiqueta="Tiempo disponible" testid="gym-t" valor={otroActivo ? -1 : minutos}
                    opciones={[{ v: null, t: "Completa" }, ...TIEMPOS.map((t) => ({ v: t as number | null, t: String(t) })), { v: -1, t: otroActivo ? `${minutos} min` : "Otro" }]}
                    onCambio={(v) => (v === -1 ? setOtro(otroActivo ? String(minutos) : "") : elegir({ minutos: v }))} />
                  {otro !== null ? (
                    <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); fijarOtro(); }}>
                      <input autoFocus inputMode="numeric" aria-label="Minutos" data-testid="gym-t-otro-input" value={otro} onChange={(e) => setOtro(e.target.value)} onBlur={fijarOtro}
                        placeholder="min" className="h-10 w-20 rounded-full border border-linea bg-superficie px-3 text-center font-semibold outline-none focus:border-acento" />
                    </form>
                  ) : null}
                </div>
              </div>
              <div>
                <Etiqueta className="mb-1.5">Modalidad</Etiqueta>
                <Segmento etiqueta="Modalidad" testid="gym-m" valor={modo} opciones={[{ v: "normal", t: "Normal" }, { v: "superseries", t: "Superseries" }]} onCambio={(v) => elegir({ modo: v })} />
              </div>
            </div>
            {ofrecerPecho ? <Chip className="mt-3" tono="aviso" activo={pecho} icono="plus" data-testid="gym-pecho-anadir" onClick={() => elegir({ pecho: !pecho })}>{pecho ? "Con pecho de la semana" : "Añadir pecho de la semana"}</Chip> : null}

            {plan ? (
              <>
                <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span data-testid="gym-duracion" className="text-[34px] font-extrabold tabular-nums leading-none">{plan.minutos} min</span>
                  <span className="text-tinta2">{nEj} ejercicios · {modo === "superseries" ? "superseries" : "normal"} · {seriesPecho ? `${seriesPecho} series de pecho` : "sin pecho"}</span>
                </div>
                {plan.cambios.length ? (
                  <div data-testid="gym-cambios" className="mt-3 rounded-[14px] bg-acento-suave px-4 py-3">
                    <p className="text-sm font-bold text-acento-tinta">Qué cambia</p>
                    <ul className="mt-1 space-y-0.5 text-[15px]">{plan.cambios.map((c, i) => <li key={i}>· {c}</li>)}</ul>
                  </div>
                ) : null}
                {plan.sugerencia === "superseries" ? <p className="mt-2 text-sm font-medium text-aviso-tinta">No cabe del todo en {minutos} min: prueba Superseries.</p> : null}
                <ListaPlan blocks={plan.blocks} datos={datos} />
              </>
            ) : null}
            <div className="sticky bottom-3 z-10 mt-5 rounded-[18px] bg-superficie/90 pt-1 backdrop-blur lg:static lg:bg-transparent lg:backdrop-blur-none">
              <Boton grande icono="play" className="w-full" data-testid="gym-empezar" disabled={!plan || !plan.blocks.length} onClick={() => {
                if (!plan) return;
                empezar({ rutina_id: rutinaId, minutos, modo, plan: { blocks: plan.blocks, cambios: plan.cambios, adaptacion_pecho: plan.adaptacion_pecho } });
                router.push("/salud/sesion");
              }}>Empezar entrenamiento</Boton>
            </div>
            {sinRed || cola.length ? <p className="mt-2 text-center text-sm text-tinta2">{sinRed ? "Sin conexión: se guarda en este navegador y se sube al volver la red" : `Subiendo ${cola.length} cambio(s)…`}</p> : null}
          </Tarjeta>
          <div>
            <Etiqueta className="mb-2">Otra rutina de la rotación</Etiqueta>
            <div className="flex flex-wrap gap-2">
              {(M.rotacion(datos.ajustes, rutinas) as string[]).map((id) => (
                <Chip key={id} activo={rutinaId === id} onClick={() => elegir({ rutina: id })} data-testid={`gym-r-${id}`}>{nombreR(id)}</Chip>
              ))}
            </div>
          </div>
        </div>
        {derecha}
      </div>
      {hojaAjustes}
    </Marco>
  );
}

function ListaPlan({ blocks, datos }: { blocks: Bloque[]; datos: Datos }) {
  return (
    <ol className="mt-4 space-y-2" data-testid="gym-plan">
      {blocks.map((b) => (
        <li key={b.id} className={cx(b.kind === "superset" && "rounded-[16px] border border-acento/30 bg-acento-suave/50 p-2")}>
          {b.kind === "superset" ? <p className="px-1 pb-1 text-xs font-bold uppercase tracking-[0.05em] text-acento-tinta">Superserie · descanso {b.rest_round} s por vuelta</p> : null}
          <ul className="space-y-2">
            {b.items.filter((it) => it.status !== "omitido").map((it) => {
              const e = datos.ej[it.exercise_id];
              return (
                <li key={it.id} className="flex items-center gap-3 rounded-[14px] border border-linea bg-superficie px-3 py-2">
                  <Mini e={e} className="h-14 w-14 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">{e?.name ?? "Ejercicio"}</p>
                    <p className="text-sm text-tinta2">{MUSCULOS[e?.primary_muscle] ?? ""}{it.priority === 1 ? " · principal" : it.priority === 3 ? " · accesorio" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{it.sets}×{it.reps}</p>
                    <p className="text-sm tabular-nums text-tinta2">{it.weight != null ? kg(it.weight) : ""}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}

type Pecho = { cumplido: boolean; hechas: number; objetivo: number; dias_restantes: number; criterio: string; sesiones: { dia: string }[]; insuficientes: unknown[]; recomendar: string | null; series_semana: number };
function TarjetaPecho({ pe }: { pe: Pecho }) {
  return (
    <Tarjeta data-testid="gym-pecho" className={pe.cumplido ? "border-ok/30 bg-ok-suave" : "border-aviso/30 bg-aviso-suave"}>
      <div className="flex items-start gap-3">
        <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-full text-white", pe.cumplido ? "bg-ok" : "bg-aviso")}><Icono n={pe.cumplido ? "check" : "clock"} /></span>
        <div className="min-w-0">
          <p className={cx("font-bold", pe.cumplido ? "text-ok-tinta" : "text-aviso-tinta")}>Pecho esta semana: {pe.cumplido ? "cumplido" : "pendiente"} · {pe.hechas}/{pe.objetivo}</p>
          <p className="mt-0.5 text-sm text-tinta2">
            {pe.cumplido ? `Hecho el ${pe.sesiones.map((x) => diaCorto(x.dia)).join(", ")}.` : `Quedan ${pe.dias_restantes} día${pe.dias_restantes > 1 ? "s" : ""} (lunes a domingo).`} Cuenta {pe.criterio}.
            {pe.insuficientes.length ? ` ${pe.insuficientes.length} sesión con pecho insuficiente.` : ""}
          </p>
          {!pe.cumplido && pe.recomendar === "adelantar" ? <p className="mt-1 text-sm font-semibold text-aviso-tinta">Se adelanta la rutina de pecho para llegar a tiempo.</p> : null}
          {!pe.cumplido && pe.recomendar === "incorporar" ? <p className="mt-1 text-sm font-semibold text-aviso-tinta">No hay rutina de pecho: añade pecho a la sesión de hoy.</p> : null}
        </div>
      </div>
    </Tarjeta>
  );
}

function Semana({ datos }: { datos: Datos }) {
  const r = useMemo(() => {
    const lunes = M.lunesDe(M.diaMadrid()) as string;
    const ses = datos.sesiones.filter((s) => ["completada", "parcial"].includes(s.status) && (M.diaMadrid(Date.parse(s.started_at)) as string) >= lunes);
    const ids = new Set(ses.map((s) => s.id));
    return { sesiones: ses.length, series: datos.sets.filter((x) => ids.has(x.session_id) && !x.deleted_at).length };
  }, [datos]);
  return (
    <Tarjeta>
      <Etiqueta>Esta semana</Etiqueta>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <div><p className="text-[28px] font-extrabold tabular-nums leading-none">{r.sesiones}</p><p className="text-sm text-tinta2">entrenamientos</p></div>
        <div><p className="text-[28px] font-extrabold tabular-nums leading-none">{r.series}</p><p className="text-sm text-tinta2">series hechas</p></div>
      </div>
    </Tarjeta>
  );
}
