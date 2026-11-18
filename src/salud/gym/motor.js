// GYM · MOTOR DETERMINISTA (Salud, fase 1). Sin IA, sin red, sin dependencias: lo usan IGUAL la app (FocoGravital) y MAMA
// (CEOPadre). Este fichero es BYTE A BYTE el mismo en APP/src/gym/motor.js y CEOPadre/src/gym-motor.js (lo comprueba
// la prueba de contrato de los dos lados): una sola lógica para adaptar, operar y recomendar.
//
// Modelo (jsonb en gym_routine.blocks y gym_session.plan.blocks):
//   bloque = { id, kind: 'single' | 'superset', rest_round (s, sólo superserie), items: [item] }
//   item   = { id, exercise_id, sets, reps, weight (kg o null), rest (s), priority 1|2|3, notes, status?, from_exercise_id? }
//   priority 1 = fundamental (lo último que se recorta), 3 = accesorio (lo primero).
//   status (sólo en sesiones): undefined/'pendiente' | 'omitido'. Las series HECHAS viven en gym_set y llegan como
//   `hechas` = { [item_id]: número de series hechas }: el motor nunca borra ni recorta por debajo de lo hecho.

export const VERSION_MOTOR = 1;
export const TRABAJO_SEG = 40;       // una serie (ejecución)
export const PREPARA_SEG = 60;       // preparar un ejercicio (máquina, discos)
export const TRANSICION_SEG = 15;    // cambio entre ejercicios dentro de una superserie
export const CALENTAMIENTO_MIN = 5;
export const DESCANSO_MIN = 60, DESCANSO_DEF = 90, SERIES_MIN = 2, SERIES_MAX = 5;
export const PIERNA = ['piernas', 'gluteos', 'gemelos'];
export const ANTAGONISTAS = { pecho: 'espalda', espalda: 'pecho', biceps: 'triceps', triceps: 'biceps', piernas: 'abdomen', hombros: 'abdomen' };
export const MODOS = ['normal', 'superseries'];

const clon = (x) => JSON.parse(JSON.stringify(x));
let n = 0;
/** Id corto para bloques/ítems (no requiere crypto). */
export const nuevoId = (p = 'i') => `${p}${Date.now().toString(36)}${(n++ % 1296).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const num = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const ent = (v, d, min = 0, max = 1e6) => Math.min(max, Math.max(min, Math.round(num(v, d))));

/** Ítems en orden, con el id de su bloque. */
export const itemsDe = (blocks) => (blocks || []).flatMap((b) => (b.items || []).map((it) => ({ ...it, block_id: b.id })));
const vivo = (it) => it.status !== 'omitido';
const hechasDe = (hechas, it) => Math.max(0, num(hechas?.[it.id], 0));

/** Deja un plan válido: ids, valores por defecto, prioridad por posición si falta, bloques vacíos fuera. */
export function normalizar(blocks, { descanso = DESCANSO_DEF, descansoSuperserie = DESCANSO_DEF } = {}) {
  let i = 0;
  const out = [];
  for (const b0 of Array.isArray(blocks) ? blocks : []) {
    const its = (Array.isArray(b0?.items) ? b0.items : []).filter((it) => it && it.exercise_id).map((it) => {
      const pos = i++;
      return { ...it, id: it.id || nuevoId('i'), exercise_id: String(it.exercise_id), sets: ent(it.sets, 3, 1, 20), reps: ent(it.reps, 10, 1, 100),
        weight: it.weight === null || it.weight === undefined || it.weight === '' ? null : Math.max(0, Math.round(num(it.weight, 0) * 4) / 4),
        rest: ent(it.rest, descanso, 0, 900), priority: ent(it.priority, pos < 2 ? 1 : pos < 4 ? 2 : 3, 1, 3), notes: String(it.notes || '').slice(0, 300) };
    });
    if (!its.length) continue;
    const kind = b0.kind === 'superset' && its.length > 1 ? 'superset' : 'single';
    if (kind === 'single' && its.length > 1) { for (const it of its) out.push({ id: nuevoId('b'), kind: 'single', items: [it] }); continue; }
    out.push({ id: b0.id || nuevoId('b'), kind, ...(kind === 'superset' ? { rest_round: ent(b0.rest_round, descansoSuperserie, 0, 900) } : {}), items: its });
  }
  return out;
}

// ---------------------------------------------------------------- duración

/** Segundos estimados. `hechas` → sólo lo que falta. Sin `hechas` (preparar) suma el calentamiento. */
export function estimarSegundos(blocks, hechas = null) {
  let s = hechas ? 0 : CALENTAMIENTO_MIN * 60;
  for (const b of blocks || []) {
    const its = (b.items || []).filter(vivo).map((it) => ({ it, faltan: Math.max(0, it.sets - (hechas ? hechasDe(hechas, it) : 0)) })).filter((x) => x.faltan > 0);
    if (!its.length) continue;
    if (b.kind === 'superset') {
      const rondas = Math.max(...its.map((x) => x.faltan));
      for (let r = 0; r < rondas; r++) {
        const en = its.filter((x) => x.faltan > r).length;
        s += en * TRABAJO_SEG + Math.max(0, en - 1) * TRANSICION_SEG + num(b.rest_round, DESCANSO_DEF);
      }
      s += its.length * PREPARA_SEG;
    } else for (const { it, faltan } of its) s += PREPARA_SEG + faltan * (TRABAJO_SEG + it.rest);
  }
  return s;
}
export const estimarMinutos = (blocks, hechas = null) => Math.round(estimarSegundos(blocks, hechas) / 60);

// ---------------------------------------------------------------- superseries

const musc = (ej, id) => ej?.[id]?.primary_muscle || '';
/** ¿Se pueden alternar a y b? Distinto músculo principal y no dos básicos de pierna (fatiga y máquinas grandes). */
export function compatibles(ej, a, b) {
  const ma = musc(ej, a.exercise_id), mb = musc(ej, b.exercise_id);
  if (!ma || !mb || ma === mb) return false;
  if (PIERNA.includes(ma) && PIERNA.includes(mb) && ej[a.exercise_id]?.kind === 'compuesto' && ej[b.exercise_id]?.kind === 'compuesto') return false;
  if (ma === 'cardio' || mb === 'cardio') return false;
  return true;
}
/** Agrupa ejercicios sueltos en superseries compatibles (antagonistas primero). Lo ya agrupado se respeta. */
export function aSuperseries(blocks, ej, { descansoSuperserie = DESCANSO_DEF, hechas = null } = {}) {
  const bs = clon(blocks);
  const sueltos = bs.map((b, i) => ({ b, i })).filter(({ b }) => b.kind !== 'superset' && b.items.length === 1 && vivo(b.items[0])
    && (!hechas || hechasDe(hechas, b.items[0]) < b.items[0].sets));
  const usado = new Set(), pares = [];
  for (const a of sueltos) {
    if (usado.has(a.i)) continue;
    let mejor = null, puntos = 0;
    for (const c of sueltos) {
      if (c.i <= a.i || usado.has(c.i) || !compatibles(ej, a.b.items[0], c.b.items[0])) continue;
      const p = (ANTAGONISTAS[musc(ej, a.b.items[0].exercise_id)] === musc(ej, c.b.items[0].exercise_id) ? 2 : 1) - (c.i - a.i) * 0.01;
      if (p > puntos) { puntos = p; mejor = c; }
    }
    if (mejor) { usado.add(a.i); usado.add(mejor.i); pares.push([a.i, mejor.i]); }
  }
  if (!pares.length) return { blocks: bs, cambios: [] };
  const quitar = new Set(pares.map(([, j]) => j)), cambios = [];
  for (const [i, j] of pares) {
    const A = bs[i].items[0], B = bs[j].items[0];
    bs[i] = { id: nuevoId('b'), kind: 'superset', rest_round: descansoSuperserie, items: [A, B] };
    cambios.push(`Superserie: ${nombre(ej, A.exercise_id)} + ${nombre(ej, B.exercise_id)}`);
  }
  return { blocks: bs.filter((_, k) => !quitar.has(k)), cambios };
}
/** Deshace todas las superseries (cada ejercicio vuelve a su bloque con su descanso propio). */
export function aNormal(blocks, ej) {
  const out = [], cambios = [];
  for (const b of clon(blocks)) {
    if (b.kind !== 'superset') { out.push(b); continue; }
    cambios.push(`Separada: ${b.items.map((it) => nombre(ej, it.exercise_id)).join(' + ')}`);
    for (const it of b.items) out.push({ id: nuevoId('b'), kind: 'single', items: [it] });
  }
  return { blocks: out, cambios };
}
export const nombre = (ej, id) => ej?.[id]?.name || 'ejercicio';

// ---------------------------------------------------------------- adaptación por tiempo

/**
 * Recorta o amplía hasta `minutos`. Orden de recorte (lo menos importante primero): series de accesorios (p3) a 2 → quitar
 * accesorios → series de p2 a 2 → descansos > 90 s a 90 → quitar p2 → series de fundamentales a 2 → descansos −15 s (mín. 60)
 * → quitar del final (siempre queda uno). Con `hechas` (sesión en marcha) sólo toca lo pendiente: un ejercicio con series hechas
 * nunca se borra (se cierra en lo hecho) y uno sin hacer se marca 'omitido' (queda en el historial).
 */
export function ajustarTiempo(blocks0, minutos, ej, { hechas = null, base = null } = {}) {
  let bs = clon(blocks0);
  const objetivo = Math.max(1, Math.round(num(minutos, 60))) * 60;
  const cambios = [];
  const est = () => estimarSegundos(bs, hechas);
  const h = (it) => (hechas ? hechasDe(hechas, it) : 0);
  const min = (it) => Math.max(SERIES_MIN, h(it));
  const todos = () => bs.flatMap((b) => b.items.map((it) => ({ b, it }))).filter(({ it }) => vivo(it));
  const pend = () => todos().filter(({ it }) => h(it) < it.sets);
  const ultimo = (xs) => xs[xs.length - 1];
  const quitar = ({ b, it }) => {
    if (h(it) > 0) { cambios.push(`${nombre(ej, it.exercise_id)}: se cierra en ${h(it)} series`); it.sets = h(it); return; }
    cambios.push(`Fuera: ${nombre(ej, it.exercise_id)}${it.priority === 3 ? ' (accesorio)' : ''}`);
    if (hechas) { it.status = 'omitido'; return; }
    b.items = b.items.filter((x) => x !== it);
    if (b.kind === 'superset' && b.items.length < 2) { b.kind = 'single'; delete b.rest_round; } // vuelve a su descanso propio
  };
  const menos = ({ it }) => { cambios.push(`${nombre(ej, it.exercise_id)}: ${it.sets}→${it.sets - 1} series`); it.sets -= 1; };
  const descansos = (tope, paso) => {
    let toca = false;
    for (const b of bs) {
      if (b.kind === 'superset' && num(b.rest_round, 0) > tope) { b.rest_round = Math.max(tope, paso ? b.rest_round - paso : tope); toca = true; }
      for (const it of b.items) if (b.kind !== 'superset' && it.rest > tope && h(it) < it.sets) { it.rest = Math.max(tope, paso ? it.rest - paso : tope); toca = true; }
    }
    return toca;
  };
  const sueltos = (xs) => xs.filter(({ b }) => b.kind !== 'superset'); // dentro de una superserie un ejercicio cuesta poco tiempo
  const pasos = [
    () => { const x = ultimo(pend().filter(({ it }) => it.priority === 3 && it.sets > min(it))); return x && (menos(x), true); },
    () => { const x = ultimo(sueltos(pend().filter(({ it }) => it.priority === 3))); return x && (quitar(x), true); },
    () => { const x = ultimo(pend().filter(({ it }) => it.priority === 2 && it.sets > min(it))); return x && (menos(x), true); },
    () => descansos(90, 0) && (cambios.push('Descansos largos a 90 s'), true),
    () => { const x = ultimo(sueltos(pend().filter(({ it }) => it.priority === 2))); return x && pend().length > 1 && (quitar(x), true); },
    () => { const x = ultimo(pend().filter(({ it }) => it.priority === 3)); return x && (quitar(x), true); },
    () => { const x = ultimo(pend().filter(({ it }) => it.priority === 1 && it.sets > min(it))); return x && (menos(x), true); },
    () => descansos(DESCANSO_MIN, 15) && (cambios.push('Descansos −15 s'), true),
    () => { const x = ultimo(pend().filter(({ it }) => it.priority === 2)); return x && pend().length > 1 && (quitar(x), true); },
    () => { const p = pend(); if (p.length > 1 || (hechas && p.length === 1 && todos().length > 0)) { quitar(ultimo(p)); return true; } return false; },
  ];
  let guard = 0;
  while (est() > objetivo && guard++ < 500) { if (!pasos.some((f) => f())) break; }
  // Ampliar (90 min sobre una rutina de 60): +1 serie a los fundamentales (máx. +2) y luego a p2 (máx. +1), sin pasarse.
  if (!hechas && est() < objetivo - 5 * 60) {
    const orig = Object.fromEntries(itemsDe(base || blocks0).map((it) => [it.id, it.sets]));
    for (const [p, extra] of [[1, 1], [2, 1], [3, 1], [1, 2]]) {
      let cambio = true;
      while (cambio && est() < objetivo - 3 * 60) {
        cambio = false;
        for (const { it } of todos()) {
          if (it.priority !== p || it.sets >= (orig[it.id] ?? it.sets) + extra || it.sets >= SERIES_MAX) continue;
          it.sets += 1;
          if (est() > objetivo) { it.sets -= 1; continue; }
          cambios.push(`${nombre(ej, it.exercise_id)}: +1 serie (${it.sets})`); cambio = true;
        }
      }
    }
  }
  bs = bs.filter((b) => b.items.length);
  for (const b of bs) if (b.kind === 'superset' && b.items.filter(vivo).length < 2 && !hechas) Object.assign(b, { kind: 'single', rest_round: undefined });
  return { blocks: bs, cambios: resumirCambios(cambios), minutos: Math.round(est() / 60), cabe: est() <= objetivo };
}
/** «X: 4→3» + «X: 3→2» = «X: 4→2»; «+1 serie» repetidos se suman. */
function resumirCambios(cs) {
  const series = new Map(), mas = new Map(), otros = [];
  for (const c of cs) {
    let m = /^(.*): (\d+)→(\d+) series$/.exec(c);
    if (m) { const p = series.get(m[1]); series.set(m[1], [p ? p[0] : m[2], m[3]]); continue; }
    m = /^(.*): \+1 serie \((\d+)\)$/.exec(c);
    if (m) { const p = mas.get(m[1]); mas.set(m[1], [(p ? p[0] : 0) + 1, m[2]]); continue; }
    if (!otros.includes(c)) otros.push(c);
  }
  const fuera = new Set(otros.filter((c) => c.startsWith('Fuera: ')).map((c) => c.slice(7).replace(/ \(accesorio\)$/, '')));
  return [...otros, ...[...series].filter(([k]) => !fuera.has(k)).map(([k, [a, b]]) => `${k}: ${a}→${b} series`),
    ...[...mas].map(([k, [x, t]]) => `${k}: +${x} serie${x > 1 ? 's' : ''} (${t})`)];
}

/** Qué cambió de un plan a otro, en frases cortas (lo que ve Antonio). Por ítem: fuera, series, peso, reps, descanso,
 *  sustituciones, añadidos; por bloque: superseries nuevas y separadas. */
export function diferencias(antes, despues, ej) {
  const A = Object.fromEntries(itemsDe(antes).map((it) => [it.id, it])), D = itemsDe(despues);
  const Dm = Object.fromEntries(D.map((it) => [it.id, it]));
  const out = [];
  const grupos = (bs) => new Set(bs.filter((b) => b.kind === 'superset').map((b) => b.items.map((it) => it.id).sort().join('+')));
  const ga = grupos(antes), gd = grupos(despues);
  for (const b of despues) if (b.kind === 'superset' && !ga.has(b.items.map((it) => it.id).sort().join('+'))) out.push(`Superserie: ${b.items.map((it) => nombre(ej, it.exercise_id)).join(' + ')}`);
  for (const b of antes) if (b.kind === 'superset' && !gd.has(b.items.map((it) => it.id).sort().join('+'))) out.push(`Separada: ${b.items.map((it) => nombre(ej, it.exercise_id)).join(' + ')}`);
  for (const a of Object.values(A)) {
    const d = Dm[a.id];
    if (!d || (d.status === 'omitido' && a.status !== 'omitido')) { out.push(`Fuera: ${nombre(ej, a.exercise_id)}${a.priority === 3 ? ' (accesorio)' : ''}`); continue; }
    if (d.exercise_id !== a.exercise_id) out.push(`${nombre(ej, a.exercise_id)} → ${nombre(ej, d.exercise_id)}`);
    if (d.status !== 'omitido' && a.status === 'omitido') out.push(`Vuelve: ${nombre(ej, d.exercise_id)}`);
    const n = nombre(ej, d.exercise_id), p = [];
    if (d.sets !== a.sets) p.push(`${a.sets}→${d.sets} series`);
    if (d.reps !== a.reps) p.push(`${a.reps}→${d.reps} reps`);
    if ((d.weight ?? null) !== (a.weight ?? null)) p.push(`${a.weight ?? '–'}→${d.weight ?? '–'} kg`);
    if (d.rest !== a.rest) p.push(`descanso ${a.rest}→${d.rest} s`);
    if (p.length) out.push(`${n}: ${p.join(', ')}`);
  }
  for (const d of D) if (!A[d.id]) out.push(`Añadido: ${nombre(ej, d.exercise_id)} ${d.sets}×${d.reps}`);
  return out;
}

/**
 * Sesión preparada a partir de una rutina: modalidad (superseries o normal) + tiempo. Si la rutina tiene una VARIANTE
 * preparada para esos minutos y modalidad (gym_routine.variants["30-normal"]), se usa tal cual (la crea o mejora MAMA).
 * Respuesta inmediata: no hay IA ni red.
 */
export function adaptar(rutina, { minutos = null, modo = 'normal' } = {}, ej = {}, ajustes = {}) {
  const base = normalizar(rutina?.blocks || [], ajustes);
  const baseMin = estimarMinutos(base);
  const objetivo = minutos ? Math.round(num(minutos, baseMin)) : null;
  const clave = objetivo ? `${objetivo}-${modo}` : null;
  const variante = clave && rutina?.variants?.[clave];
  if (variante && Array.isArray(variante.blocks) && variante.blocks.length) {
    const blocks = normalizar(variante.blocks, ajustes);
    return { blocks, minutos: estimarMinutos(blocks), base_minutos: baseMin, modo, variante: clave,
      cambios: [`Variante preparada de ${objetivo} min (${modo})${variante.nota ? `: ${variante.nota}` : ''}`], cabe: true };
  }
  const sup = (bs) => (modo === 'superseries' ? aSuperseries(bs, ej, ajustes).blocks
    : ajustes.separarEnNormal && bs.some((b) => b.kind === 'superset') ? aNormal(bs, ej).blocks : bs);
  const ajusta = (bs, m) => (m ? ajustarTiempo(bs, m, ej, { base }) : { blocks: bs, cabe: true });
  // Dos órdenes (agrupar y recortar / recortar, agrupar y recortar): gana el que cabe conservando más series.
  const opciones = [ajusta(sup(base), objetivo)];
  if (objetivo && modo === 'superseries') opciones.push(ajusta(sup(ajusta(base, Math.round(objetivo * 1.3)).blocks), objetivo));
  const series = (bs) => itemsDe(bs).filter(vivo).reduce((a, it) => a + it.sets, 0);
  const elegida = opciones.sort((a, b) => Number(b.cabe) - Number(a.cabe) || series(b.blocks) - series(a.blocks))[0];
  const blocks = elegida.blocks, cabe = elegida.cabe;
  const cambios = diferencias(base, blocks, ej);
  const minFinal = estimarMinutos(blocks);
  if (objetivo && minFinal < objetivo - 10) cambios.push(`La rutina completa da ${minFinal} min: para llegar a ${objetivo} añade ejercicios o guarda una variante`);
  const out = { blocks, minutos: estimarMinutos(blocks), base_minutos: baseMin, modo, variante: null, cambios, cabe };
  if (!cabe && modo === 'normal') out.sugerencia = 'superseries';
  return out;
}

// ---------------------------------------------------------------- qué toca ahora

/** Ítem que toca: en una superserie alterna (el que lleva menos series hechas de la vuelta); si no, el primero con series
 *  pendientes. null = todo hecho. */
export function itemActual(blocks, hechas = {}) {
  for (const b of blocks || []) {
    const pend = (b.items || []).filter((it) => vivo(it) && hechasDe(hechas, it) < it.sets);
    if (!pend.length) continue;
    if (b.kind !== 'superset') return pend[0];
    const min = Math.min(...pend.map((it) => hechasDe(hechas, it)));
    return pend.find((it) => hechasDe(hechas, it) === min) || pend[0];
  }
  return null;
}

// ---------------------------------------------------------------- operaciones (app y MAMA)

export const OPS = ['sustituir', 'mover', 'anadir', 'quitar', 'serie_mas', 'serie_menos', 'editar', 'unir', 'separar', 'modo',
  'tiempo_restante', 'descanso_todos', 'incorporar_pecho', 'restaurar'];

const buscarItem = (bs, id) => { for (const b of bs) for (const it of b.items) if (it.id === id) return { b, it }; return null; };

/**
 * Aplica UNA operación a un plan { blocks, mode }. Devuelve { plan, cambio } o lanza Error con un motivo legible.
 * Lo hecho (hechas) nunca se pierde: quitar un ejercicio con series hechas lo cierra; sustituirlo con series hechas lo
 * divide (lo hecho queda con el ejercicio original y lo pendiente pasa al nuevo).
 */
export function aplicarOp(plan0, op, { ej = {}, hechas = {}, ajustes = {} } = {}) {
  const plan = clon(plan0);
  plan.blocks = plan.blocks || [];
  const bs = plan.blocks;
  const t = op?.tipo;
  const ref = () => { const r = buscarItem(bs, op.item_id); if (!r) throw new Error('Ese ejercicio ya no está en la sesión'); return r; };
  const nh = (it) => hechasDe(hechas, it);
  let cambio = '';
  switch (t) {
    case 'sustituir': {
      const { b, it } = ref();
      if (!op.exercise_id || !ej[op.exercise_id]) throw new Error('Ejercicio sustituto desconocido');
      const de = nombre(ej, it.exercise_id), a = nombre(ej, op.exercise_id);
      if (nh(it) > 0 && nh(it) < it.sets) { // lo hecho se queda; lo pendiente, con el nuevo
        const nuevo = { ...clon(it), id: nuevoId('i'), exercise_id: op.exercise_id, from_exercise_id: it.exercise_id, sets: it.sets - nh(it), weight: op.weight ?? null };
        it.sets = nh(it);
        b.items.splice(b.items.indexOf(it) + 1, 0, nuevo);
        if (b.kind !== 'superset') { b.items = b.items.filter((x) => x !== nuevo); bs.splice(bs.indexOf(b) + 1, 0, { id: nuevoId('b'), kind: 'single', items: [nuevo] }); }
      } else if (nh(it) >= it.sets && it.sets > 0) throw new Error(`${de} ya está terminado`);
      else Object.assign(it, { from_exercise_id: it.from_exercise_id || it.exercise_id, exercise_id: op.exercise_id, weight: op.weight ?? null });
      cambio = `${de} → ${a}`; break;
    }
    case 'mover': {
      const { b } = ref();
      const i = bs.indexOf(b), j = i + (num(op.dir, 1) < 0 ? -1 : 1);
      if (j < 0 || j >= bs.length) throw new Error('No se puede mover más');
      [bs[i], bs[j]] = [bs[j], bs[i]];
      cambio = `Orden: ${nombre(ej, b.items[0].exercise_id)} ${j < i ? 'antes' : 'después'}`; break;
    }
    case 'anadir': {
      if (!op.exercise_id || !ej[op.exercise_id]) throw new Error('Ejercicio desconocido');
      const it = normalizar([{ items: [{ exercise_id: op.exercise_id, sets: op.sets ?? 3, reps: op.reps ?? 10, weight: op.weight ?? null,
        rest: op.rest ?? ej[op.exercise_id].default_rest ?? ajustes.descanso ?? DESCANSO_DEF, priority: op.priority ?? 2 }] }], ajustes)[0];
      const tras = op.after_item_id ? buscarItem(bs, op.after_item_id) : null;
      bs.splice(tras ? bs.indexOf(tras.b) + 1 : bs.length, 0, it);
      cambio = `Añadido: ${nombre(ej, op.exercise_id)} ${it.items[0].sets}×${it.items[0].reps}`; break;
    }
    case 'quitar': {
      const { b, it } = ref();
      if (nh(it) > 0) { it.sets = nh(it); cambio = `${nombre(ej, it.exercise_id)}: cerrado en ${nh(it)} series`; break; }
      if (op.borrar) { b.items = b.items.filter((x) => x !== it); if (!b.items.length) bs.splice(bs.indexOf(b), 1); else if (b.items.length < 2) b.kind = 'single'; }
      else it.status = 'omitido';
      cambio = `Fuera: ${nombre(ej, it.exercise_id)}`; break;
    }
    case 'restaurar': { const { it } = ref(); delete it.status; cambio = `Vuelve: ${nombre(ej, it.exercise_id)}`; break; }
    case 'serie_mas': { const { it } = ref(); it.sets = Math.min(20, it.sets + 1); delete it.status; cambio = `${nombre(ej, it.exercise_id)}: ${it.sets} series`; break; }
    case 'serie_menos': {
      const { it } = ref();
      if (it.sets - 1 < Math.max(1, nh(it))) throw new Error('No se pueden quitar series ya hechas');
      it.sets -= 1; cambio = `${nombre(ej, it.exercise_id)}: ${it.sets} series`; break;
    }
    case 'editar': {
      const { b, it } = ref();
      const partes = [];
      if (op.sets !== undefined && op.sets !== null) { const s = ent(op.sets, it.sets, Math.max(1, nh(it)), 20); partes.push(`${s} series`); it.sets = s; }
      if (op.reps !== undefined && op.reps !== null) { it.reps = ent(op.reps, it.reps, 1, 100); partes.push(`${it.reps} reps`); }
      if (op.weight !== undefined) { it.weight = op.weight === null || op.weight === '' ? null : Math.max(0, Math.round(num(op.weight, 0) * 4) / 4); partes.push(it.weight === null ? 'sin peso' : `${it.weight} kg`); }
      if (op.rest !== undefined && op.rest !== null) {
        const r = ent(op.rest, it.rest, 0, 900);
        if (b.kind === 'superset') b.rest_round = r; else it.rest = r;
        partes.push(`descanso ${r} s`);
      }
      if (op.notes !== undefined) it.notes = String(op.notes || '').slice(0, 300);
      if (op.priority !== undefined && op.priority !== null) it.priority = ent(op.priority, it.priority, 1, 3);
      cambio = `${nombre(ej, it.exercise_id)}: ${partes.join(', ') || 'editado'}`; break;
    }
    case 'unir': {
      const ids = Array.isArray(op.item_ids) ? op.item_ids : [];
      if (ids.length < 2) throw new Error('Elige dos o más ejercicios');
      const rs = ids.map((id) => buscarItem(bs, id));
      if (rs.some((r) => !r)) throw new Error('Ese ejercicio ya no está en la sesión');
      const its = rs.map((r) => r.it);
      const primero = Math.min(...rs.map((r) => bs.indexOf(r.b)));
      for (const r of rs) { r.b.items = r.b.items.filter((x) => !its.includes(x)); }
      const nuevo = { id: nuevoId('b'), kind: 'superset', rest_round: num(op.rest_round, ajustes.descansoSuperserie ?? DESCANSO_DEF), items: its };
      bs.splice(primero, 0, nuevo);
      plan.blocks = bs.filter((b) => b.items.length);
      for (const b of plan.blocks) if (b.kind === 'superset' && b.items.length < 2) b.kind = 'single';
      cambio = `Superserie: ${its.map((it) => nombre(ej, it.exercise_id)).join(' + ')}`; break;
    }
    case 'separar': {
      const r = op.block_id ? bs.find((b) => b.id === op.block_id) : buscarItem(bs, op.item_id)?.b;
      if (!r || r.kind !== 'superset') throw new Error('No es una superserie');
      const i = bs.indexOf(r);
      bs.splice(i, 1, ...r.items.map((it) => ({ id: nuevoId('b'), kind: 'single', items: [{ ...it, rest: it.rest || r.rest_round || DESCANSO_DEF }] })));
      cambio = `Separada: ${r.items.map((it) => nombre(ej, it.exercise_id)).join(' + ')}`; break;
    }
    case 'modo': {
      const modo = op.modo === 'superseries' ? 'superseries' : 'normal';
      const r = modo === 'superseries' ? aSuperseries(bs, ej, { ...ajustes, hechas }) : aNormal(bs, ej);
      plan.blocks = r.blocks; plan.mode = modo;
      cambio = r.cambios.length ? `Modalidad ${modo}: ${r.cambios.join('; ')}` : `Modalidad ${modo} (sin cambios posibles)`; break;
    }
    case 'tiempo_restante': {
      const m = ent(op.minutos, 15, 1, 300);
      const r = ajustarTiempo(bs, m, ej, { hechas });
      const dif = diferencias(bs, r.blocks, ej);
      plan.blocks = r.blocks;
      cambio = `Quedan ${m} min → ${r.minutos} min previstos${dif.length ? `: ${dif.join('; ')}` : ' (ya cabía)'}`; break;
    }
    case 'descanso_todos': {
      const s = ent(op.rest, DESCANSO_DEF, 0, 900);
      for (const b of bs) { if (b.kind === 'superset') b.rest_round = s; else for (const it of b.items) it.rest = s; }
      cambio = `Descansos a ${s} s`; break;
    }
    case 'incorporar_pecho': {
      const r = incorporarPecho(bs, ej, { minimo: ajustes.pechoSeries ?? 6, candidatos: op.candidatos, ajustes });
      plan.blocks = r.blocks; plan.adaptacion_pecho = true;
      cambio = r.cambios.join('; ') || 'Ya tenía pecho suficiente'; break;
    }
    default: throw new Error(`Operación desconocida: ${t}`);
  }
  plan.blocks = (plan.blocks || []).filter((b) => b.items.length);
  return { plan, cambio };
}

// ---------------------------------------------------------------- reglas configurables (gym_settings)

export const AVANCES = ['completa', 'principales', 'mitad'];
/** Reglas efectivas (rotación y pecho) a partir de los ajustes, con sus valores por defecto. */
export function reglas(aj = {}) {
  const a = aj || {};
  return {
    avance: AVANCES.includes(a.advance_rule) ? a.advance_rule : 'principales',
    pecho: { modo: a.chest_rule === 'series' ? 'series' : 'plan', fraccion: Math.min(1, Math.max(0.1, num(a.chest_fraction, 0.66))),
      suelo: ent(a.chest_floor, 3, 1, 40), series: ent(a.chest_min_sets, 6, 1, 40), sesiones: ent(a.chest_weekly_min, 1, 0, 7) },
  };
}
/** El criterio de pecho en palabras (para la app, la web y MAMA). */
export function criterioPecho(aj) {
  const p = reglas(aj).pecho;
  return p.modo === 'series' ? `una sesión real con ${p.series} o más series de pecho`
    : `una sesión real que haga al menos el ${Math.round(p.fraccion * 100)} % de las series de pecho que planeaba (mínimo ${p.suelo})`;
}
/** Series de pecho que debe tener un plan cuando se le incorpora pecho (adaptación). */
export const minimoPecho = (aj) => { const p = reglas(aj).pecho; return p.modo === 'series' ? p.series : 2 * p.suelo; };
/** Series de pecho HECHAS que necesita una sesión con ese plan para contar. */
export function pechoNecesario(planBlocks, ej, aj) {
  const p = reglas(aj).pecho;
  return p.modo === 'series' ? p.series : Math.max(p.suelo, Math.ceil(p.fraccion * seriesPechoPlan(planBlocks || [], ej)));
}
/** ¿Es una rutina «de pecho»? (la que el motor adelanta si el pecho de la semana va tarde). */
export function esRutinaPecho(blocks, ej, aj) {
  const bs = normalizar(blocks || []), p = reglas(aj).pecho, n = seriesPechoPlan(bs, ej);
  if (p.modo === 'series') return n >= p.series;
  return n >= 2 * p.suelo || (n >= p.suelo && itemsDe(bs).some((it) => it.priority === 1 && musc(ej, it.exercise_id) === 'pecho'));
}

// ---------------------------------------------------------------- pecho semanal

/** Series de pecho (músculo principal) de un plan. */
export const seriesPechoPlan = (blocks, ej) => itemsDe(blocks).filter((it) => vivo(it) && musc(ej, it.exercise_id) === 'pecho').reduce((s, it) => s + it.sets, 0);

/**
 * Asegura `minimo` series de pecho: primero sube series de los ejercicios de pecho que ya hay (hasta 4), y si no basta
 * añade al principio ejercicios de pecho (`candidatos` = ids, en orden de preferencia) como fundamentales. Es una ADAPTACIÓN.
 */
export function incorporarPecho(blocks0, ej, { minimo = 6, candidatos = null, ajustes = {} } = {}) {
  const bs = clon(blocks0), cambios = [];
  let falta = minimo - seriesPechoPlan(bs, ej);
  for (const b of bs) for (const it of b.items) {
    if (falta <= 0) break;
    if (vivo(it) && musc(ej, it.exercise_id) === 'pecho' && it.sets < 4) { const s = Math.min(4, it.sets + falta); falta -= s - it.sets; cambios.push(`${nombre(ej, it.exercise_id)}: ${it.sets}→${s} series`); it.sets = s; }
  }
  const lista = (candidatos && candidatos.length ? candidatos : Object.keys(ej).filter((id) => musc(ej, id) === 'pecho' && ej[id].kind === 'compuesto'))
    .filter((id) => ej[id] && !itemsDe(bs).some((it) => it.exercise_id === id && vivo(it)));
  const nuevos = [];
  for (const id of lista) {
    if (falta <= 0) break;
    const s = Math.min(4, Math.max(3, falta));
    nuevos.push(...normalizar([{ items: [{ exercise_id: id, sets: s, reps: 10, rest: ej[id].default_rest ?? ajustes.descanso ?? DESCANSO_DEF, priority: 1 }] }], ajustes));
    falta -= s; cambios.push(`Pecho añadido: ${nombre(ej, id)} ${s}×10`);
  }
  return { blocks: [...nuevos, ...bs], cambios, suficiente: falta <= 0 };
}

// ---------------------------------------------------------------- semanas (lunes a domingo, Europe/Madrid)

const FMT = (() => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }); } catch { return null; } })();
/** Día 'AAAA-MM-DD' en Madrid. */
export function diaMadrid(t = Date.now()) {
  const d = new Date(t);
  if (FMT) { const p = Object.fromEntries(FMT.formatToParts(d).map((x) => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}`; }
  return d.toISOString().slice(0, 10);
}
const sumarDias = (dia, k) => { const d = new Date(`${dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
/** Lunes de la semana del día. */
export const lunesDe = (dia) => sumarDias(dia, -((new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7));
/** Días que quedan de la semana contando hoy (lunes 7 … domingo 1). */
export const diasRestantes = (dia) => 7 - ((new Date(`${dia}T12:00:00Z`).getUTCDay() + 6) % 7);

/** Series de pecho HECHAS por sesión: sets = [{session_id, exercise_id, deleted_at}]. */
export function seriesPechoPorSesion(sets, ej) {
  const m = {};
  for (const s of sets || []) if (!s.deleted_at && musc(ej, s.exercise_id) === 'pecho') m[s.session_id] = (m[s.session_id] || 0) + 1;
  return m;
}

/**
 * Estado del objetivo de pecho en la semana de `ahora` (lunes a domingo, Madrid). Cuenta una sesión REAL (completada o
 * parcial) que cumpla el criterio de los ajustes (`criterioPecho`): por defecto, haber hecho al menos el 66 % de las
 * series de pecho que planeaba esa sesión, con un mínimo de 3 (una serie suelta no cumple). Nada programado cuenta.
 * Sin `ajustes` (llamadas antiguas) se usa el criterio fijo `minSeries`.
 */
export function pechoSemana(sesiones, sets, ej, { ahora = Date.now(), ajustes = null, minSeries = 6, minSesiones = 1 } = {}) {
  const aj = ajustes || { chest_rule: 'series', chest_min_sets: minSeries, chest_weekly_min: minSesiones };
  const R = reglas(aj).pecho;
  const hoy = diaMadrid(ahora), lunes = lunesDe(hoy), domingo = sumarDias(lunes, 6);
  const porSesion = seriesPechoPorSesion(sets, ej);
  const deSemana = (sesiones || []).filter((s) => ['completada', 'parcial'].includes(s.status) && s.started_at && diaMadrid(Date.parse(s.started_at)) >= lunes && diaMadrid(Date.parse(s.started_at)) <= domingo);
  const necesita = (s) => pechoNecesario(s.plan?.blocks, ej, aj);
  const validas = deSemana.filter((s) => (porSesion[s.id] || 0) >= necesita(s));
  const insuficientes = deSemana.filter((s) => (porSesion[s.id] || 0) > 0 && (porSesion[s.id] || 0) < necesita(s));
  return { lunes, domingo, hoy, objetivo: R.sesiones, min_series: R.modo === 'series' ? R.series : R.suelo, criterio: criterioPecho(aj), modo: R.modo,
    hechas: validas.length, cumplido: validas.length >= R.sesiones,
    sesiones: validas.map((s) => ({ id: s.id, dia: diaMadrid(Date.parse(s.started_at)), series: porSesion[s.id], necesarias: necesita(s), adaptada: !!s.chest_adaptation })),
    insuficientes: insuficientes.map((s) => ({ id: s.id, dia: diaMadrid(Date.parse(s.started_at)), series: porSesion[s.id], necesarias: necesita(s) })),
    series_semana: deSemana.reduce((a, s) => a + (porSesion[s.id] || 0), 0), dias_restantes: diasRestantes(hoy) };
}

// ---------------------------------------------------------------- rotación y siguiente rutina

/** Orden de rotación efectivo: el guardado (sólo rutinas vivas) + las vivas que falten, por fecha de creación. */
export function rotacion(ajustes, rutinas) {
  const vivas = (rutinas || []).filter((r) => !r.archived_at && !r.deleted_at);
  const ids = new Set(vivas.map((r) => r.id));
  const orden = (ajustes?.rotation || []).filter((id) => ids.has(id));
  for (const r of [...vivas].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) if (!orden.includes(r.id)) orden.push(r.id);
  return orden;
}

/**
 * Resultado al terminar: completada (todo lo previsto), parcial (algo) o cancelada (nada: abandonada, se descarta).
 * Si AVANZA la rotación lo decide la regla de los ajustes (advance_rule):
 *  · 'principales' (por defecto): completa, o parcial con TODOS los ejercicios principales (prioridad 1) hechos; sin
 *    principales marcados, parcial con al menos el 75 % de las series.
 *  · 'completa': sólo si se completa.   · 'mitad': completa o al menos el 50 % de las series (regla de 1.3.0).
 * Abrir o abandonar sin series nunca avanza.
 */
export function resultadoSesion(plan, hechas, aj = {}) {
  const its = itemsDe(plan?.blocks || []);
  const previstas = its.filter(vivo).reduce((s, it) => s + it.sets, 0);
  const hechasTot = its.reduce((s, it) => s + Math.min(hechasDe(hechas, it), Math.max(it.sets, hechasDe(hechas, it))), 0);
  const fr = previstas ? Math.min(1, hechasTot / previstas) : 0;
  const status = hechasTot === 0 ? 'cancelada' : hechasTot >= previstas ? 'completada' : 'parcial';
  const regla = reglas(aj).avance;
  const principales = its.filter((it) => vivo(it) && it.priority === 1);
  const principalesHechos = principales.length ? principales.every((it) => hechasDe(hechas, it) >= it.sets) : fr >= 0.75;
  let avanza = status === 'completada', motivo;
  if (status === 'cancelada') motivo = 'Sin series: se descarta y la rotación no avanza';
  else if (status === 'completada') motivo = 'Completa: la rotación pasa a la siguiente rutina';
  else {
    avanza = regla === 'mitad' ? fr >= 0.5 : regla === 'principales' ? principalesHechos : false;
    motivo = avanza
      ? (regla === 'mitad' ? 'Parcial con al menos la mitad de las series: la rotación avanza' : 'Parcial con los ejercicios principales hechos: la rotación avanza')
      : (regla === 'completa' ? 'Parcial: con tu regla sólo avanzan las sesiones completas; te volverá a tocar'
        : regla === 'principales' ? 'Parcial sin todos los ejercicios principales: no avanza, te volverá a tocar'
          : 'Menos de la mitad de las series: no avanza, te volverá a tocar');
  }
  return { status, previstas, hechas: hechasTot, fraccion: Math.round(fr * 100) / 100, avanza, motivo, regla, principales_hechos: principalesHechos };
}

const UN_DIA = 86_400_000;
/**
 * Qué toca. Por rotación: la que sigue a la última sesión que AVANZÓ. Pecho: si esta semana aún no se cumple y, al ritmo de
 * una sesión al día, la rutina de pecho no llegaría antes del domingo, se recomienda adelantarla; sin rutina de pecho se
 * recomienda incorporarlo (adaptación). Avisos de recuperación si los músculos principales se entrenaron hace < 48 h.
 */
export function siguiente({ ajustes = {}, rutinas = [], sesiones = [], sets = [], ej = {}, ahora = Date.now() } = {}) {
  const orden = rotacion(ajustes, rutinas);
  const porId = Object.fromEntries((rutinas || []).map((r) => [r.id, r]));
  const pecho = pechoSemana(sesiones, sets, ej, { ahora, ajustes });
  if (!orden.length) return { rutina_id: null, rotacion_id: null, motivo: 'Aún no hay rutinas: crea la primera', pecho, avisos: [], orden };
  const ult = [...(sesiones || [])].filter((s) => s.advances && orden.includes(s.routine_id))
    .sort((a, b) => String(b.ended_at || b.started_at).localeCompare(String(a.ended_at || a.started_at)))[0];
  let idx = ult ? (orden.indexOf(ult.routine_id) + 1) % orden.length : 0;
  if (ajustes.next_routine_id && orden.includes(ajustes.next_routine_id) && (!ult || String(ajustes.next_set_at || '') > String(ult.ended_at || ult.started_at || ''))) idx = orden.indexOf(ajustes.next_routine_id);
  const rot = orden[idx];
  let rutina_id = rot, motivo = ult ? `Sigue a ${porId[ult.routine_id]?.name || 'la última'} en la rotación` : 'Primera de la rotación';
  if (ajustes.next_routine_id === rot && ajustes.next_set_at && (!ult || String(ajustes.next_set_at) > String(ult.ended_at || ''))) motivo = 'Elegida a mano';
  const esPecho = (id) => esRutinaPecho(porId[id]?.blocks || [], ej, ajustes);
  pecho.rutina_pecho_id = orden.find(esPecho) || null;
  pecho.recomendar = null;
  if (!pecho.cumplido) {
    if (esPecho(rot)) motivo += ' · incluye el pecho de la semana';
    else if (!pecho.rutina_pecho_id) { pecho.recomendar = 'incorporar'; motivo += ' · no hay rutina de pecho: añade pecho a esta sesión'; }
    else {
      let k = 0; for (let j = 0; j < orden.length; j++) if (esPecho(orden[(idx + j) % orden.length])) { k = j; break; }
      if (k >= pecho.dias_restantes) {
        rutina_id = pecho.rutina_pecho_id; pecho.recomendar = 'adelantar';
        motivo = `Pecho pendiente esta semana y quedan ${pecho.dias_restantes} día${pecho.dias_restantes > 1 ? 's' : ''}: se adelanta ${porId[rutina_id]?.name || 'la de pecho'}`;
      }
    }
  }
  const avisos = [];
  const ultimoMusculo = {};
  for (const s of sets || []) { if (s.deleted_at) continue; const m = musc(ej, s.exercise_id); const t = Date.parse(s.done_at || 0); if (m && t > (ultimoMusculo[m] || 0)) ultimoMusculo[m] = t; }
  const musculos = [...new Set(itemsDe(normalizar(porId[rutina_id]?.blocks || [])).filter((it) => it.priority === 1).map((it) => musc(ej, it.exercise_id)).filter(Boolean))];
  for (const m of musculos) if (ultimoMusculo[m] && ahora - ultimoMusculo[m] < 2 * UN_DIA) avisos.push(`${m} entrenado hace ${Math.round((ahora - ultimoMusculo[m]) / 3_600_000)} h: recupera o baja la carga`);
  return { rutina_id, rotacion_id: rot, motivo, pecho, avisos, orden };
}

// ---------------------------------------------------------------- progreso (sólo datos reales)

/** 1RM estimado (Epley). */
export const e1rm = (peso, reps) => (peso > 0 && reps > 0 ? Math.round(peso * (1 + Math.min(reps, 30) / 30) * 10) / 10 : 0);

/**
 * Progreso con las series REALES (sets: {session_id, exercise_id, weight, reps, done_at, deleted_at}). Sin datos → vacío;
 * nunca se rellena. `desde` (ms) limita el periodo.
 */
export function progreso(sets, ej = {}, { desde = 0, hasta = Infinity } = {}) {
  const vivos = (sets || []).filter((s) => !s.deleted_at && Date.parse(s.done_at) >= desde && Date.parse(s.done_at) <= hasta)
    .sort((a, b) => String(a.done_at).localeCompare(String(b.done_at)));
  const porEj = {}, semanas = {};
  for (const s of vivos) {
    const w = num(s.weight, 0), r = num(s.reps, 0), dia = diaMadrid(Date.parse(s.done_at));
    const x = (porEj[s.exercise_id] ??= { exercise_id: s.exercise_id, nombre: nombre(ej, s.exercise_id), musculo: musc(ej, s.exercise_id), series: 0, volumen: 0, sesiones: new Set(), dias: {} });
    x.series++; x.volumen += w * r; x.sesiones.add(s.session_id);
    const d = (x.dias[dia] ??= { dia, peso_max: 0, reps_max: 0, e1rm: 0, volumen: 0, series: 0 });
    d.peso_max = Math.max(d.peso_max, w); d.reps_max = Math.max(d.reps_max, r); d.e1rm = Math.max(d.e1rm, e1rm(w, r)); d.volumen += w * r; d.series++;
    const sem = lunesDe(dia);
    const S = (semanas[sem] ??= { semana: sem, volumen: 0, series: 0, sesiones: new Set() });
    S.volumen += w * r; S.series++; S.sesiones.add(s.session_id);
  }
  const ejercicios = Object.values(porEj).map((x) => {
    const dias = Object.values(x.dias);
    const pr = (k) => dias.reduce((m, d) => (d[k] > (m?.[k] ?? -1) ? d : m), null);
    const primero = dias[0], ultimo = dias[dias.length - 1];
    return { exercise_id: x.exercise_id, nombre: x.nombre, musculo: x.musculo, series: x.series, sesiones: x.sesiones.size, volumen: Math.round(x.volumen),
      historial: dias.map((d) => ({ ...d, volumen: Math.round(d.volumen) })),
      // sin peso registrado (peso corporal o no anotado) = null, nunca «0 kg»
      record_peso: pr('peso_max')?.peso_max > 0 ? { kg: pr('peso_max').peso_max, dia: pr('peso_max').dia } : null,
      record_e1rm: pr('e1rm')?.e1rm > 0 ? { kg: pr('e1rm').e1rm, dia: pr('e1rm').dia } : null,
      primero: primero ? { dia: primero.dia, peso: primero.peso_max || null, e1rm: primero.e1rm || null } : null,
      ultimo: ultimo ? { dia: ultimo.dia, peso: ultimo.peso_max || null, reps: ultimo.reps_max, e1rm: ultimo.e1rm || null } : null,
      mejora_e1rm: primero && ultimo && dias.length > 1 && primero.e1rm > 0 && ultimo.e1rm > 0 ? Math.round((ultimo.e1rm - primero.e1rm) * 10) / 10 : null };
  }).sort((a, b) => b.series - a.series);
  return { ejercicios, semanas: Object.values(semanas).map((S) => ({ semana: S.semana, volumen: Math.round(S.volumen), series: S.series, sesiones: S.sesiones.size }))
    .sort((a, b) => a.semana.localeCompare(b.semana)), total_series: vivos.length };
}

// ---------------------------------------------------------------- análisis (para la app, la web y MAMA)

export const MUSCULOS_ANALISIS = ['pecho', 'espalda', 'piernas', 'gluteos', 'gemelos', 'hombros', 'biceps', 'triceps', 'abdomen'];
export const REFERENCIA_SERIES = { min: 10, max: 20 }; // orientativa: series semanales por músculo (no es una prescripción)
const r1 = (x) => Math.round(x * 10) / 10;
/**
 * Análisis de los últimos `dias` SÓLO con datos reales: sesiones (completas, parciales, abandonadas), frecuencia,
 * duración real, series por músculo (principal = 1, secundario = 0,5) por semana frente a la referencia orientativa
 * de 10–20, días desde el último estímulo, progresión por ejercicio (1RM ESTIMADO, sólo con peso anotado), estancados y
 * pecho semana a semana. Nada se rellena: sin datos, ceros y listas vacías.
 */
export function analisis({ sesiones = [], sets = [], ej = {}, ajustes = {} } = {}, { dias = 30, ahora = Date.now() } = {}) {
  const desde = ahora - dias * UN_DIA, semanas = Math.max(1, dias / 7);
  const enPeriodo = (sesiones || []).filter((s) => s.started_at && Date.parse(s.started_at) >= desde && Date.parse(s.started_at) <= ahora && !['activa', 'pausada'].includes(s.status));
  const reales = enPeriodo.filter((s) => s.status !== 'cancelada');
  const ids = new Set(reales.map((s) => s.id));
  const xs = (sets || []).filter((s) => !s.deleted_at && ids.has(s.session_id));
  const porM = {};
  for (const s of xs) {
    const e = ej[s.exercise_id]; if (!e) continue;
    const add = (m, w) => { const x = (porM[m] ??= { series: 0, directas: 0, ultimo: null }); x.series += w; if (w === 1) x.directas++; if (!x.ultimo || s.done_at > x.ultimo) x.ultimo = s.done_at; };
    add(e.primary_muscle, 1);
    for (const m of e.secondary_muscles || []) if (m !== e.primary_muscle) add(m, 0.5);
  }
  const musculos = MUSCULOS_ANALISIS.map((m) => {
    const x = porM[m] || { series: 0, directas: 0, ultimo: null }, sem = r1(x.series / semanas);
    return { musculo: m, series: r1(x.series), directas: x.directas, por_semana: sem, dias_desde: x.ultimo ? Math.floor((ahora - Date.parse(x.ultimo)) / UN_DIA) : null,
      nivel: x.series === 0 ? 'sin_trabajar' : sem < REFERENCIA_SERIES.min ? 'poco' : sem > REFERENCIA_SERIES.max ? 'mucho' : 'en_rango' };
  }).sort((a, b) => a.por_semana - b.por_semana);
  const p = progreso(xs, ej, { desde, hasta: ahora });
  const progresion = p.ejercicios.filter((e) => e.mejora_e1rm !== null).map((e) => ({ exercise_id: e.exercise_id, nombre: e.nombre, musculo: e.musculo, sesiones: e.sesiones,
    primero: e.primero, ultimo: e.ultimo, mejora_e1rm: e.mejora_e1rm, mejora_pct: e.primero?.e1rm ? r1((100 * e.mejora_e1rm) / e.primero.e1rm) : null }))
    .sort((a, b) => (b.mejora_pct ?? 0) - (a.mejora_pct ?? 0));
  const minutos = reales.filter((s) => s.ended_at).map((s) => Math.max(0, (Date.parse(s.ended_at) - Date.parse(s.started_at)) / 60000 - (s.paused_seconds || 0) / 60));
  const pechoSemanas = [];
  for (let t = ahora; t >= desde; t -= 7 * UN_DIA) {
    const pe = pechoSemana(sesiones, sets, ej, { ahora: t, ajustes });
    pechoSemanas.push({ semana: pe.lunes, cumplido: pe.cumplido, series: pe.series_semana });
  }
  return {
    periodo: { dias, desde: diaMadrid(desde), hasta: diaMadrid(ahora) },
    resumen: { sesiones: reales.length, completas: reales.filter((s) => s.status === 'completada').length, parciales: reales.filter((s) => s.status === 'parcial').length,
      abandonadas: enPeriodo.filter((s) => s.status === 'cancelada').length, por_semana: r1(reales.length / semanas), series: xs.length,
      minutos_medios: minutos.length ? Math.round(minutos.reduce((a, b) => a + b, 0) / minutos.length) : null },
    musculos, menos_trabajados: musculos.filter((m) => m.nivel === 'sin_trabajar' || m.nivel === 'poco').map((m) => m.musculo),
    progresion, estancados: progresion.filter((e) => e.sesiones >= 3 && e.mejora_e1rm <= 0).map((e) => e.nombre),
    pecho_semanas: pechoSemanas.reverse(), semanas: p.semanas,
    notas: ['1RM estimado con la fórmula de Epley a partir de peso y repeticiones anotados: es una estimación, no una medición.',
      `Referencia orientativa de volumen: ${REFERENCIA_SERIES.min}–${REFERENCIA_SERIES.max} series semanales por músculo; las de músculo secundario cuentan la mitad.`],
  };
}

/** Últimos resultados de un ejercicio (para proponer el peso y las reps de hoy). */
export function ultimosDe(sets, exerciseId, { excluirSesion = null, max = 5 } = {}) {
  const xs = (sets || []).filter((s) => !s.deleted_at && s.exercise_id === exerciseId && s.session_id !== excluirSesion)
    .sort((a, b) => String(b.done_at).localeCompare(String(a.done_at)));
  const ses = xs[0]?.session_id;
  return { ultima: ses ? xs.filter((s) => s.session_id === ses).sort((a, b) => a.set_index - b.set_index).map((s) => ({ peso: s.weight, reps: s.reps })) : [],
    dia: xs[0] ? diaMadrid(Date.parse(xs[0].done_at)) : null, recientes: xs.slice(0, max) };
}

// ---------------------------------------------------------------- alternativas (máquina ocupada)

/**
 * Sustitutos ordenados: los que la ficha marca como alternativa, luego mismo músculo y patrón con OTRO equipamiento,
 * luego mismo músculo. `ocupado` = equipamiento a evitar (por defecto, el del ejercicio actual).
 */
export function alternativas(id, ej, { ocupado = null, max = 8 } = {}) {
  const a = ej[id];
  if (!a) return [];
  const evita = ocupado ?? a.equipment;
  const marcadas = new Map((a.alternatives || []).map((x, i, xs) => [x, 4 + (xs.length - i) * 0.1])); // el orden de la ficha manda
  return Object.values(ej).filter((x) => x.id !== id && !x.archived_at && x.primary_muscle === a.primary_muscle)
    .map((x) => ({ x, p: (marcadas.get(x.slug) ?? marcadas.get(x.id) ?? 0) + (x.pattern && x.pattern === a.pattern ? 2 : 0) + (x.equipment !== evita ? 1 : -1) + (x.kind === a.kind ? 0.5 : 0) }))
    .sort((p, q) => q.p - p.p || String(p.x.name).localeCompare(String(q.x.name))).slice(0, max).map(({ x }) => x);
}

/** Búsqueda por nombre, alias, músculo, máquina o material (sin tildes ni mayúsculas). */
export const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function buscar(ej, texto, { musculo = null, max = 50 } = {}) {
  const t = sinTildes(texto).split(/\s+/).filter(Boolean);
  return Object.values(ej).filter((x) => !x.archived_at && (!musculo || x.primary_muscle === musculo)).map((x) => {
    const campos = [x.name, ...(x.aliases || []), x.primary_muscle, ...(x.secondary_muscles || []), x.equipment, x.pattern].map(sinTildes).join(' | ');
    const ok = t.every((p) => campos.includes(p));
    const q = t.join(' '), nom = sinTildes(x.name);
    return ok ? { x, p: ((x.aliases || []).some((a) => sinTildes(a) === q) || nom === q ? 4 : 0) + (nom.startsWith(q) ? 2 : 0) + (nom.includes(q) ? 1 : 0) + (x.user_id ? 0.5 : 0) } : null;
  }).filter(Boolean).sort((a, b) => b.p - a.p || (t.length ? String(a.x.name).length - String(b.x.name).length : 0) || String(a.x.name).localeCompare(String(b.x.name))).slice(0, max).map(({ x }) => x);
}
