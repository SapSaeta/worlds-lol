// Modo sin spoilers: qué resultados y qué cruces hay que tapar.
// Sin dependencias de servidor: se usa desde el navegador.

import type { Match } from "@/lib/types";

/** Clave en localStorage del interruptor (también la lee el script previo a la carga en el layout). */
export const NOSPOIL_KEY = "nospoil";
/** Partidos que el visitante ya ha destapado, para que sigan a la vista al volver. */
export const REVEALED_KEY = "nospoil-revealed";
/** Máximo de partidos destapados que se guardan (un Mundial tiene unas 80 series). */
export const REVEALED_MAX = 400;

/** Atributo de <html> mientras el modo está activo. */
export const NOSPOIL_ATTR = "data-nospoil";

/** Script que marca <html> antes de pintar para no enseñar resultados mientras carga React. */
export const NOSPOIL_BOOT = `try{if(localStorage.getItem(${JSON.stringify(NOSPOIL_KEY)})==="1")document.documentElement.setAttribute(${JSON.stringify(NOSPOIL_ATTR)},"")}catch(e){}`;

export type SpoilerView = {
  /** El modo está activo */
  on: boolean;
  /** Ids de partidos destapados */
  revealed: ReadonlySet<string>;
};

const time = (m: Match) => Date.parse(m.startTime) || Infinity;
const isTbd = (code: string) => !code || code === "TBD";

/** El marcador y el ganador de este partido están tapados (terminado o en juego). */
export function resultHidden(m: Match, v: SpoilerView): boolean {
  return v.on && m.state !== "unstarted" && !v.revealed.has(m.id);
}

/**
 * Partidos cuyos equipos hay que tapar porque saber quién juega destripa un
 * resultado anterior: alguno de sus equipos jugó antes una serie terminada
 * que sigue tapada (la final superior del Play-In, la ronda 2 de la suiza,
 * las semis…). Los que ya se han destapado se ven tal cual.
 */
export function concealedMatches(matches: Match[], v: SpoilerView): Set<string> {
  const out = new Set<string>();
  if (!v.on) return out;
  // Para cada equipo, la hora de su primera serie terminada y aún tapada.
  const firstHidden = new Map<string, number>();
  for (const m of matches) {
    if (m.state !== "completed" || v.revealed.has(m.id)) continue;
    for (const t of m.teams) {
      if (isTbd(t.code)) continue;
      const prev = firstHidden.get(t.code);
      if (prev === undefined || time(m) < prev) firstHidden.set(t.code, time(m));
    }
  }
  for (const m of matches) {
    if (v.revealed.has(m.id)) continue;
    if (m.teams.some((t) => !isTbd(t.code) && (firstHidden.get(t.code) ?? Infinity) < time(m))) out.add(m.id);
  }
  return out;
}
