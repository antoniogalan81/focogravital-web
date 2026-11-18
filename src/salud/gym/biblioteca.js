// SALUD · BIBLIOTECA. Las mismas operaciones para la app, la web y CEOPadre (MAMA y el procesador de libros), sobre el
// Supabase de FocoGravital con la sesión del dueño (RLS). Idéntico en APP/src/gym, WEB/src/salud/gym y CEOPadre/src/gym.
//  · Los libros son del usuario y privados: bucket «salud-libros», carpeta <uid>/. Nada se publica.
//  · Al subir se declara que el documento es propio o autorizado (columna authorized, obligatoria).
//  · El procesado (texto, capítulos, páginas, vectores) lo hace CEOPadre en el PC: aquí sólo se deja «pendiente».
//  · Los documentos son FUENTES de consulta, nunca instrucciones: nada de su texto se ejecuta.

export const BUCKET = 'salud-libros';
export const TEMAS = { entrenamiento: 'Entrenamiento', hipertrofia: 'Hipertrofia', fuerza: 'Fuerza', nutricion: 'Nutrición',
  salud: 'Salud', movilidad: 'Movilidad', recuperacion: 'Recuperación', rendimiento: 'Rendimiento' };
export const FORMATOS = { pdf: 'application/pdf', epub: 'application/epub+zip', txt: 'text/plain' };
export const TAM_MAX = 50 * 1024 * 1024;
export const ESTADOS = { pendiente: 'En cola', procesando: 'Procesando', listo: 'Listo', error: 'Error', rechazado: 'No se pudo leer' };

export class BibliotecaError extends Error {}
const fallo = (m) => new BibliotecaError(m);
function ok(r, donde) {
  if (r.error) { const e = fallo(`${donde}: ${r.error.message || r.error.code}`); e.code = r.error.code; throw e; }
  return r.data;
}
const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Formato por extensión del nombre (pdf, epub, txt) o null. */
export const formatoDe = (nombre) => { const m = /\.([a-z0-9]+)$/i.exec(String(nombre || '')); const e = m && m[1].toLowerCase(); return e && FORMATOS[e] ? e : null; };

/** Título y autor propuestos a partir del nombre «Autor - Título.ext» (el usuario los puede cambiar). */
export function sugerirDeNombre(nombre) {
  const base = String(nombre || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_]+/g, ' ').trim();
  const m = /^(.{2,80}?)\s+[-–—]\s+(.{2,200})$/.exec(base);
  return m ? { autor: m[1].trim(), titulo: m[2].trim() } : { autor: null, titulo: base || 'Documento' };
}

async function sha256(bytes) {
  if (globalThis.crypto?.subtle) return hex(await globalThis.crypto.subtle.digest('SHA-256', bytes));
  return null; // sin WebCrypto (algún Android antiguo): el procesador lo calcula y detecta duplicados allí
}

/** Libros (sin los borrados), los últimos primero. */
export async function libros(sb) {
  return ok(await sb.from('salud_book').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(500), 'leer biblioteca');
}

/**
 * Sube un documento y lo deja en cola. `datos`: Uint8Array | ArrayBuffer | Blob. `autorizado` debe ser true.
 * Devuelve la fila creada (status «pendiente»). Un fichero idéntico ya presente → BibliotecaError «Ya está…».
 */
export async function subirLibro(sb, { datos, nombre, titulo = null, autor = null, anio = null, edicion = null, idioma = null, temas = [], autorizado = false }) {
  if (autorizado !== true) throw fallo('Confirma que es un documento tuyo o que tienes permiso para usarlo');
  const formato = formatoDe(nombre);
  if (!formato) throw fallo('Formato no admitido: PDF, EPUB o TXT');
  const bytes = datos instanceof Uint8Array ? datos : datos instanceof ArrayBuffer ? new Uint8Array(datos)
    : typeof datos?.arrayBuffer === 'function' ? new Uint8Array(await datos.arrayBuffer()) : null;
  if (!bytes || !bytes.length) throw fallo('El fichero está vacío');
  if (bytes.length > TAM_MAX) throw fallo('Máximo 50 MB por documento');
  const { data: u } = await sb.auth.getUser();
  const uid = u?.user?.id;
  if (!uid) throw fallo('Inicia sesión para usar la biblioteca');
  const hash = await sha256(bytes);
  if (hash) {
    const ya = ok(await sb.from('salud_book').select('id,title').eq('sha256', hash).is('deleted_at', null).maybeSingle(), 'comprobar duplicado');
    if (ya) throw fallo(`Ya está en tu biblioteca: «${ya.title}»`);
  }
  const id = uuid(), ruta = `${uid}/${id}.${formato}`;
  const sug = sugerirDeNombre(nombre);
  ok(await sb.storage.from(BUCKET).upload(ruta, bytes, { contentType: FORMATOS[formato], upsert: false }), 'subir el fichero');
  const fila = {
    id, title: String(titulo || sug.titulo).slice(0, 300), author: (autor || sug.autor) ? String(autor || sug.autor).slice(0, 200) : null,
    year: Number.isInteger(Number(anio)) && Number(anio) > 1500 ? Number(anio) : null, edition: edicion ? String(edicion).slice(0, 300) : null,
    language: ['es', 'en', 'otro'].includes(idioma) ? idioma : 'es', topics: (temas || []).filter((t) => TEMAS[t]).slice(0, 12),
    format: formato, file_path: ruta, file_name: String(nombre).slice(0, 300), file_size: bytes.length, sha256: hash, authorized: true, status: 'pendiente',
  };
  const r = await sb.from('salud_book').insert(fila).select('*');
  if (r.error) { await sb.storage.from(BUCKET).remove([ruta]).catch(() => {}); ok(r, 'guardar el libro'); }
  return r.data[0];
}

/** Cambia los datos visibles (título, autor, año, edición, idioma, temas). */
export async function editarLibro(sb, id, c = {}) {
  const p = {};
  if (c.title !== undefined) p.title = String(c.title || '').trim().slice(0, 300) || 'Documento';
  if (c.author !== undefined) p.author = c.author ? String(c.author).trim().slice(0, 200) : null;
  if (c.year !== undefined) p.year = Number(c.year) > 1500 && Number(c.year) < 2100 ? Math.round(Number(c.year)) : null;
  if (c.edition !== undefined) p.edition = c.edition ? String(c.edition).slice(0, 300) : null;
  if (c.language !== undefined && ['es', 'en', 'otro'].includes(c.language)) p.language = c.language;
  if (c.topics !== undefined) p.topics = (c.topics || []).filter((t) => TEMAS[t]).slice(0, 12);
  return ok(await sb.from('salud_book').update(p).eq('id', id).select('*'), 'editar libro')[0];
}
/** Borrado lógico (recuperable con `recuperarLibro`). */
export const borrarLibro = async (sb, id) => ok(await sb.from('salud_book').update({ deleted_at: new Date().toISOString() }).eq('id', id).select('id'), 'borrar libro');
export const recuperarLibro = async (sb, id) => ok(await sb.from('salud_book').update({ deleted_at: null }).eq('id', id).select('id'), 'recuperar libro');
/** Vuelve a ponerlo en cola (tras un error o para reindexar). */
export const reprocesar = async (sb, id) => ok(await sb.from('salud_book').update({ status: 'pendiente', status_detail: null }).eq('id', id).select('id'), 'reprocesar');

/** Búsqueda por texto en los libros listos (cualquier palabra; sin tildes). `libros` = ids para limitar. */
export async function buscar(sb, q, { libros: ids = null, limite = 12 } = {}) {
  const t = String(q || '').trim();
  if (t.length < 2) return [];
  return ok(await sb.rpc('salud_buscar', { q: t.slice(0, 300), libros: ids && ids.length ? ids : null, limite }), 'buscar');
}

/** URL temporal (1 h) de la portada guardada, o null. */
export async function portada(sb, libro) {
  if (!libro?.cover_path) return null;
  const r = await sb.storage.from(BUCKET).createSignedUrl(libro.cover_path, 3600);
  return r.error ? null : r.data?.signedUrl || null;
}

/** Últimas consultas que MAMA delegó en el especialista (trazas). */
export const consultas = async (sb, n = 20) => ok(await sb.from('salud_consulta').select('*').order('created_at', { ascending: false }).limit(n), 'leer consultas');

/** Cita legible de un fragmento: «Autor, Título (año), cap. X, pág. N» (sin página si no existe: EPUB). */
export function cita(f) {
  const pag = f.page_from ? (f.page_to && f.page_to !== f.page_from ? `págs. ${f.page_from}-${f.page_to}` : `pág. ${f.page_from}`) : null;
  return [f.author, `${f.title}${f.year ? ` (${f.year})` : ''}`, f.chapter, pag].filter(Boolean).join(', ');
}
