import type { Match, MatchTeam, Team } from "@/lib/types";

/** Calcula el balance de cada equipo a partir de las series jugadas. */
export function buildTeams(matches: Match[]): Team[] {
  const map = new Map<string, Team>();
  const get = (mt: MatchTeam) => {
    let t = map.get(mt.code);
    if (!t) {
      t = { code: mt.code, name: mt.name, image: mt.image, region: null, wins: 0, losses: 0, gameWins: 0, gameLosses: 0, form: [], players: [] };
      map.set(mt.code, t);
    }
    return t;
  };
  for (const m of matches) {
    const [a, b] = m.teams;
    if (a.code === "TBD" || b.code === "TBD") continue;
    const ta = get(a);
    const tb = get(b);
    if (m.state !== "completed") continue;
    ta.gameWins += a.gameWins;
    ta.gameLosses += b.gameWins;
    tb.gameWins += b.gameWins;
    tb.gameLosses += a.gameWins;
    const aWon = a.outcome === "win" || (a.outcome === null && a.gameWins > b.gameWins);
    (aWon ? ta : tb).wins++;
    (aWon ? tb : ta).losses++;
    ta.form.push(aWon ? "W" : "L");
    tb.form.push(aWon ? "L" : "W");
  }
  return [...map.values()];
}
