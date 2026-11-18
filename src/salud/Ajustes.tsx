// SALUD · GYM · ajustes: duración y modalidad por defecto, descansos, sonido/vibración y las reglas de rotación y pecho.
"use client";

import { useState } from "react";
import * as D from "./gym/datos.js";
import * as M from "./gym/motor.js";
import { conDatos, type Ajustes } from "./store";
import { Boton, Chip, Etiqueta, Hoja, Interruptor, Paso, Segmento } from "./ui";

type Form = { default_minutes: number | null; default_mode: string; rest_default: number; rest_superset: number; sound: boolean; vibration: boolean;
  advance_rule: string; chest_rule: string; chest_fraction: number; chest_floor: number; chest_min_sets: number; chest_weekly_min: number };
// default_minutes es obligatorio en la base (10–240): no hay «Completa» como valor por defecto.
const DURACIONES = [30, 40, 60, 90].map((v) => ({ v: v as number | null, t: `${v} min` }));
const AVANCE = [
  { v: "principales", t: "Con los ejercicios principales", d: "Recomendado: avanza si completas, o si haces todos los ejercicios fundamentales." },
  { v: "completa", t: "Completa", d: "Sólo avanza si haces todas las series previstas." },
  { v: "mitad", t: "Con la mitad de las series", d: "Avanza si haces al menos el 50 % de las series." },
];

const formDe = (a: Ajustes): Form => {
  const r = M.reglas(a);
  return { default_minutes: a.default_minutes ?? 60, default_mode: a.default_mode || "normal", rest_default: a.rest_default ?? 90, rest_superset: a.rest_superset ?? 90,
    sound: a.sound ?? true, vibration: a.vibration ?? true, advance_rule: r.avance, chest_rule: r.pecho.modo, chest_fraction: r.pecho.fraccion, chest_floor: r.pecho.suelo,
    chest_min_sets: r.pecho.series, chest_weekly_min: r.pecho.sesiones };
};

export function HojaAjustes({ abierta, onCerrar, ajustes }: { abierta: boolean; onCerrar: () => void; ajustes: Ajustes | null }) {
  return (
    <Hoja abierta={abierta && !!ajustes} onCerrar={onCerrar} titulo="Ajustes de GYM" testid="ajustes">
      {ajustes ? <FormAjustes key={ajustes.rev} ajustes={ajustes} onListo={onCerrar} /> : null}
    </Hoja>
  );
}

function FormAjustes({ ajustes, onListo }: { ajustes: Ajustes; onListo: () => void }) {
  const [f, setF] = useState<Form>(() => formDe(ajustes));
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const p = (c: Partial<Form>) => setF({ ...f, ...c });
  const criterio = M.criterioPecho(f) as string;
  return (
    <div className="space-y-6 pb-2">
      <section className="space-y-3">
        <Etiqueta>Duración por defecto</Etiqueta>
        <Segmento etiqueta="Duración por defecto" opciones={DURACIONES.some((o) => o.v === f.default_minutes) ? DURACIONES : [...DURACIONES, { v: f.default_minutes, t: `${f.default_minutes} min` }]} valor={f.default_minutes} onCambio={(v) => p({ default_minutes: v })} testid="aj-min" />
        <Etiqueta>Modalidad por defecto</Etiqueta>
        <Segmento etiqueta="Modalidad por defecto" opciones={[{ v: "normal", t: "Normal" }, { v: "superseries", t: "Superseries" }]} valor={f.default_mode} onCambio={(v) => p({ default_mode: v })} testid="aj-modo" />
      </section>
      <section className="space-y-3">
        <Etiqueta>Descansos</Etiqueta>
        <div className="flex flex-wrap gap-3">
          <Paso etiqueta="Entre series" valor={f.rest_default} paso={15} min={15} max={600} sufijo="s" onCambio={(v) => p({ rest_default: v ?? 90 })} testid="aj-desc" />
          <Paso etiqueta="Por vuelta de superserie" valor={f.rest_superset} paso={15} min={15} max={600} sufijo="s" onCambio={(v) => p({ rest_superset: v ?? 90 })} />
        </div>
        <Interruptor si={f.sound} onCambio={(v) => p({ sound: v })} etiqueta="Sonido al acabar el descanso" />
        <Interruptor si={f.vibration} onCambio={(v) => p({ vibration: v })} etiqueta="Vibración" detalle="En los móviles que lo permiten" />
      </section>
      <section className="space-y-3">
        <Etiqueta>Cuándo pasa la rotación a la siguiente rutina</Etiqueta>
        <div className="grid gap-2">
          {AVANCE.map((a) => (
            <button key={a.v} type="button" role="radio" aria-checked={f.advance_rule === a.v} onClick={() => p({ advance_rule: a.v })} data-testid={`aj-avance-${a.v}`}
              className={`salud-anim rounded-[14px] border px-4 py-3 text-left ${f.advance_rule === a.v ? "border-acento bg-acento-suave" : "border-linea bg-superficie hover:bg-superficie2"}`}>
              <span className="block font-semibold">{a.t}</span><span className="block text-sm text-tinta2">{a.d}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <Etiqueta>Pecho de la semana</Etiqueta>
        <div className="flex flex-wrap gap-2">
          <Chip activo={f.chest_rule === "plan"} onClick={() => p({ chest_rule: "plan" })} data-testid="aj-pecho-plan">Según el plan</Chip>
          <Chip activo={f.chest_rule === "series"} onClick={() => p({ chest_rule: "series" })} data-testid="aj-pecho-series">Número fijo de series</Chip>
        </div>
        <div className="flex flex-wrap gap-3">
          {f.chest_rule === "plan" ? (
            <>
              <Paso etiqueta="Parte del pecho planeado" valor={Math.round(f.chest_fraction * 100)} paso={5} min={10} max={100} sufijo="%" onCambio={(v) => p({ chest_fraction: (v ?? 66) / 100 })} />
              <Paso etiqueta="Mínimo de series" valor={f.chest_floor} min={1} max={40} onCambio={(v) => p({ chest_floor: v ?? 3 })} />
            </>
          ) : <Paso etiqueta="Series de pecho" valor={f.chest_min_sets} min={1} max={40} onCambio={(v) => p({ chest_min_sets: v ?? 6 })} />}
          <Paso etiqueta="Sesiones por semana" valor={f.chest_weekly_min} min={0} max={7} onCambio={(v) => p({ chest_weekly_min: v ?? 1 })} />
        </div>
        <p className="rounded-[14px] bg-acento-suave px-4 py-3 text-sm text-acento-tinta">Cuenta {criterio}. Lo programado no cuenta; la semana va de lunes a domingo.</p>
      </section>
      {err ? <p role="alert" className="text-peligro-tinta">{err}</p> : null}
      <Boton grande className="w-full" icono="check" disabled={guardando} data-testid="aj-guardar" onClick={async () => {
        setGuardando(true); setErr(null);
        try {
          await conDatos((sb, _d, ctx) => D.guardarAjustes(sb, { ...f, chest_fraction: Math.round(f.chest_fraction * 100) / 100 }, ctx));
          onListo();
        } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setGuardando(false); }
      }}>{guardando ? "Guardando…" : "Guardar ajustes"}</Boton>
    </div>
  );
}
