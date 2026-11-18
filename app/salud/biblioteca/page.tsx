"use client";
// SALUD · biblioteca privada: tus libros y documentos (sólo tuyos), búsqueda dentro de ellos con cita (capítulo y
// página), importación con declaración de permiso y las consultas recientes a MAMA. Todo con biblioteca.js.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabaseClient";
import * as B from "@/src/salud/gym/biblioteca.js";
import { Boton, Cargando, Chip, cx, Etiqueta, Hoja, Icono, Marco, Tarjeta, Vacio } from "@/src/salud/ui";

type Libro = { id: string; title: string; author: string | null; year: number | null; edition: string | null; language: string; topics: string[]; format: string; file_name: string | null;
  file_size: number | null; cover_path: string | null; status: string; status_detail: string | null; pages: number | null; chapters: number | null; created_at: string; processed_at: string | null };
type Fragmento = { book_id: string; title: string; author: string | null; year: number | null; chunk_id: number; chapter: string | null; page_from: number | null; page_to: number | null; fragmento: string };
type Consulta = { id: string; question: string; answer: string | null; sources: { title?: string; author?: string }[]; created_at: string; agent: string };

const ESTADO: Record<string, { t: string; c: string }> = {
  pendiente: { t: "En cola: pronto podrás buscar en él", c: "bg-aviso-suave text-aviso-tinta" },
  procesando: { t: "Preparándolo para buscar…", c: "bg-acento-suave text-acento-tinta" },
  listo: { t: "Listo para buscar", c: "bg-ok-suave text-ok-tinta" },
  error: { t: "No se pudo preparar", c: "bg-peligro-suave text-peligro-tinta" },
  rechazado: { t: "No se pudo leer el fichero", c: "bg-peligro-suave text-peligro-tinta" },
};
const err = (e: unknown) => (e instanceof Error ? e.message : String(e));
const tam = (b: number | null) => (!b ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const TONOS = ["#1D4ED8", "#0B1220", "#067647", "#5925DC", "#B54708", "#344054"];
const tono = (s: string) => TONOS[[...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % TONOS.length];

export default function BibliotecaPage() {
  const [libros, setLibros] = useState<Libro[] | null>(null);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [portadas, setPortadas] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [tema, setTema] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [importar, setImportar] = useState(false);
  const [q, setQ] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<Fragmento[] | null>(null);

  const recargar = useCallback(async () => {
    try {
      const xs = (await B.libros(supabase)) as Libro[];
      setLibros(xs); setError(null);
      const urls = await Promise.all(xs.filter((l) => l.cover_path).map(async (l) => [l.id, await B.portada(supabase, l)] as const));
      setPortadas(Object.fromEntries(urls.filter(([, u]) => u)));
      setConsultas(((await B.consultas(supabase, 8)) as Consulta[]) ?? []);
    } catch (e) { setError(err(e)); setLibros((l) => l ?? []); }
  }, []);
  useEffect(() => { const t = setTimeout(recargar, 0); const i = setInterval(recargar, 15000); return () => { clearTimeout(t); clearInterval(i); }; }, [recargar]);

  const visibles = useMemo(() => (libros ?? []).filter((l) => !tema || l.topics.includes(tema)), [libros, tema]);
  const libro = libros?.find((l) => l.id === abierto) ?? null;
  const buscar = async (texto: string) => {
    if (texto.trim().length < 2) { setResultados(null); return; }
    setBuscando(true);
    try { setResultados((await B.buscar(supabase, texto, { limite: 20 })) as Fragmento[]); } catch (e) { setError(err(e)); } finally { setBuscando(false); }
  };

  return (
    <Marco titulo="Biblioteca" subtitulo="Tus libros y documentos de entrenamiento y salud. Son privados: sólo los ves tú (y MAMA cuando le preguntas)."
      accion={<Boton icono="upload" onClick={() => setImportar(true)} data-testid="bib-importar">Añadir documento</Boton>}>
      {error ? <p role="alert" className="mb-4 rounded-[14px] bg-peligro-suave px-4 py-3 text-sm text-peligro-tinta">{error}</p> : null}
      <form role="search" className="mb-4" onSubmit={(e) => { e.preventDefault(); void buscar(q); }}>
        <label className="flex min-h-14 items-center gap-3 rounded-[18px] border border-linea bg-superficie px-4 shadow-[0_2px_8px_-4px_rgba(16,24,40,0.12)] focus-within:border-acento">
          <Icono n="search" className="text-acento" />
          <input value={q} onChange={(e) => { setQ(e.target.value); if (!e.target.value.trim()) setResultados(null); }} placeholder="Busca dentro de tus libros: «sobrecarga progresiva», «descanso entre series»…"
            aria-label="Buscar en la biblioteca" data-testid="bib-buscar" className="min-w-0 flex-1 bg-transparent text-[17px] outline-none placeholder:text-tinta3" />
          <Boton type="submit" disabled={q.trim().length < 2 || buscando} className="!min-h-10 !px-4">{buscando ? "Buscando…" : "Buscar"}</Boton>
        </label>
      </form>
      {resultados ? (
        <section className="mb-8" data-testid="bib-resultados">
          <Etiqueta className="mb-2">{resultados.length ? `${resultados.length} pasaje${resultados.length > 1 ? "s" : ""} encontrado${resultados.length > 1 ? "s" : ""}` : "Resultados"}</Etiqueta>
          {!resultados.length ? <Vacio titulo={`Nada sobre «${q}»`}>Sólo se busca en los libros que ya están listos. Prueba con otras palabras.</Vacio> : null}
          <ul className="grid gap-3 lg:grid-cols-2">
            {resultados.map((r) => (
              <li key={r.chunk_id}>
                <Tarjeta className="h-full">
                  <p className="text-[15px] leading-relaxed text-tinta"><Resaltado texto={r.fragmento} /></p>
                  <button type="button" onClick={() => setAbierto(r.book_id)} className="mt-3 flex items-start gap-2 text-left text-sm font-semibold text-acento-tinta hover:underline">
                    <Icono n="book" size={16} className="mt-0.5" />{B.cita(r)}
                  </button>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin] md:flex-wrap md:overflow-visible">
            <Chip activo={tema === null} onClick={() => setTema(null)} className="shrink-0">Todos</Chip>
            {Object.entries(B.TEMAS).map(([k, v]) => <Chip key={k} activo={tema === k} onClick={() => setTema(tema === k ? null : k)} className="shrink-0" data-testid={`bib-tema-${k}`}>{v}</Chip>)}
          </div>
          {libros === null ? <Cargando /> : !visibles.length ? (
            <Vacio titulo={tema ? `Nada en ${B.TEMAS[tema]}` : "Tu biblioteca está vacía"} accion={<Boton icono="upload" onClick={() => setImportar(true)}>Añadir el primero</Boton>}>
              Sube un PDF, EPUB o TXT que sea tuyo o que tengas permiso para usar.
            </Vacio>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" data-testid="bib-libros">
              {visibles.map((l) => (
                <li key={l.id}>
                  <button type="button" onClick={() => setAbierto(l.id)} className="group w-full text-left" data-testid={`libro-${l.id}`}>
                    <Portada libro={l} url={portadas[l.id]} />
                    <p className="mt-2 font-bold leading-snug group-hover:text-acento-tinta">{l.title}</p>
                    <p className="text-sm text-tinta2">{l.author || "Autor sin indicar"}{l.year ? ` · ${l.year}` : ""}</p>
                    <span className={cx("mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", ESTADO[l.status]?.c)}>{l.status === "listo" ? "Listo" : B.ESTADOS[l.status] ?? l.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <aside>
          <Tarjeta>
            <p className="mb-1 flex items-center gap-2 font-bold"><Icono n="message" size={18} className="text-mama" />Consultas a MAMA</p>
            <p className="mb-3 text-sm text-tinta2">Lo último que MAMA consultó en tu biblioteca para responderte.</p>
            {!consultas.length ? <p className="text-sm text-tinta2" data-testid="bib-sin-consultas">Aún no hay consultas.</p> : (
              <ul className="space-y-3">
                {consultas.map((c) => (
                  <li key={c.id} className="rounded-[14px] border border-mama/20 bg-mama-suave px-3 py-2">
                    <p className="text-xs font-bold text-mama-tinta">MAMA · {new Date(c.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</p>
                    <p className="text-sm font-semibold">{c.question}</p>
                    {c.sources?.length ? <p className="text-xs text-tinta2">Fuentes: {c.sources.map((s) => s.title).filter(Boolean).slice(0, 3).join("; ")}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </aside>
      </div>

      <Hoja abierta={!!libro} onCerrar={() => setAbierto(null)} titulo={libro?.title ?? ""} ancha testid="bib-ficha">
        {libro ? <FichaLibro key={libro.id} libro={libro} url={portadas[libro.id]} onCambio={recargar} onCerrar={() => setAbierto(null)} /> : null}
      </Hoja>
      <Hoja abierta={importar} onCerrar={() => setImportar(false)} titulo="Añadir documento" testid="bib-hoja-importar">
        <Importar onListo={() => { setImportar(false); void recargar(); }} />
      </Hoja>
    </Marco>
  );
}

/** «…» del buscador → resaltado. */
function Resaltado({ texto }: { texto: string }) {
  const partes = String(texto || "").split(/(«[^»]*»)/g);
  return <>{partes.map((p, i) => (p.startsWith("«") && p.endsWith("»") ? <mark key={i} className="rounded bg-[#FEF0C7] px-0.5 font-semibold text-tinta">{p.slice(1, -1)}</mark> : <span key={i}>{p}</span>))}</>;
}

function Portada({ libro, url, grande }: { libro: Libro; url?: string; grande?: boolean }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- URL firmada temporal de Storage (no optimizable)
    return <img src={url} alt={`Portada de ${libro.title}`} className={cx("aspect-[2/3] w-full rounded-[10px] object-cover shadow-[0_10px_24px_-12px_rgba(16,24,40,0.45)]", grande && "max-w-[180px]")} />;
  }
  return (
    <div aria-hidden className={cx("relative flex aspect-[2/3] w-full flex-col justify-between overflow-hidden rounded-[10px] p-3 text-white shadow-[0_10px_24px_-12px_rgba(16,24,40,0.45)]", grande && "max-w-[180px]")}
      style={{ background: `linear-gradient(160deg, ${tono(libro.title)} 0%, #0B1220 120%)` }}>
      <span className="absolute inset-y-0 left-2 w-px bg-white/20" />
      <span className="pl-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">{(libro.topics[0] && B.TEMAS[libro.topics[0]]) || libro.format.toUpperCase()}</span>
      <span className="pl-2 font-serif text-[15px] font-bold leading-tight [overflow-wrap:anywhere] sm:text-[17px]">{libro.title}</span>
      <span className="pl-2 text-xs text-white/80">{libro.author || ""}</span>
    </div>
  );
}

function FichaLibro({ libro, url, onCambio, onCerrar }: { libro: Libro; url?: string; onCambio: () => Promise<void>; onCerrar: () => void }) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ title: libro.title, author: libro.author ?? "", year: libro.year ? String(libro.year) : "", topics: libro.topics });
  const [msg, setMsg] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);
  const hacer = async (fn: () => Promise<unknown>, t: string) => { try { await fn(); setMsg(t); await onCambio(); } catch (e) { setMsg(err(e)); } };
  const e = ESTADO[libro.status];
  return (
    <div className="space-y-5 pb-2">
      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
        <Portada libro={libro} url={url} grande />
        <div className="space-y-1.5">
          <p className="text-[20px] font-extrabold leading-tight">{libro.title}</p>
          <p className="text-[15px] font-semibold text-tinta2">{libro.author || "Autor sin indicar"}{libro.year ? ` · ${libro.year}` : ""}{libro.edition ? ` · ${libro.edition}` : ""}</p>
          <p className="text-sm text-tinta2">{libro.format.toUpperCase()} · {tam(libro.file_size)}{libro.pages ? ` · ${libro.pages} página${libro.pages > 1 ? "s" : ""}` : ""}{libro.chapters ? ` · ${libro.chapters} capítulo${libro.chapters > 1 ? "s" : ""}` : ""}</p>
          <div className="flex flex-wrap gap-1">{libro.topics.map((t) => <span key={t} className="rounded-full bg-superficie2 px-2.5 py-0.5 text-xs font-semibold text-tinta2">{B.TEMAS[t] ?? t}</span>)}</div>
          <p className={cx("inline-flex rounded-full px-3 py-1 text-sm font-semibold", e?.c)} data-testid="bib-estado">{e?.t ?? B.ESTADOS[libro.status]}</p>
          {libro.status_detail && (libro.status === "error" || libro.status === "rechazado") ? <p className="text-sm text-peligro-tinta">{libro.status_detail}</p> : null}
        </div>
      </div>
      {msg ? <p role="status" className="rounded-[14px] bg-superficie2 px-3 py-2 text-sm">{msg}</p> : null}
      {edit ? (
        <div className="space-y-3">
          <Campo etiqueta="Título" valor={f.title} onCambio={(v) => setF({ ...f, title: v })} />
          <Campo etiqueta="Autor" valor={f.author} onCambio={(v) => setF({ ...f, author: v })} />
          <Campo etiqueta="Año" valor={f.year} onCambio={(v) => setF({ ...f, year: v })} numerico />
          <Temas valor={f.topics} onCambio={(topics) => setF({ ...f, topics })} />
          <div className="flex flex-wrap gap-2">
            <Boton icono="check" onClick={() => hacer(() => B.editarLibro(supabase, libro.id, { ...f, year: f.year || null }), "Guardado").then(() => setEdit(false))}>Guardar</Boton>
            <Boton tipo="secundario" onClick={() => setEdit(false)}>Cancelar</Boton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Boton tipo="secundario" icono="edit" onClick={() => setEdit(true)} data-testid="bib-editar">Editar datos</Boton>
          {libro.status === "error" || libro.status === "rechazado" ? <Boton tipo="secundario" icono="rotate-ccw" onClick={() => hacer(() => B.reprocesar(supabase, libro.id), "Vuelve a la cola")}>Intentarlo otra vez</Boton> : null}
          {borrar
            ? <Boton tipo="peligro" icono="trash" onClick={() => hacer(() => B.borrarLibro(supabase, libro.id), "Quitado de tu biblioteca").then(onCerrar)} data-testid="bib-borrar-ok">Sí, quitarlo</Boton>
            : <Boton tipo="peligro" icono="trash" onClick={() => setBorrar(true)} data-testid="bib-borrar">Quitar de la biblioteca</Boton>}
        </div>
      )}
    </div>
  );
}

function Campo({ etiqueta, valor, onCambio, numerico, testid }: { etiqueta: string; valor: string; onCambio: (v: string) => void; numerico?: boolean; testid?: string }) {
  return (
    <label className="block"><span className="mb-1 block text-sm font-semibold text-tinta2">{etiqueta}</span>
      <input value={valor} onChange={(e) => onCambio(e.target.value)} inputMode={numerico ? "numeric" : undefined} data-testid={testid}
        className="min-h-12 w-full rounded-[14px] border border-linea bg-superficie2 px-4 outline-none focus:border-acento" /></label>
  );
}
function Temas({ valor, onCambio }: { valor: string[]; onCambio: (v: string[]) => void }) {
  return (
    <div><Etiqueta className="mb-2">Temas</Etiqueta>
      <div className="flex flex-wrap gap-2">{Object.entries(B.TEMAS).map(([k, v]) => <Chip key={k} activo={valor.includes(k)} data-testid={`imp-tema-${k}`}
        onClick={() => onCambio(valor.includes(k) ? valor.filter((x) => x !== k) : [...valor, k])}>{v}</Chip>)}</div>
    </div>
  );
}

function Importar({ onListo }: { onListo: () => void }) {
  const [fichero, setFichero] = useState<File | null>(null);
  const [f, setF] = useState({ titulo: "", autor: "", anio: "", temas: [] as string[] });
  const [permiso, setPermiso] = useState(false);
  const [estado, setEstado] = useState<{ fase: "nada" | "subiendo" | "hecho" | "error"; t?: string }>({ fase: "nada" });
  const elegir = (x: File | null) => {
    setEstado({ fase: "nada" });
    if (!x) return setFichero(null);
    if (!B.formatoDe(x.name)) { setFichero(null); return setEstado({ fase: "error", t: "Formato no admitido: elige un PDF, EPUB o TXT" }); }
    if (x.size > B.TAM_MAX) { setFichero(null); return setEstado({ fase: "error", t: "Máximo 50 MB por documento" }); }
    const s = B.sugerirDeNombre(x.name);
    setFichero(x); setF({ ...f, titulo: s.titulo, autor: s.autor ?? "" });
  };
  const subir = async () => {
    if (!fichero || !permiso) return;
    setEstado({ fase: "subiendo", t: `Subiendo ${fichero.name} (${tam(fichero.size)})…` });
    try {
      await B.subirLibro(supabase, { datos: fichero, nombre: fichero.name, titulo: f.titulo.trim() || null, autor: f.autor.trim() || null, anio: f.anio || null, temas: f.temas, autorizado: permiso });
      setEstado({ fase: "hecho", t: "Añadido. En unos minutos estará listo para buscar en él." });
      setTimeout(onListo, 1200);
    } catch (e) { setEstado({ fase: "error", t: err(e) }); }
  };
  return (
    <div className="space-y-4 pb-2">
      <label className={cx("flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-[18px] border-2 border-dashed px-4 py-5 text-center", fichero ? "border-acento bg-acento-suave" : "border-linea bg-superficie2 hover:border-acento")}>
        <Icono n={fichero ? "file" : "upload"} size={26} className="text-acento" />
        <span className="font-semibold">{fichero ? fichero.name : "Elige un PDF, EPUB o TXT"}</span>
        <span className="text-sm text-tinta2">{fichero ? tam(fichero.size) : "Hasta 50 MB"}</span>
        <input type="file" accept=".pdf,.epub,.txt,application/pdf,application/epub+zip,text/plain" className="sr-only" data-testid="imp-fichero" onChange={(e) => elegir(e.target.files?.[0] ?? null)} />
      </label>
      {fichero ? (
        <>
          <Campo etiqueta="Título" valor={f.titulo} onCambio={(v) => setF({ ...f, titulo: v })} testid="imp-titulo" />
          <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
            <Campo etiqueta="Autor" valor={f.autor} onCambio={(v) => setF({ ...f, autor: v })} testid="imp-autor" />
            <Campo etiqueta="Año" valor={f.anio} onCambio={(v) => setF({ ...f, anio: v })} numerico />
          </div>
          <Temas valor={f.temas} onCambio={(temas) => setF({ ...f, temas })} />
        </>
      ) : null}
      <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-linea px-4 py-3">
        <input type="checkbox" checked={permiso} onChange={(e) => setPermiso(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#2563EB]" data-testid="imp-permiso" />
        <span><span className="block font-semibold">Es un documento mío o tengo permiso para usarlo</span><span className="block text-sm text-tinta2">Obligatorio. Queda privado en tu cuenta.</span></span>
      </label>
      {estado.fase !== "nada" ? (
        <p role="status" data-testid="imp-estado" className={cx("flex items-center gap-2 rounded-[14px] px-4 py-3 text-sm font-medium",
          estado.fase === "error" ? "bg-peligro-suave text-peligro-tinta" : estado.fase === "hecho" ? "bg-ok-suave text-ok-tinta" : "bg-acento-suave text-acento-tinta")}>
          {estado.fase === "subiendo" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-acento border-t-transparent" /> : <Icono n={estado.fase === "hecho" ? "check" : "alert"} size={16} />}{estado.t}
        </p>
      ) : null}
      <Boton grande className="w-full" icono="upload" disabled={!fichero || !permiso || estado.fase === "subiendo" || estado.fase === "hecho"} onClick={subir} data-testid="imp-subir">Añadir a mi biblioteca</Boton>
    </div>
  );
}
