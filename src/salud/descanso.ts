// SALUD · GYM · descanso entre series (web). Un único temporizador: reprogramarlo SUSTITUYE el anterior, nunca hay dos.
// La cuenta atrás se calcula siempre desde `hasta` (hora absoluta, persistida): no deriva y sobrevive a recargar.
// Aviso final: pitido (WebAudio), vibración (navigator.vibrate donde exista) y notificación del sistema si hay permiso
// y la pestaña no está a la vista. Réplica de APP/src/gym/descanso.ts.
"use client";

import { useSyncExternalStore } from "react";

export type Descanso = { hasta: number | null; total: number; pausadoQueda: number | null; silencio: boolean; etiqueta: string };
const CLAVE = "focogravital-gym-descanso-v1";
const INICIAL: Descanso = { hasta: null, total: 0, pausadoQueda: null, silencio: false, etiqueta: "" };
let estado = INICIAL;
const subs = new Set<() => void>();
const suscribir = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useDescanso = () => useSyncExternalStore(suscribir, () => estado, () => INICIAL);
function set(p: Partial<Descanso>) {
  estado = { ...estado, ...p };
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sigue en memoria */ }
  for (const f of subs) f();
  programar();
}

let opciones = { sonido: true, vibracion: true };
export const fijarOpciones = (o: { sonido: boolean; vibracion: boolean }) => { opciones = o; };

// ---------------------------------------------------------------- aviso

let audio: AudioContext | null = null;
/** Llamar dentro de un toque del usuario (los navegadores sólo dejan sonar audio tras un gesto). */
export function prepararAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    audio ??= new AC();
    if (audio.state === "suspended") void audio.resume();
  } catch { /* sin audio */ }
}
function pitido() {
  if (!audio) return;
  const t0 = audio.currentTime;
  for (const [i, f] of [880, 880, 1320].entries()) {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = "sine"; o.frequency.value = f;
    const t = t0 + i * 0.28;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + 0.24);
  }
}
/** Pide permiso de notificaciones (sólo tras un gesto y si aún no se decidió). */
export function pedirNotificaciones() {
  try { if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission(); } catch { /* */ }
}
let avisado = 0;
function avisar(hasta: number) {
  if (avisado === hasta) return; // una sola vez por descanso
  avisado = hasta;
  if (estado.silencio) return;
  if (opciones.sonido) pitido();
  if (opciones.vibracion) try { navigator.vibrate?.([0, 300, 150, 300]); } catch { /* */ }
  try {
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible")
      new Notification("Descanso terminado", { body: estado.etiqueta || "Siguiente serie", tag: "gym-descanso" });
  } catch { /* */ }
}

let reloj: ReturnType<typeof setTimeout> | null = null;
function programar() {
  if (reloj) { clearTimeout(reloj); reloj = null; }
  const h = estado.hasta;
  if (!h) return;
  const ms = h - Date.now();
  if (ms <= 0) { if (ms > -60_000) avisar(h); return; }
  reloj = setTimeout(() => avisar(h), ms);
}

// ---------------------------------------------------------------- acciones

let restaurado = false;
export function restaurarDescanso() {
  if (restaurado || typeof window === "undefined") return;
  restaurado = true;
  try { const raw = localStorage.getItem(CLAVE); if (raw) estado = { ...INICIAL, ...JSON.parse(raw) }; } catch { /* */ }
  if (estado.hasta && estado.hasta < Date.now() - 60_000) { avisado = estado.hasta; saltar(); return; } // uno vencido hace rato no vuelve a sonar
  if (estado.hasta && estado.hasta <= Date.now()) avisado = estado.hasta; // ya terminó mientras no se veía
  for (const f of subs) f();
  programar();
}
export function empezarDescanso(segundos: number, etiqueta: string) {
  if (segundos <= 0) return saltar();
  set({ hasta: Date.now() + segundos * 1000, total: segundos, pausadoQueda: null, etiqueta });
}
export function sumar(seg: number) {
  const st = estado;
  if (st.pausadoQueda !== null) { const q = Math.max(0, st.pausadoQueda + seg * 1000); return set({ pausadoQueda: q, total: Math.max(st.total, Math.round(q / 1000)) }); }
  if (!st.hasta) return;
  set({ hasta: Math.max(Date.now() + 1000, st.hasta + seg * 1000), total: Math.max(st.total + seg, 1) });
}
export function pausarDescanso() { if (estado.hasta) set({ pausadoQueda: Math.max(0, estado.hasta - Date.now()), hasta: null }); }
export function reanudarDescanso() { if (estado.pausadoQueda !== null) set({ hasta: Date.now() + estado.pausadoQueda, pausadoQueda: null }); }
export function saltar() { set({ hasta: null, pausadoQueda: null, total: 0 }); }
export function silenciar(si: boolean) { set({ silencio: si }); }
