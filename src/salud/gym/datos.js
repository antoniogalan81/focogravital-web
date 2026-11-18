// GYM · DATOS. Las MISMAS operaciones para la app y para MAMA, sobre el Supabase de FocoGravital con la sesión del dueño
// (RLS). Este fichero es BYTE A BYTE igual en APP/src/gym/datos.js y CEOPadre/src/gym/datos.js (prueba de contrato).
//  · Nada de IA: la lógica es la del motor (./motor.js).
//  · Concurrencia app ⇄ MAMA: comparar-y-escribir con `rev` (UPDATE … WHERE rev = n); si otro escribió antes, se relee y se
//    vuelve a aplicar la OPERACIÓN (no el resultado) sobre lo último: nada se pisa.
//  · Idempotencia: ids de sesión y de serie del cliente; reintentar no duplica.
//  · Cada cambio deja rastro en gym_change (quién: app | mama, qué y resumen legible).
import * as M from './motor.js';

const CAS_MAX = 6;
const DIA_MS = 86_400_000;
export class GymError extends Error {}
const fallo = (m) => new GymError(m);
function ok(r, donde) {
  if (r.error) { const e = fallo(`${donde}: ${r.error.message || r.error.code}`); e.code = r.error.code; e.status = r.status; throw e; }
  return r.data;
}
export const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

async function anotar(sb, entity, entity_id, action, by, summary, detail = {}) {
  const r = await sb.from('gym_change').insert({ entity, entity_id: entity_id ? String(entity_id) : null, action, by_who: by, summary: String(summary || '').slice(0, 2000), detail });
  if (r.error) console.warn?.('[gym] registro de cambio no guardado', r.error.message); // el cambio ya está hecho: no se deshace por el registro
}

/** Comparar-y-escribir: lee, `cambiar(fila)` devuelve {parche, resumen} (o lanza), escribe WHERE rev; reintenta si otro ganó. */
async function cas(sb, tabla, filtro, cambiar, { by }) {
  for (let i = 0; i < CAS_MAX; i++) {
    let q = sb.from(tabla).select('*');
    for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v);
    const fila = ok(await q.maybeSingle(), `leer ${tabla}`);
    if (!fila) throw fallo('No existe (o no es tuyo)');
    const res = await cambiar(fila);
    if (!res) return { fila, resumen: '' };
    let u = sb.from(tabla).update({ ...res.parche, rev: fila.rev + 1, updated_by: by });
    for (const [k, v] of Object.entries(filtro)) u = u.eq(k, v);
    const filas = ok(await u.eq('rev', fila.rev).select('*'), `guardar ${tabla}`);
    if (filas.length) return { fila: filas[0], resumen: res.resumen, extra: res.extra };
  }
  throw fallo('Otro cambio a la vez: inténtalo otra vez');
}

// ---------------------------------------------------------------- lectura

/** Catálogo (común + personalizados) como mapa id → ejercicio. */
export async function ejercicios(sb) {
  const xs = ok(await sb.from('gym_exercise').select('*').order('name').limit(2000), 'leer ejercicios');
  return Object.fromEntries(xs.map((x) => [x.id, x]));
}
/** Ajustes del usuario; si no hay, se crean con los valores por defecto. */
export async function ajustes(sb) {
  const a = ok(await sb.from('gym_settings').select('*').maybeSingle(), 'leer ajustes');
  if (a) return a;
  const r = await sb.from('gym_settings').insert({}).select('*');
  if (r.error && r.error.code !== '23505') ok(r, 'crear ajustes');
  return ok(await sb.from('gym_settings').select('*').single(), 'leer ajustes');
}
/** Todo lo necesario para la pantalla y para MAMA. `dias` = historial que se trae (por defecto 10 años). */
export async function cargar(sb, { dias = 3650 } = {}) {
  const desde = new Date(Date.now() - dias * DIA_MS).toISOString();
  const [ej, aj, rutinas, sesiones, sets] = await Promise.all([
    ejercicios(sb), ajustes(sb),
    sb.from('gym_routine').select('*').is('deleted_at', null).order('created_at').then((r) => ok(r, 'leer rutinas')),
    sb.from('gym_session').select('*').gte('started_at', desde).order('started_at', { ascending: false }).limit(1000).then((r) => ok(r, 'leer sesiones')),
    sb.from('gym_set').select('*').is('deleted_at', null).gte('done_at', desde).order('done_at').limit(20000).then((r) => ok(r, 'leer series')),
  ]);
  const abierta = sesiones.find((s) => s.status === 'activa' || s.status === 'pausada') || null;
  return { ej, ajustes: aj, rutinas, sesiones, sets, abierta };
}
export const hechasDe = (sets, sessionId) => {
  const h = {};
  for (const s of sets || []) if (s.session_id === sessionId && !s.deleted_at) h[s.item_id] = (h[s.item_id] || 0) + 1;
  return h;
};
/** Rutinas borradas (recuperables). */
export const borradas = async (sb) => ok(await sb.from('gym_routine').select('id,name,deleted_at').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(50), 'leer borradas');
/** Cambios recientes (app y MAMA). */
export const cambios = async (sb, n = 50) => ok(await sb.from('gym_change').select('*').order('created_at', { ascending: false }).limit(n), 'leer cambios');

// ---------------------------------------------------------------- ejercicios

const slugDe = (s) => M.sinTildes(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'ejercicio';
/** Ejercicio personalizado (nombre + músculo + material bastan). */
export async function crearEjercicio(sb, { name, primary_muscle, equipment = 'otro', kind = null, secondary_muscles = [], pattern = null, aliases = [], alternatives = [], default_rest = null, description = null }, { by = 'app' } = {}) {
  const nombre = String(name || '').trim().slice(0, 120);
  if (!nombre) throw fallo('Ponle un nombre al ejercicio');
  const fila = { slug: `${slugDe(nombre)}-${Date.now().toString(36).slice(-4)}`, name: nombre, primary_muscle: primary_muscle || 'otro', equipment: String(equipment || 'otro').slice(0, 40),
    kind: kind || 'aislamiento', secondary_muscles, pattern, aliases, alternatives, default_rest, description, created_by: by };
  const x = ok(await sb.from('gym_exercise').insert(fila).select('*').single(), 'crear ejercicio');
  await anotar(sb, 'exercise', x.id, 'crear', by, `Ejercicio nuevo: ${x.name} (${x.primary_muscle})`);
  return x;
}
export async function editarEjercicio(sb, id, cambios, { by = 'app' } = {}) {
  const permitido = ['name', 'primary_muscle', 'secondary_muscles', 'equipment', 'kind', 'pattern', 'aliases', 'alternatives', 'default_rest', 'description', 'archived_at'];
  const p = Object.fromEntries(Object.entries(cambios || {}).filter(([k]) => permitido.includes(k)));
  const x = ok(await sb.from('gym_exercise').update(p).eq('id', id).select('*'), 'editar ejercicio');
  if (!x.length) throw fallo('Sólo se pueden cambiar tus ejercicios personalizados (el catálogo común no)');
  await anotar(sb, 'exercise', id, 'editar', by, `Ejercicio ${x[0].name}: ${Object.keys(p).join(', ')}`);
  return x[0];
}

// ---------------------------------------------------------------- rutinas

export async function crearRutina(sb, { name, blocks, notes = null }, { by = 'app', ej = {}, aj = null } = {}) {
  const b = M.normalizar(blocks, { descanso: aj?.rest_default, descansoSuperserie: aj?.rest_superset });
  const r = ok(await sb.from('gym_routine').insert({ name: String(name || 'Rutina').slice(0, 80), blocks: b, notes, updated_by: by }).select('*').single(), 'crear rutina');
  await cas(sb, 'gym_settings', { user_id: r.user_id }, (a) => (a.rotation.includes(r.id) ? null : { parche: { rotation: [...a.rotation, r.id] } }), { by }).catch(async (e) => {
    if (!/No existe/.test(e.message)) throw e;
    await ajustes(sb); return cas(sb, 'gym_settings', { user_id: r.user_id }, (a) => ({ parche: { rotation: [...a.rotation, r.id] } }), { by });
  });
  await anotar(sb, 'routine', r.id, 'crear', by, `Rutina nueva: ${r.name} (${M.itemsDe(b).map((it) => M.nombre(ej, it.exercise_id)).join(', ')})`);
  return r;
}
/** Cambia una rutina con `mutar(rutina)` → { name?, blocks?, notes?, variants?, resumen }. Cambiar blocks sube la versión
 *  y el disparador guarda la anterior en gym_change (recuperable). */
export async function editarRutina(sb, id, mutar, { by = 'app', aj = null } = {}) {
  const r = await cas(sb, 'gym_routine', { id }, async (fila) => {
    if (fila.deleted_at) throw fallo('Esa rutina está borrada: recupérala antes');
    const c = await mutar(fila);
    if (!c) return null;
    const parche = {};
    if (c.name !== undefined) parche.name = String(c.name).slice(0, 80);
    if (c.notes !== undefined) parche.notes = c.notes;
    if (c.blocks !== undefined) parche.blocks = M.normalizar(c.blocks, { descanso: aj?.rest_default, descansoSuperserie: aj?.rest_superset });
    if (c.variants !== undefined) parche.variants = c.variants;
    return { parche, resumen: c.resumen || 'Rutina modificada' };
  }, { by });
  if (r.resumen) await anotar(sb, 'routine', id, 'editar', by, `${r.fila.name}: ${r.resumen}`);
  return r.fila;
}
export async function estadoRutina(sb, id, accion, { by = 'app' } = {}) {
  const ahora = new Date().toISOString();
  const parche = { archivar: { archived_at: ahora }, desarchivar: { archived_at: null }, eliminar: { deleted_at: ahora }, recuperar: { deleted_at: null } }[accion];
  if (!parche) throw fallo('Acción de rutina desconocida');
  const r = await cas(sb, 'gym_routine', { id }, () => ({ parche, resumen: accion }), { by });
  await anotar(sb, 'routine', id, accion, by, `${r.fila.name}: ${accion}`);
  return r.fila;
}
export async function duplicarRutina(sb, id, { by = 'app', name = null } = {}) {
  const o = ok(await sb.from('gym_routine').select('*').eq('id', id).single(), 'leer rutina');
  const copia = M.normalizar(o.blocks).map((b) => ({ ...b, id: M.nuevoId('b'), items: b.items.map((it) => ({ ...it, id: M.nuevoId('i') })) }));
  return crearRutina(sb, { name: name || `${o.name} (copia)`, blocks: copia, notes: o.notes }, { by });
}
/** Vuelve una rutina a una versión anterior guardada en gym_change. */
export async function versionAnterior(sb, id, version, { by = 'app' } = {}) {
  const v = ok(await sb.from('gym_change').select('detail').eq('entity', 'routine').eq('entity_id', String(id)).eq('action', 'version').order('created_at', { ascending: false }).limit(200), 'leer versiones')
    .find((c) => Number(c.detail?.version) === Number(version));
  if (!v) throw fallo(`No hay copia de la versión ${version}`);
  return editarRutina(sb, id, () => ({ blocks: v.detail.blocks, resumen: `vuelta a la versión ${version}` }), { by });
}

// ---------------------------------------------------------------- ajustes, rotación y sesión preparada

export async function guardarAjustes(sb, cambios, { by = 'app' } = {}) {
  const permitido = ['rotation', 'next_routine_id', 'default_minutes', 'default_mode', 'rest_default', 'rest_superset', 'chest_weekly_min', 'chest_min_sets', 'sound', 'vibration', 'prepared',
    'advance_rule', 'chest_rule', 'chest_fraction', 'chest_floor'];
  const a = await ajustes(sb);
  const p = Object.fromEntries(Object.entries(cambios || {}).filter(([k]) => permitido.includes(k)));
  if ('next_routine_id' in p) p.next_set_at = p.next_routine_id ? new Date().toISOString() : null;
  const r = await cas(sb, 'gym_settings', { user_id: a.user_id }, () => ({ parche: p, resumen: Object.keys(p).join(', ') }), { by });
  await anotar(sb, 'settings', a.user_id, 'editar', by, `Ajustes: ${Object.keys(p).filter((k) => k !== 'prepared').join(', ') || 'sesión preparada'}`);
  return r.fila;
}

/** Plan de hoy para una rutina con minutos y modalidad (motor, inmediato). Si `pecho`, incorpora pecho (adaptación). */
export function planPara(datos, { rutina_id, minutos = null, modo = null, pecho = false }) {
  const r = datos.rutinas.find((x) => x.id === rutina_id);
  if (!r) throw fallo('Esa rutina no existe');
  const aj = datos.ajustes || {};
  const opts = { descanso: aj.rest_default, descansoSuperserie: aj.rest_superset };
  const a = M.adaptar(r, { minutos, modo: modo || aj.default_mode || 'normal' }, datos.ej, opts);
  let blocks = a.blocks, cambios = [...a.cambios], adaptacion_pecho = false;
  if (pecho) {
    const cand = M.itemsDe(M.normalizar(datos.rutinas.find((x) => x.id === M.siguiente({ ...datos, ajustes: aj }).pecho.rutina_pecho_id)?.blocks || []))
      .filter((it) => datos.ej[it.exercise_id]?.primary_muscle === 'pecho').map((it) => it.exercise_id);
    const p = M.incorporarPecho(blocks, datos.ej, { minimo: M.minimoPecho(aj), candidatos: cand.length ? cand : null, ajustes: opts });
    blocks = p.blocks; cambios.push(...p.cambios); adaptacion_pecho = true;
    if (minutos) { const t = M.ajustarTiempo(blocks, minutos, datos.ej, {}); blocks = t.blocks; cambios = M.diferencias(M.normalizar(r.blocks, opts), blocks, datos.ej); cambios.unshift('Adaptación con pecho'); }
  }
  return { rutina: r, blocks, minutos: M.estimarMinutos(blocks), objetivo: minutos, modo: a.modo, cambios, variante: a.variante, sugerencia: a.sugerencia, adaptacion_pecho, cabe: a.cabe };
}

/** Deja preparada la próxima sesión (la ve la app al abrir GYM). La prepara Antonio desde la app o MAMA. */
export async function preparar(sb, datos, { rutina_id = null, minutos = null, modo = null, pecho = false, motivo = '' }, { by = 'app' } = {}) {
  const sig = M.siguiente({ ...datos });
  const id = rutina_id || sig.rutina_id;
  if (!id) throw fallo('No hay rutinas: crea la primera');
  const p = planPara(datos, { rutina_id: id, minutos, modo, pecho });
  const prepared = { routine_id: id, minutes: minutos, mode: p.modo, blocks: p.blocks, cambios: p.cambios, estimado: p.minutos, by, at: new Date().toISOString(),
    dia: M.diaMadrid(), motivo: String(motivo || '').slice(0, 300), adaptacion_pecho: p.adaptacion_pecho };
  await guardarAjustes(sb, { prepared }, { by });
  return { ...prepared, nombre: p.rutina.name };
}

// ---------------------------------------------------------------- sesión

/** Empieza (o devuelve la ya abierta). `plan` = la preparada; si no, se calcula con el motor. Nunca avanza la rotación. */
export async function iniciar(sb, datos, { id = uuid(), rutina_id, minutos = null, modo = null, pecho = false, plan = null }, { by = 'app' } = {}) {
  const abierta = ok(await sb.from('gym_session').select('*').in('status', ['activa', 'pausada']).maybeSingle(), 'leer sesión abierta');
  if (abierta) return { sesion: abierta, yaAbierta: true };
  const rid = rutina_id ?? null;
  const r = rid ? datos.rutinas.find((x) => x.id === rid) : null;
  let p = plan;
  if (!p && r) { const x = planPara(datos, { rutina_id: rid, minutos, modo, pecho }); p = { blocks: x.blocks, mode: x.modo, cambios: x.cambios, adaptacion_pecho: x.adaptacion_pecho }; }
  if (!p) p = { blocks: [], mode: modo || 'normal', cambios: [] };
  const fila = { id, routine_id: rid, routine_version: r?.version ?? null, routine_name: r?.name || 'Sesión libre', status: 'activa', mode: p.mode || 'normal',
    planned_minutes: minutos, estimated_minutes: M.estimarMinutos(p.blocks), plan: { blocks: p.blocks, mode: p.mode || 'normal' },
    changes: (p.cambios || []).length ? [{ at: new Date().toISOString(), by, tipo: 'preparar', cambio: p.cambios.join('; ') }] : [],
    adapted: (p.cambios || []).length > 0, chest_adaptation: !!p.adaptacion_pecho, updated_by: by };
  const ins = await sb.from('gym_session').insert(fila).select('*');
  if (ins.error?.code === '23505') { // reintento del mismo id o carrera con otra sesión abierta: se devuelve la abierta
    const ya = ok(await sb.from('gym_session').select('*').in('status', ['activa', 'pausada']).maybeSingle(), 'leer sesión abierta');
    if (ya) return { sesion: ya, yaAbierta: ya.id !== id };
  }
  const s = ok(ins, 'empezar sesión')[0];
  await anotar(sb, 'session', s.id, 'iniciar', by, `Empieza ${s.routine_name}${minutos ? ` (${minutos} min)` : ''}${s.mode === 'superseries' ? ' en superseries' : ''}`);
  const aj = datos.ajustes;
  if (aj?.prepared) await guardarAjustes(sb, { prepared: null }, { by }).catch(() => {});
  return { sesion: s, yaAbierta: false };
}

const leerSets = async (sb, sessionId) => ok(await sb.from('gym_set').select('*').eq('session_id', sessionId).is('deleted_at', null), 'leer series');

/** Aplica una operación del motor a la sesión (sustituir, quitar, superserie, tiempo restante…). Lo hecho no se toca. */
export async function operar(sb, sessionId, op, { by = 'app', ej, aj = {}, opId = null }) {
  const r = await cas(sb, 'gym_session', { id: sessionId }, async (s) => {
    if (opId && (s.changes || []).some((c) => c.id === opId)) return null; // reintento de la misma operación: ya aplicada
    if (!['activa', 'pausada'].includes(s.status)) throw fallo('La sesión ya está cerrada');
    const sets = await leerSets(sb, sessionId);
    const { plan, cambio } = M.aplicarOp(s.plan, op, { ej, hechas: hechasDe(sets, sessionId), ajustes: { descanso: aj.rest_default, descansoSuperserie: aj.rest_superset, pechoSeries: M.minimoPecho(aj) } });
    const entrada = { at: new Date().toISOString(), by, tipo: op.tipo, cambio, ...(opId ? { id: opId } : {}) };
    return { parche: { plan, mode: plan.mode || s.mode, adapted: true, changes: [...(s.changes || []), entrada].slice(-300),
      estimated_minutes: M.estimarMinutos(plan.blocks, hechasDe(sets, sessionId)), ...(plan.adaptacion_pecho ? { chest_adaptation: true } : {}),
      ...(op.tipo === 'tiempo_restante' ? { planned_minutes: null } : {}) }, resumen: cambio };
  }, { by });
  if (r.resumen) await anotar(sb, 'session', sessionId, op.tipo, by, r.resumen, { op });
  return { sesion: r.fila, cambio: r.resumen || 'ya aplicada', repetida: !r.resumen };
}

/** Registra UNA serie confirmada. `id` del cliente: reintentar no duplica. La serie n se calcula sobre lo ya hecho. */
export async function registrarSerie(sb, { id = uuid(), session_id, item_id, weight = null, reps, rest_seconds = null, done_at = null }, { by = 'app', ej = {} } = {}) {
  const ya = ok(await sb.from('gym_set').select('*').eq('id', id).maybeSingle(), 'leer serie');
  if (ya) return { serie: ya, repetida: true };
  const s = ok(await sb.from('gym_session').select('id,status,plan').eq('id', session_id).maybeSingle(), 'leer sesión');
  if (!s) throw fallo('Esa sesión no existe');
  if (!['activa', 'pausada'].includes(s.status)) throw fallo('La sesión ya está cerrada: no se registran más series');
  const it = M.itemsDe(s.plan.blocks).find((x) => x.id === item_id);
  if (!it) throw fallo('Ese ejercicio no está en la sesión');
  const r = Number(reps);
  if (!Number.isInteger(r) || r < 0 || r > 500) throw fallo('Repeticiones no válidas');
  const w = weight === null || weight === '' || weight === undefined ? null : Number(weight);
  if (w !== null && (!Number.isFinite(w) || w < 0 || w > 1000)) throw fallo('Peso no válido');
  for (let i = 0; i < 4; i++) {
    const hechas = (await leerSets(sb, session_id)).filter((x) => x.item_id === item_id);
    const fila = { id, session_id, item_id, exercise_id: it.exercise_id, set_index: Math.max(0, ...hechas.map((x) => x.set_index)) + 1, weight: w, reps: r,
      rest_seconds, source: by, ...(done_at ? { done_at } : {}) };
    const ins = await sb.from('gym_set').insert(fila).select('*');
    if (!ins.error) {
      const x = ins.data[0];
      await anotar(sb, 'set', x.id, 'registrar', by, `${M.nombre(ej, it.exercise_id)}: serie ${x.set_index} · ${w ?? '–'} kg × ${r}`, { session_id, item_id });
      return { serie: x, repetida: false };
    }
    if (ins.error.code !== '23505') ok(ins, 'registrar serie');
    const otra = ok(await sb.from('gym_set').select('*').eq('id', id).maybeSingle(), 'leer serie');
    if (otra) return { serie: otra, repetida: true }; // el mismo id ya entró (reintento)
  }
  throw fallo('No se pudo registrar la serie (otro registro a la vez)');
}
export async function corregirSerie(sb, id, { weight, reps }, { by = 'app' } = {}) {
  const p = {};
  if (weight !== undefined) p.weight = weight === null || weight === '' ? null : Number(weight);
  if (reps !== undefined) p.reps = Number(reps);
  const x = ok(await sb.from('gym_set').update(p).eq('id', id).is('deleted_at', null).select('*'), 'corregir serie');
  if (!x.length) throw fallo('Esa serie ya no existe');
  await anotar(sb, 'set', id, 'corregir', by, `Serie corregida: ${x[0].weight ?? '–'} kg × ${x[0].reps}`);
  return x[0];
}
/** Deshacer = borrado lógico (recuperable desde el registro). */
export async function deshacerSerie(sb, id, { by = 'app' } = {}) {
  const x = ok(await sb.from('gym_set').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('*'), 'deshacer serie');
  if (x.length) await anotar(sb, 'set', id, 'deshacer', by, `Serie ${x[0].set_index} deshecha`, { session_id: x[0].session_id });
  return x[0] || null;
}

export async function pausar(sb, sessionId, pausa, { by = 'app' } = {}) {
  const r = await cas(sb, 'gym_session', { id: sessionId }, (s) => {
    if (pausa && s.status === 'activa') return { parche: { status: 'pausada', paused_at: new Date().toISOString(), rest_until: null }, resumen: 'Pausada' };
    if (!pausa && s.status === 'pausada') return { parche: { status: 'activa', paused_at: null, paused_seconds: s.paused_seconds + Math.max(0, Math.round((Date.now() - Date.parse(s.paused_at)) / 1000)) }, resumen: 'Reanudada' };
    return null;
  }, { by });
  if (r.resumen) await anotar(sb, 'session', sessionId, pausa ? 'pausar' : 'reanudar', by, r.resumen);
  return r.fila;
}
/** Fin de descanso en curso (para retomarlo tras cerrar la app). */
export async function descanso(sb, sessionId, hasta, { by = 'app' } = {}) {
  return (await cas(sb, 'gym_session', { id: sessionId }, () => ({ parche: { rest_until: hasta } }), { by })).fila;
}

/**
 * Termina: decide completada / parcial / cancelada y si avanza la rotación (regla del motor). Con `guardar` = true, el plan
 * de hoy pasa a la rutina como cambio PERMANENTE (sin los omitidos); si no, la rutina no se toca («sólo para hoy»).
 */
export async function finalizar(sb, sessionId, { guardar = false, cancelar = false } = {}, { by = 'app', aj = {} } = {}) {
  const sets = await leerSets(sb, sessionId);
  const r = await cas(sb, 'gym_session', { id: sessionId }, (s) => {
    if (!['activa', 'pausada'].includes(s.status)) return null;
    const res = M.resultadoSesion(s.plan, hechasDe(sets, sessionId), aj);
    const status = cancelar && res.hechas === 0 ? 'cancelada' : res.status;
    const pausa = s.status === 'pausada' ? Math.max(0, Math.round((Date.now() - Date.parse(s.paused_at)) / 1000)) : 0;
    return { parche: { status, ended_at: new Date().toISOString(), paused_at: null, rest_until: null, paused_seconds: s.paused_seconds + pausa, advances: status !== 'cancelada' && res.avanza },
      resumen: `${s.routine_name}: ${status} (${res.hechas}/${res.previstas} series). ${status === 'cancelada' ? 'Se descarta; la rotación no avanza' : res.motivo}`, extra: res };
  }, { by });
  if (!r.resumen) return { sesion: r.fila, resultado: null };
  await anotar(sb, 'session', sessionId, 'finalizar', by, r.resumen, r.extra);
  if (guardar && r.fila.routine_id) {
    const blocks = r.fila.plan.blocks.map((b) => ({ ...b, items: b.items.filter((it) => it.status !== 'omitido').map(({ status, from_exercise_id, ...it }) => it) })).filter((b) => b.items.length);
    await editarRutina(sb, r.fila.routine_id, () => ({ blocks, resumen: 'cambios de la sesión guardados como permanentes' }), { by, aj });
  }
  // Una elección manual de «la siguiente» se consume al terminar una sesión que avanza.
  if (r.fila.advances && aj?.next_routine_id) await guardarAjustes(sb, { next_routine_id: null }, { by }).catch(() => {});
  return { sesion: r.fila, resultado: r.extra };
}
