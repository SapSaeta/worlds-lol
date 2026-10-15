// Cliente de la API que usa lolesports.com. No es una API pública documentada:
// la clave es la misma que usa la web oficial y puede cambiar sin aviso, por eso
// todo el parseo es defensivo y, si algo falla, se sirven datos de demostración.

import { TOURNAMENT, type TournamentConfig } from "@/config/tournament";
import { demoData } from "@/lib/demo";
import { buildTeams } from "@/lib/teams";
import type { Gpr, LiveStream, Match, MatchTeam, Player, WorldsData } from "@/lib/types";

const BASE = "https://esports-api.lolesports.com/persisted/gw";
const API_KEY = process.env.LOLESPORTS_API_KEY ?? "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const HL = "es-ES";

export type Json = Record<string, any>;

/** revalidate en segundos, o false para datos que ya no cambian. */
export async function api(path: string, params: Record<string, string>, revalidate: number | false): Promise<Json> {
  const qs = new URLSearchParams({ hl: HL, ...params });
  const res = await fetch(`${BASE}/${path}?${qs}`, {
    headers: { "x-api-key": API_KEY },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

const FEED = "https://feed.lolesports.com/livestats/v1";

export const https = (url: string | undefined) => (url ?? "").replace(/^http:\/\//, "https://");

function inWindow(t: TournamentConfig, iso: string) {
  const ms = Date.parse(iso);
  return ms >= Date.parse(t.start) && ms <= Date.parse(t.end);
}

function toMatch(ev: Json): Match | null {
  if (ev?.type !== "match" || !ev.match?.teams || ev.match.teams.length < 2) return null;
  const teams = ev.match.teams.slice(0, 2).map(
    (t: Json): MatchTeam => ({
      code: t.code ?? "TBD",
      name: t.name ?? "Por decidir",
      image: https(t.image),
      gameWins: t.result?.gameWins ?? 0,
      outcome: t.result?.outcome ?? null,
    }),
  ) as [MatchTeam, MatchTeam];
  return {
    id: String(ev.match.id ?? ev.id),
    startTime: ev.startTime,
    state: ev.state,
    blockName: ev.blockName ?? "",
    bestOf: ev.match.strategy?.count ?? 1,
    teams,
  };
}

export async function fetchSchedule(t: TournamentConfig = TOURNAMENT): Promise<Match[]> {
  // Los partidos ya jugados de torneos pasados no cambian: se cachean un día.
  const ttl = Date.parse(t.end) < Date.now() ? 86400 : 60;
  const first = await api("getSchedule", { leagueId: t.leagueId }, ttl);
  const events: Json[] = [...(first.data?.schedule?.events ?? [])];
  const start = Date.parse(t.start);
  const end = Date.parse(t.end);
  // Recorremos páginas hacia atrás y hacia delante hasta salir de la ventana del torneo.
  for (const dir of ["older", "newer"] as const) {
    let token: string | undefined = first.data?.schedule?.pages?.[dir];
    for (let i = 0; token && i < 8; i++) {
      const page = await api("getSchedule", { leagueId: t.leagueId, pageToken: token }, ttl);
      const evs: Json[] = page.data?.schedule?.events ?? [];
      events.push(...evs);
      const times = evs.map((e) => Date.parse(e.startTime));
      if (!times.length) break;
      if (dir === "older" && Math.max(...times) < start) break;
      if (dir === "newer" && Math.min(...times) > end) break;
      token = page.data?.schedule?.pages?.[dir];
    }
  }
  const seen = new Set<string>();
  return events
    .filter((e) => inWindow(t, e.startTime))
    .map(toMatch)
    .filter((m): m is Match => !!m && !seen.has(m.id) && !!seen.add(m.id))
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

async function fetchLiveStreams(t: TournamentConfig): Promise<LiveStream[]> {
  const live = await api("getLive", {}, 60);
  const events: Json[] = live.data?.schedule?.events ?? [];
  return events
    .filter((e) => e.league?.id === t.leagueId || /world/i.test(e.league?.slug ?? ""))
    .flatMap((e) => (e.streams ?? []) as Json[])
    .filter((s) => typeof s.locale === "string" && s.locale.startsWith("es"))
    .map((s) => ({ provider: s.provider, channel: s.parameter, locale: s.locale }));
}

/** Slugs de los equipos del torneo: los clasificados de la configuración más los de la clasificación oficial. */
export async function fetchTeamSlugs(t: TournamentConfig): Promise<string[]> {
  const slugs = new Set<string>(t.teams ?? []);
  const s = await api("getStandings", { tournamentId: t.tournamentId }, 600).catch((err) => {
    if (!slugs.size) throw err;
    return {} as Json;
  });
  for (const stage of s.data?.standings?.[0]?.stages ?? [])
    for (const section of stage.sections ?? []) {
      for (const r of section.rankings ?? []) for (const team of r.teams ?? []) if (team.slug) slugs.add(team.slug);
      for (const m of section.matches ?? []) for (const team of m.teams ?? []) if (team.slug && team.slug !== "tbd") slugs.add(team.slug);
    }
  return [...slugs];
}

export type TeamDetails = {
  id: string;
  code: string;
  name: string;
  image: string;
  region: string | null;
  players: (Player & { id: string })[];
};

/** Ficha de un equipo por slug o por id, con su plantilla. */
export async function fetchTeamDetails(idOrSlug: string): Promise<TeamDetails | null> {
  const r = await api("getTeams", { id: idOrSlug }, 86400);
  const t: Json | undefined = r.data?.teams?.[0];
  if (!t) return null;
  return {
    id: String(t.id),
    code: t.code,
    name: t.name ?? t.code,
    image: https(t.image),
    region: t.homeLeague?.name ?? t.homeLeague?.region ?? null,
    players: (t.players ?? []).map((p: Json) => ({
      id: String(p.id),
      name: (p.summonerName ?? "").trim(),
      realName: [p.firstName, p.lastName].filter(Boolean).join(" ").trim(),
      role: p.role ?? "",
      // La foto genérica de lolesports no aporta nada: mejor el escudo del equipo.
      image: /default-headshot/.test(p.image ?? "") ? "" : https(p.image),
    })),
  };
}

// ---------- Ranking global (Global Power Rankings) ----------

// lolesports.com solo acepta consultas GraphQL de su lista de consultas
// persistidas. Este es el id de GetTeamGpr; si Riot lo cambia, la petición
// falla, el ranking deja de salir y queda un aviso en `warnings`.
const GQL = "https://lolesports.com/api/gql";
const GPR_QUERY_ID = "9411e88d02eb7f7ea8516ed9f206cb557d150208d6654c06f044781f8d9789ba";

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Ranking global por id de equipo, a fecha de hoy o del final del torneo si ya acabó. */
export async function fetchGpr(t: TournamentConfig): Promise<Map<string, Gpr>> {
  const end = Math.min(Date.now(), Date.parse(t.end));
  const variables = { hl: HL, sport: "lol", step: 1000, startDate: isoDay(end - 14 * 86400e3), endDate: isoDay(end) };
  const qs = new URLSearchParams({
    operationName: "GetTeamGpr",
    variables: JSON.stringify(variables),
    extensions: JSON.stringify({ persistedQuery: { version: 1, sha256Hash: GPR_QUERY_ID } }),
  });
  const res = await fetch(`${GQL}?${qs}`, {
    headers: { "apollo-require-preflight": "true", "apollographql-client-name": "Esports Web", "apollographql-client-version": "1.0.0" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`GetTeamGpr → HTTP ${res.status}`);
  const json: Json = await res.json();
  const ranking = new Map<string, Gpr>();
  for (const x of json.data?.teamGPR ?? []) {
    const cur = x.currentTeamGPR;
    if (x.team?.id && cur?.rank) ranking.set(String(x.team.id), { rank: cur.rank, score: Math.round(cur.gprScore), date: cur.dateCalculated });
  }
  if (!ranking.size) throw new Error("GetTeamGpr sin equipos");
  return ranking;
}

// ---------- Plantilla activa ----------

/** Series recientes que se miran para saber quién juega de verdad. */
const RECENT_SERIES = 3;

async function feedWindow(gameId: string): Promise<Json | null> {
  const res = await fetch(`${FEED}/window/${gameId}`, { cache: "force-cache" });
  if (!res.ok || res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function leagueIdsByName(): Promise<Map<string, string>> {
  const r = await api("getLeagues", {}, 86400);
  return new Map((r.data?.leagues ?? []).map((l: Json) => [String(l.name), String(l.id)]));
}

/** Ids de los jugadores que han jugado con el equipo sus últimas series (en su liga o en el torneo). */
async function recentPlayerIds(team: TeamDetails, leagueIds: string[]): Promise<Set<string>> {
  const schedules = await Promise.all(leagueIds.map((id) => api("getSchedule", { leagueId: id }, 3600).catch(() => null)));
  const events = schedules
    .flatMap((s) => (s?.data?.schedule?.events ?? []) as Json[])
    .filter((e) => e.state === "completed" && e.match?.id && (e.match.teams ?? []).some((x: Json) => x.code === team.code))
    .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))
    .slice(0, RECENT_SERIES);
  const ids = new Set<string>();
  for (const e of events) {
    const d = await api("getEventDetails", { id: String(e.match.id) }, false).catch(() => null);
    const games: Json[] = (d?.data?.event?.match?.games ?? []).filter((g: Json) => g.state === "completed");
    const windows = await Promise.all(games.map((g) => feedWindow(String(g.id)).catch(() => null)));
    for (const w of windows)
      for (const side of [w?.gameMetadata?.blueTeamMetadata, w?.gameMetadata?.redTeamMetadata])
        if (side && String(side.esportsTeamId) === team.id)
          for (const p of side.participantMetadata ?? []) if (p.esportsPlayerId) ids.add(String(p.esportsPlayerId));
  }
  return ids;
}

/**
 * lolesports mete en la plantilla de cada equipo a su academia (T1 trae 14
 * jugadores). Nos quedamos con los que han jugado sus últimas series oficiales;
 * si no hay partidas recientes, se deja la plantilla tal cual.
 */
export async function withActiveRoster(team: TeamDetails, t: TournamentConfig): Promise<TeamDetails> {
  const leagues = await leagueIdsByName().catch(() => new Map<string, string>());
  const home = team.region ? leagues.get(team.region) : undefined;
  const played = await recentPlayerIds(team, [t.leagueId, ...(home ? [home] : [])]).catch(() => new Set<string>());
  if (!played.size) return team;
  return { ...team, players: team.players.filter((p) => played.has(p.id)) };
}

export async function getWorldsData(t: TournamentConfig = TOURNAMENT): Promise<WorldsData> {
  try {
    const matches = await fetchSchedule(t);
    if (matches.length === 0) throw new Error("El calendario llegó vacío");
    const teams = buildTeams(matches);

    const warnings: string[] = [];
    const warn = (what: string) => (err: unknown) => {
      warnings.push(`${what}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    };
    const ongoing = Date.parse(t.end) > Date.now();
    const [liveStreams, details, gpr] = await Promise.all([
      fetchLiveStreams(t).catch(warn("directo")),
      fetchTeamSlugs(t)
        .then((slugs) => {
          if (!slugs.length) warnings.push("standings: sin equipos todavía");
          return Promise.allSettled(
            slugs.map(async (slug) => {
              const team = await fetchTeamDetails(slug);
              return team && ongoing ? withActiveRoster(team, t) : team;
            }),
          );
        })
        .catch(warn("standings")),
      fetchGpr(t).catch((err) => {
        warn("ranking global")(err);
        return new Map<string, Gpr>();
      }),
    ]);
    for (const d of details) {
      if (d.status === "rejected") {
        warn("equipo")(d.reason);
        continue;
      }
      if (!d.value) continue;
      let team = teams.find((x) => x.code === d.value!.code);
      if (!team) {
        // Equipos clasificados que aún no aparecen en el calendario.
        team = { code: d.value.code, name: d.value.name, image: d.value.image, region: null, wins: 0, losses: 0, gameWins: 0, gameLosses: 0, form: [], players: [] };
        teams.push(team);
      }
      team.region = d.value.region;
      team.players = d.value.players;
      team.gpr = gpr.get(d.value.id) ?? null;
    }

    return {
      tournament: { name: t.name, tagline: t.tagline },
      updatedAt: new Date().toISOString(),
      source: "lolesports",
      teams,
      matches,
      liveStreams,
      warnings,
    };
  } catch (err) {
    return { ...demoData(), error: err instanceof Error ? err.message : String(err) };
  }
}
