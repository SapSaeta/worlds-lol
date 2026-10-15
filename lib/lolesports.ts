// Cliente de la API que usa lolesports.com. No es una API pública documentada:
// la clave es la misma que usa la web oficial y puede cambiar sin aviso, por eso
// todo el parseo es defensivo y, si algo falla, se sirven datos de demostración.

import { TOURNAMENT } from "@/config/tournament";
import { demoData } from "@/lib/demo";
import { buildTeams } from "@/lib/teams";
import type { LiveStream, Match, MatchTeam, Player, WorldsData } from "@/lib/types";

const BASE = "https://esports-api.lolesports.com/persisted/gw";
const API_KEY = process.env.LOLESPORTS_API_KEY ?? "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
const HL = "es-ES";

type Json = Record<string, any>;

async function api(path: string, params: Record<string, string>, revalidate: number): Promise<Json> {
  const qs = new URLSearchParams({ hl: HL, ...params });
  const res = await fetch(`${BASE}/${path}?${qs}`, {
    headers: { "x-api-key": API_KEY },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

const https = (url: string | undefined) => (url ?? "").replace(/^http:\/\//, "https://");

function inWindow(iso: string) {
  const t = Date.parse(iso);
  return t >= Date.parse(TOURNAMENT.start) && t <= Date.parse(TOURNAMENT.end);
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

async function fetchSchedule(): Promise<Match[]> {
  const first = await api("getSchedule", { leagueId: TOURNAMENT.leagueId }, 60);
  const events: Json[] = [...(first.data?.schedule?.events ?? [])];
  // Recorremos páginas hacia atrás y hacia delante para tener el torneo entero.
  for (const dir of ["older", "newer"] as const) {
    let token: string | undefined = first.data?.schedule?.pages?.[dir];
    for (let i = 0; token && i < 6; i++) {
      const page = await api("getSchedule", { leagueId: TOURNAMENT.leagueId, pageToken: token }, 60);
      const evs: Json[] = page.data?.schedule?.events ?? [];
      events.push(...evs);
      if (!evs.some((e) => inWindow(e.startTime))) break;
      token = page.data?.schedule?.pages?.[dir];
    }
  }
  const seen = new Set<string>();
  return events
    .filter((e) => inWindow(e.startTime))
    .map(toMatch)
    .filter((m): m is Match => !!m && !seen.has(m.id) && !!seen.add(m.id))
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}

async function fetchLiveStreams(): Promise<LiveStream[]> {
  const live = await api("getLive", {}, 60);
  const events: Json[] = live.data?.schedule?.events ?? [];
  return events
    .filter((e) => e.league?.id === TOURNAMENT.leagueId || /world/i.test(e.league?.slug ?? ""))
    .flatMap((e) => (e.streams ?? []) as Json[])
    .filter((s) => typeof s.locale === "string" && s.locale.startsWith("es"))
    .map((s) => ({ provider: s.provider, channel: s.parameter, locale: s.locale }));
}

/** Slugs de los equipos del torneo vigente, vía standings. */
async function fetchTeamSlugs(): Promise<string[]> {
  const t = await api("getTournamentsForLeague", { leagueId: TOURNAMENT.leagueId }, 3600);
  const tournaments: Json[] = t.data?.leagues?.[0]?.tournaments ?? [];
  const current = tournaments.find((x) => inWindow(`${x.startDate}T12:00:00Z`)) ?? tournaments[0];
  if (!current) return [];
  const s = await api("getStandings", { tournamentId: current.id }, 600);
  const slugs = new Set<string>();
  for (const stage of s.data?.standings?.[0]?.stages ?? [])
    for (const section of stage.sections ?? [])
      for (const r of section.rankings ?? []) for (const team of r.teams ?? []) if (team.slug) slugs.add(team.slug);
  return [...slugs];
}

async function fetchTeamDetails(slug: string) {
  const r = await api("getTeams", { id: slug }, 86400);
  const t: Json | undefined = r.data?.teams?.[0];
  if (!t) return null;
  const players: Player[] = (t.players ?? []).map((p: Json) => ({
    name: p.summonerName ?? "",
    realName: [p.firstName, p.lastName].filter(Boolean).join(" "),
    role: p.role ?? "",
    image: https(p.image),
  }));
  return { code: t.code as string, name: (t.name ?? t.code) as string, image: https(t.image), region: (t.homeLeague?.region ?? t.homeLeague?.name ?? null) as string | null, players };
}

export async function getWorldsData(): Promise<WorldsData> {
  try {
    const matches = await fetchSchedule();
    if (matches.length === 0) throw new Error("El calendario llegó vacío");
    const teams = buildTeams(matches);

    const warnings: string[] = [];
    const warn = (what: string) => (err: unknown) => {
      warnings.push(`${what}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    };
    const [liveStreams, details] = await Promise.all([
      fetchLiveStreams().catch(warn("directo")),
      fetchTeamSlugs()
        .then((slugs) => {
          if (!slugs.length) warnings.push("standings: sin equipos todavía");
          return Promise.allSettled(slugs.map(fetchTeamDetails));
        })
        .catch(warn("standings")),
    ]);
    for (const d of details) {
      if (d.status === "rejected") {
        warn("equipo")(d.reason);
        continue;
      }
      if (!d.value) continue;
      let team = teams.find((t) => t.code === d.value!.code);
      if (!team) {
        // Equipos clasificados que aún no aparecen en el calendario.
        team = { code: d.value.code, name: d.value.name, image: d.value.image, region: null, wins: 0, losses: 0, gameWins: 0, gameLosses: 0, form: [], players: [] };
        teams.push(team);
      }
      team.region = d.value.region;
      team.players = d.value.players;
    }

    return {
      tournament: { name: TOURNAMENT.name, tagline: TOURNAMENT.tagline },
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
