// Resultado de una partida en forma compartible: lo justo para dibujar la
// tarjeta y escribir el mensaje, y viajar en el enlace /jugar/r?… que se
// publica (así X, WhatsApp o Telegram enseñan la tarjeta en el post).

import { STAGES } from "@/lib/game/engine";

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

/** Etiqueta corta de la cabecera de la tarjeta. */
export const cardTitle = (r: Pick<SharedResult, "daily">) => (r.daily ? `RETO DEL DIA #${r.daily}` : "CAMINO A LA COPA");

/** Enlace para jugar la misma partida que otro (mismo reto o misma semilla). */
export function replayHref(r: Pick<SharedResult, "seed" | "daily">) {
  if (!r.seed) return "/jugar";
  const q = new URLSearchParams({ semilla: String(r.seed) });
  if (r.daily) q.set("reto", String(r.daily));
  return `/jugar?${q}`;
}

/** Formato 7.023: punto de miles también con cuatro cifras. */
export const fmt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

const pl = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const statsLine = (r: SharedResult) => `${pl(r.wins, "combate", "combates")} · ${pl(r.objectives, "objetivo", "objetivos")} · ${pl(r.bosses, "jefe", "jefes")}`;

export const STAGE_SHORT = ["PLAY-IN", "SUIZA", "CUARTOS", "SEMIS", "FINAL"];

/** Titular del resultado, de más amargo a más épico. */
const HEADLINES = ["Fuera en el Play-In", "Eliminado en la fase suiza", "Caído en cuartos", "¡Me quedé en semis!", "¡A un paso de la copa!"];
const EMOJI = ["😭", "💀", "⚔️", "🔥", "😱"];
const WHERE = ["en el Play-In", "en la fase suiza", "en cuartos", "en semis", "en la Final"];

export function resultLine(r: SharedResult) {
  return r.champion ? "¡CAMPEÓN DEL MUNDO!" : (HEADLINES[r.stage] ?? `Eliminado en ${STAGES[r.stage]?.name ?? ""}`);
}

/** Quién te eliminó y dónde, o cómo ganaste. */
export function resultSub(r: SharedResult) {
  if (r.champion) return `Sin perder ni un combate, con ${r.name} (${r.team})`;
  const where = WHERE[r.stage] ?? "";
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

export function shareText(r: SharedResult) {
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
