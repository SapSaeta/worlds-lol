// Coloca las series de cada fase en su sitio del cuadro: doble eliminación del
// Play-In, rondas y balances de la fase suiza y árbol de las eliminatorias.
// La API solo da la lista de series de cada fase, así que la estructura se
// deduce del orden por fecha y, cuando ya hay equipos, de quién ganó a quién.
// Sin dependencias de servidor: se usa desde el navegador.

import type { Match, MatchTeam } from "@/lib/types";

export type Slot = {
  match: Match;
  /** Qué hay que hacer para llegar a cada hueco mientras sea "por decidir" */
  hints?: [string, string];
  /** La serie está colocada a ojo (rival por sortear): su fecha puede no ser la de este hueco */
  approx?: boolean;
};

export type Group = { title?: string; slots: Slot[] };
export type Column = { title: string; groups: Group[]; note?: string };

export type SwissRecord = { team: MatchTeam; w: number; l: number };

export type StageLayout = {
  kind: "double" | "swiss" | "bracket" | "list";
  columns: Column[];
  /** Solo fase suiza: quién ya ha pasado y quién se ha ido */
  qualified?: SwissRecord[];
  eliminated?: SwissRecord[];
};

export const isTbd = (t: MatchTeam) => !t.code || t.code === "TBD";

const time = (m: Match) => Date.parse(m.startTime) || Infinity;
export const byTime = (a: Match, b: Match) => time(a) - time(b) || a.id.localeCompare(b.id);

function result(m: Match): { win: MatchTeam; loss: MatchTeam } | null {
  if (m.state !== "completed") return null;
  const [a, b] = m.teams;
  if (isTbd(a) || isTbd(b)) return null;
  const aWon = a.outcome === "win" || (a.outcome == null && a.gameWins > b.gameWins);
  return aWon ? { win: a, loss: b } : { win: b, loss: a };
}

export const winnerOf = (m: Match) => result(m)?.win ?? null;
const has = (m: Match, code: string | undefined) => !!code && m.teams.some((t) => t.code === code);
/** "KC/C9" si ya se conocen los dos equipos, si no el nombre de la ronda. */
const pair = (m: Match, fallback: string) => (m.teams.some(isTbd) ? fallback : m.teams.map((t) => t.code).join("/"));

const list = (ms: Match[], title: string): StageLayout => ({ kind: "list", columns: [{ title, groups: [{ slots: ms.map((match) => ({ match })) }] }] });

/* ---------- Play-In ---------- */

export function playInLayout(matches: Match[]): StageLayout {
  const ms = [...matches].sort(byTime);
  if (ms.length === 1) return list(ms, "Final del Play-In");
  if (ms.length !== 6) return list(ms, "Partidos");

  // Doble eliminación de 4: dos semis arriba, luego final superior y semi
  // inferior (mismo día), final inferior y gran final.
  const [a, b, x, y, lowerFinal, grandFinal] = ms;
  let upperFinal = x;
  let lowerSemi = y;
  const wa = winnerOf(a)?.code;
  const wb = winnerOf(b)?.code;
  if (has(y, wa) || has(y, wb)) [upperFinal, lowerSemi] = [y, x];

  const pa = pair(a, "semi 1");
  const pb = pair(b, "semi 2");
  return {
    kind: "double",
    columns: [
      { title: "Ronda 1", groups: [{ title: "Semis del cuadro superior", slots: [{ match: a }, { match: b }] }] },
      {
        title: "Ronda 2",
        groups: [
          { title: "Final superior", slots: [{ match: upperFinal, hints: [`Gana ${pa}`, `Gana ${pb}`] }] },
          { title: "Semi inferior", slots: [{ match: lowerSemi, hints: [`Pierde ${pa}`, `Pierde ${pb}`] }] },
        ],
      },
      { title: "Ronda 3", groups: [{ title: "Final inferior", slots: [{ match: lowerFinal, hints: ["Pierde final sup.", "Gana semi inf."] }] }] },
      {
        title: "Gran final",
        groups: [{ slots: [{ match: grandFinal, hints: ["Gana final sup.", "Gana final inf."] }] }],
        note: "El campeón pasa a la fase suiza",
      },
    ],
  };
}

/* ---------- Fase suiza ---------- */

// 16 equipos, 5 rondas: 8 + 8 + 8 + 6 + 3 series. Cada ronda se juega por
// balances (1-0 contra 1-0, etc.).
const ROUND_SIZES = [8, 8, 8, 6, 3];
const POOLS = [["0-0"], ["1-0", "0-1"], ["2-0", "1-1", "0-2"], ["2-1", "1-2"], ["2-2"]];
const POOL_SIZE: Record<string, number> = { "0-0": 8, "1-0": 4, "0-1": 4, "2-0": 2, "1-1": 4, "0-2": 2, "2-1": 3, "1-2": 3, "2-2": 3 };
const POOL_NOTE: Record<string, string> = { "2-0": "a por la plaza", "0-2": "a vida o muerte", "2-1": "a por la plaza", "1-2": "a vida o muerte", "2-2": "todo o nada" };

export function swissLayout(matches: Match[]): StageLayout {
  const ms = [...matches].sort(byTime);
  if (ms.length !== ROUND_SIZES.reduce((s, n) => s + n, 0)) return list(ms, "Partidos");

  const rec = new Map<string, SwissRecord>();
  const recordOf = (t: MatchTeam) => rec.get(t.code) ?? rec.set(t.code, { team: t, w: 0, l: 0 }).get(t.code)!;

  let i = 0;
  const columns = ROUND_SIZES.map((n, r): Column => {
    const round = ms.slice(i, (i += n));
    const pools = new Map<string, Slot[]>(POOLS[r].map((k) => [k, []]));
    const pending: Match[] = [];
    for (const m of round) {
      if (m.teams.some(isTbd)) {
        pending.push(m);
        continue;
      }
      const { w, l } = recordOf(m.teams[0]);
      const key = `${w}-${l}`;
      if (!pools.has(key)) pools.set(key, []);
      pools.get(key)!.push({ match: m });
    }
    // Series sin rivales todavía: al hueco libre que encaje con su formato
    // (en la ronda 3 el 1-1 es al mejor de 1 y el 2-0 y el 0-2 al mejor de 3).
    for (const m of pending) {
      const free = [...pools.keys()].filter((k) => pools.get(k)!.length < (POOL_SIZE[k] ?? 0));
      const key = (r === 2 ? free.find((k) => (k === "1-1") === (m.bestOf === 1)) : undefined) ?? free[0] ?? [...pools.keys()].pop()!;
      pools.get(key)!.push({ match: m, approx: true });
    }
    for (const m of round) {
      const res = result(m);
      if (!res) continue;
      recordOf(res.win).w++;
      recordOf(res.loss).l++;
    }
    return {
      title: `Ronda ${r + 1}`,
      groups: [...pools].map(([k, slots]) => ({ title: POOL_NOTE[k] ? `${k} · ${POOL_NOTE[k]}` : k, slots })),
    };
  });

  const all = [...rec.values()];
  return {
    kind: "swiss",
    columns,
    qualified: all.filter((r) => r.w >= 3).sort((a, b) => a.l - b.l),
    eliminated: all.filter((r) => r.l >= 3).sort((a, b) => b.w - a.w),
  };
}

/* ---------- Eliminatorias ---------- */

export function knockoutLayout(matches: Match[]): StageLayout {
  const ms = [...matches].sort(byTime);
  if (ms.length !== 7) return list(ms, "Partidos");
  let qf = ms.slice(0, 4);
  const sf = ms.slice(4, 6);
  const final = ms[6];

  // Por fecha, los cuartos 1 y 2 van a la primera semi y el 3 y el 4 a la
  // segunda. Si los resultados dicen otra cosa, mandan los resultados.
  const feeds = sf.flatMap((s) => qf.filter((q) => has(s, winnerOf(q)?.code)));
  if (new Set(feeds).size === 4) qf = feeds;

  const q = qf.map((m, k) => pair(m, `cuartos ${k + 1}`));
  const s = sf.map((m, k) => pair(m, `semi ${k + 1}`));
  return {
    kind: "bracket",
    columns: [
      { title: "Cuartos de final", groups: [{ slots: qf.map((match) => ({ match, hints: ["Por sortear", "Por sortear"] as [string, string] })) }] },
      {
        title: "Semifinales",
        groups: [{ slots: sf.map((match, k) => ({ match, hints: [`Gana ${q[k * 2]}`, `Gana ${q[k * 2 + 1]}`] as [string, string] })) }],
      },
      { title: "Final", groups: [{ slots: [{ match: final, hints: [`Gana ${s[0]}`, `Gana ${s[1]}`] }] }] },
    ],
  };
}

export function stageLayout(slug: string, matches: Match[]): StageLayout {
  if (slug === "play_ins") return playInLayout(matches);
  if (slug === "swiss") return swissLayout(matches);
  if (slug === "knockouts") return knockoutLayout(matches);
  return list([...matches].sort(byTime), "Partidos");
}

export type StageState = "done" | "live" | "next";

export function stageState(matches: Match[]): StageState {
  if (matches.every((m) => m.state === "completed")) return "done";
  if (matches.some((m) => m.state !== "unstarted")) return "live";
  return "next";
}
