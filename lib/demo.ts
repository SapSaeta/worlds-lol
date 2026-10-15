// Datos de demostración: se usan si la API de lolesports no responde
// (por ejemplo en local sin red). La web lo indica claramente.

import { TOURNAMENT } from "@/config/tournament";
import { buildTeams } from "@/lib/teams";
import type { Match, MatchTeam, WorldsData } from "@/lib/types";

const TEAMS: [code: string, name: string, region: string][] = [
  ["GEN", "Gen.G", "LCK"],
  ["HLE", "Hanwha Life Esports", "LCK"],
  ["T1", "T1", "LCK"],
  ["BLG", "Bilibili Gaming", "LPL"],
  ["AL", "Anyone's Legend", "LPL"],
  ["TES", "Top Esports", "LPL"],
  ["G2", "G2 Esports", "LEC"],
  ["FNC", "Fnatic", "LEC"],
  ["KC", "Karmine Corp", "LEC"],
  ["FLY", "FlyQuest", "LCS"],
  ["C9", "Cloud9", "LCS"],
  ["TL", "Team Liquid", "LCS"],
  ["CFO", "CTBC Flying Oyster", "LCP"],
  ["PSG", "PSG Talon", "LCP"],
  ["GAM", "GAM Esports", "LCP"],
  ["VKS", "Vivo Keyd Stars", "CBLOL"],
];

const ROLES = ["top", "jungle", "mid", "bottom", "support"];

function team(code: string, gameWins: number, outcome: MatchTeam["outcome"]): MatchTeam {
  const t = TEAMS.find((x) => x[0] === code)!;
  return { code, name: t[1], image: "", gameWins, outcome };
}

export function demoData(): WorldsData {
  const now = Date.now();
  const hour = 3600_000;
  // Ronda 1 del suizo terminada, ronda 2 en curso.
  const pairs: [string, string, number, number][] = [
    ["GEN", "VKS", 1, 0], ["BLG", "GAM", 1, 0], ["G2", "TL", 1, 0], ["HLE", "PSG", 1, 0],
    ["FLY", "TES", 1, 0], ["KC", "CFO", 0, 1], ["T1", "C9", 1, 0], ["AL", "FNC", 0, 1],
  ];
  const matches: Match[] = pairs.map(([a, b, wa, wb], i) => ({
    id: `demo-r1-${i}`,
    startTime: new Date(now - (30 - i * 2) * hour).toISOString(),
    state: "completed",
    blockName: "Suizo · Ronda 1",
    bestOf: 1,
    teams: [team(a, wa, wa > wb ? "win" : "loss"), team(b, wb, wb > wa ? "win" : "loss")],
  }));
  const r2: [string, string][] = [["GEN", "FNC"], ["T1", "CFO"], ["BLG", "FLY"], ["HLE", "G2"], ["VKS", "AL"], ["TES", "KC"]];
  r2.forEach(([a, b], i) =>
    matches.push({
      id: `demo-r2-${i}`,
      startTime: new Date(now + (i - 1) * hour).toISOString(),
      state: i === 0 ? "completed" : i === 1 ? "inProgress" : "unstarted",
      blockName: "Suizo · Ronda 2",
      bestOf: 1,
      teams: i === 0 ? [team(a, 1, "win"), team(b, 0, "loss")] : [team(a, 0, null), team(b, 0, null)],
    }),
  );

  const teams = buildTeams(matches).map((t) => ({
    ...t,
    region: TEAMS.find((x) => x[0] === t.code)?.[2] ?? null,
    players: ROLES.map((role, i) => ({ name: `${t.code}·${i + 1}`, realName: "", role, image: "" })),
  }));

  return {
    tournament: { name: TOURNAMENT.name, tagline: TOURNAMENT.tagline },
    updatedAt: new Date(now).toISOString(),
    source: "demo",
    teams,
    matches,
    liveStreams: [],
  };
}
