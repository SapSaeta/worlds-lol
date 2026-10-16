// Resultado de una partida en forma compartible: lo justo para dibujar la
// tarjeta y escribir el mensaje, y viajar en el enlace /jugar/r?… que se
// publica (así X, WhatsApp o Telegram enseñan la tarjeta en el post).

import { STAGES } from "@/lib/game/engine";
import { fmtNum, localePath, tr, type Locale } from "@/lib/i18n";

export type SharedResult = {
  name: string;
  team: string;
  /** Fase alcanzada (0-4) */
  stage: number;
  champion: boolean;
  score: number;
  wins: number;
  objectives: number;
  bosses: number;
  killer?: string;
  champs: { id: string; level: number }[];
  /** Semilla de la partida: con ella otro puede jugar la misma */
  seed?: number;
  /** Número del reto del día, si lo era */
  daily?: number;
};

/** Nombre del juego en cada idioma. */
export const gameName = (l: Locale = "es") => tr(l, "Camino a la Copa", "Road to the Cup");

/** Etiqueta corta de la cabecera de la tarjeta. */
export const cardTitle = (r: Pick<SharedResult, "daily">, l: Locale = "es") =>
  r.daily ? tr(l, `RETO DEL DIA #${r.daily}`, `DAILY CHALLENGE #${r.daily}`) : gameName(l).toUpperCase();

/** Enlace para jugar la misma partida que otro (mismo reto o misma semilla). */
export function replayHref(r: Pick<SharedResult, "seed" | "daily">, l: Locale = "es") {
  if (!r.seed) return localePath(l, "/jugar");
  const q = new URLSearchParams({ semilla: String(r.seed) });
  if (r.daily) q.set("reto", String(r.daily));
  return localePath(l, `/jugar?${q}`);
}

/** Formato 7.023 (7,023 en inglés): separador de miles también con cuatro cifras. */
export const fmt = (n: number, l: Locale = "es") => fmtNum(l, n);

const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const statsLine = (r: SharedResult, l: Locale = "es") =>
  l === "en"
    ? `${pl(r.wins, "battle", "battles")} · ${pl(r.objectives, "objective", "objectives")} · ${pl(r.bosses, "boss", "bosses")}`
    : `${pl(r.wins, "combate", "combates")} · ${pl(r.objectives, "objetivo", "objetivos")} · ${pl(r.bosses, "jefe", "jefes")}`;

const SHORT = { es: ["PLAY-IN", "SUIZA", "CUARTOS", "SEMIS", "FINAL"], en: ["PLAY-IN", "SWISS", "QUARTERS", "SEMIS", "FINAL"] };
/** Fases en corto para la ruta de la tarjeta. */
export const stageShort = (l: Locale = "es") => SHORT[l];

const NAMES = { es: ["Play-In", "Fase suiza", "Cuartos", "Semis", "Final"], en: ["Play-In", "Swiss stage", "Quarters", "Semis", "Final"] };
/** Nombre de cada fase (en el servidor no se usa el idioma del motor). */
export const stageName = (i: number, l: Locale = "es") => NAMES[l][i] ?? STAGES[i]?.name ?? "";

/** Titular del resultado, de más amargo a más épico. */
const HEADLINES = {
  es: ["Fuera en el Play-In", "Eliminado en la fase suiza", "Caído en cuartos", "¡Me quedé en semis!", "¡A un paso de la copa!"],
  en: ["Out in the Play-In", "Knocked out in the Swiss stage", "Fell in the quarters", "Made it to the semis!", "One step from the Cup!"],
};
const EMOJI = ["😭", "💀", "⚔️", "🔥", "😱"];
const WHERE = {
  es: ["en el Play-In", "en la fase suiza", "en cuartos", "en semis", "en la Final"],
  en: ["in the Play-In", "in the Swiss stage", "in the quarters", "in the semis", "in the Final"],
};

export function resultLine(r: SharedResult, l: Locale = "es") {
  if (r.champion) return tr(l, "¡CAMPEÓN DEL MUNDO!", "WORLD CHAMPION!");
  return HEADLINES[l][r.stage] ?? tr(l, `Eliminado en ${stageName(r.stage, l)}`, `Knocked out in ${stageName(r.stage, l)}`);
}

/** Quién te eliminó y dónde, o cómo ganaste. */
export function resultSub(r: SharedResult, l: Locale = "es") {
  if (r.champion) return tr(l, `Sin perder ni un combate, con ${r.name} (${r.team})`, `Without losing a single battle, with ${r.name} (${r.team})`);
  const where = WHERE[l][r.stage] ?? "";
  if (l === "en") return r.killer ? `${r.killer} knocked me out ${where}` : `Knocked out ${where}`;
  return r.killer ? `${r.killer} me eliminó ${where}` : `Eliminado ${where}`;
}

/** Hasta dónde llegaste, fase a fase: ganada, perdida o sin jugar. */
export function stageStates(r: SharedResult): ("won" | "lost" | "none")[] {
  return STAGES.map((_, i) => (i < r.stage || r.champion ? "won" : i === r.stage ? "lost" : "none"));
}

export function stageTrack(r: SharedResult) {
  const squares = stageStates(r)
    .map((s) => (s === "won" ? "🟩" : s === "lost" ? "🟥" : "⬛"))
    .join("");
  return r.champion ? `${squares}🏆` : squares;
}

export function shareText(r: SharedResult, l: Locale = "es") {
  if (l === "en") {
    const head = r.champion ? "🏆 WORLD CHAMPION! 🏆" : `${EMOJI[r.stage] ?? "💀"} ${resultLine(r, l).toUpperCase()}`;
    const what = r.champion ? "I won Worlds without losing a single battle 😤" : `${resultSub(r, l)}.`;
    const close = r.daily
      ? "Same run for everyone today and only one life. Can you beat me? 👇"
      : r.champion
        ? "Road to the Cup: one life and almost nobody makes it. Dare to try? 👇"
        : "Road to the Cup: one life. Can you go further? 👇";
    return [
      ...(r.daily ? [`📅 Daily challenge #${r.daily} · Road to the Cup`] : []),
      head,
      "",
      what,
      `${stageTrack(r)}  ${fmt(r.score, l)} points`,
      `⚔️ ${pl(r.wins, "battle", "battles")} · 🐉 ${pl(r.objectives, "objective", "objectives")} · 👑 ${pl(r.bosses, "boss", "bosses")}`,
      `🎮 Trainer: ${r.name} (${r.team})`,
      "",
      close,
      "#Worlds2026",
    ].join("\n");
  }
  const head = r.champion ? "🏆 ¡CAMPEÓN DEL MUNDO! 🏆" : `${EMOJI[r.stage] ?? "💀"} ${resultLine(r).toUpperCase()}`;
  const what = r.champion ? "He ganado el Mundial sin perder ni un solo combate 😤" : `${resultSub(r)}.`;
  const close = r.daily
    ? "Misma partida para todos hoy y una sola vida. ¿Me superas? 👇"
    : r.champion
      ? "Camino a la Copa: una sola vida y casi nadie lo consigue. ¿Te atreves? 👇"
      : "Camino a la Copa: una sola vida. ¿Llegas tú más lejos? 👇";
  return [
    ...(r.daily ? [`📅 Reto del día #${r.daily} · Camino a la Copa`] : []),
    head,
    "",
    what,
    `${stageTrack(r)}  ${fmt(r.score)} puntos`,
    `⚔️ ${pl(r.wins, "combate", "combates")} · 🐉 ${pl(r.objectives, "objetivo", "objetivos")} · 👑 ${pl(r.bosses, "jefe", "jefes")}`,
    `🎮 Entrenador: ${r.name} (${r.team})`,
    "",
    close,
    "#Worlds2026",
  ].join("\n");
}

// ---------- Enlace ----------

export function toQuery(r: SharedResult) {
  const q = new URLSearchParams({ n: r.name, tm: r.team, s: String(r.stage) });
  if (r.champion) q.set("c", "1");
  q.set("pt", String(r.score));
  q.set("w", String(r.wins));
  q.set("o", String(r.objectives));
  q.set("b", String(r.bosses));
  if (r.killer) q.set("k", r.killer);
  q.set("t", r.champs.map((c) => `${c.id}.${c.level}`).join(","));
  if (r.seed) q.set("sd", String(r.seed));
  if (r.daily) q.set("d", String(r.daily));
  return q.toString();
}

const text = (v: string | null, max = 28) =>
  (v ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .trim()
    .slice(0, max);
const int = (v: string | null, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));

/** Lee un resultado del enlace; los valores se recortan para que nadie rompa la tarjeta. */
export function fromQuery(q: URLSearchParams): SharedResult | null {
  const name = text(q.get("n"), 24);
  const team = text(q.get("tm"), 8);
  if (!name || !team) return null;
  const champs = (q.get("t") ?? "")
    .split(",")
    .slice(0, 5)
    .map((x) => {
      const [id, lv] = x.split(".");
      return {
        id: /^[A-Za-z]{2,20}$/.test(id ?? "") ? id : "",
        level: int(lv ?? "", 99) || 1,
      };
    })
    .filter((c) => c.id);
  return {
    name,
    team,
    stage: int(q.get("s"), STAGES.length - 1),
    champion: q.get("c") === "1",
    score: int(q.get("pt"), 999999),
    wins: int(q.get("w"), 999),
    objectives: int(q.get("o"), 999),
    bosses: int(q.get("b"), 99),
    killer: text(q.get("k"), 32) || undefined,
    champs,
    seed: int(q.get("sd"), 2 ** 32 - 1) || undefined,
    daily: int(q.get("d"), 9999) || undefined,
  };
}
