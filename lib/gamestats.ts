// Estadísticas por partida a partir de los feeds oficiales de lolesports:
// quién jugó qué campeón, con qué resultado y con qué KDA. Las partidas
// terminadas no cambian, así que sus peticiones se cachean para siempre y solo
// las nuevas cuestan llamadas.

import { TOURNAMENT, type TournamentConfig } from "@/config/tournament";
import { championIcon, getChampions, type Champion } from "@/lib/ddragon";
import { api, fetchSchedule, fetchTeamDetails, fetchTeamSlugs, type Json, type TeamDetails } from "@/lib/lolesports";

const FEED = "https://feed.lolesports.com/livestats/v1";

type Participant = {
  playerId: string;
  name: string;
  teamId: string;
  role: string;
  champion: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  items: number[];
};

type GameRecord = {
  gameId: string;
  winnerTeamId: string | null;
  participants: Participant[];
};

export type ChampStat = {
  id: string;
  name: string;
  title: string;
  tags: string[];
  icon: string;
  picks: number;
  wins: number;
  roles: Record<string, number>;
  topPlayers: { name: string; teamCode: string; games: number }[];
};

export type PlayerStat = {
  id: string;
  name: string;
  realName: string;
  image: string;
  teamCode: string;
  teamName: string;
  teamImage: string;
  role: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  champions: { id: string; name: string; icon: string; games: number; wins: number }[];
};

export type TeamStat = {
  id: string;
  code: string;
  name: string;
  image: string;
  region: string | null;
  games: number;
  wins: number;
};

export type StatsData = {
  tournament: { slug: string; name: string; tagline: string };
  /** Mensaje si no se pudieron cargar los datos */
  error?: string;
  updatedAt: string;
  version: string;
  totalGames: number;
  champions: ChampStat[];
  players: PlayerStat[];
  teams: TeamStat[];
  warnings: string[];
};

const iso10 = (ms: number) => new Date(Math.floor(ms / 10000) * 10000).toISOString().replace(".000", "");

async function feed(kind: "window" | "details", gameId: string, at?: number): Promise<Json | null> {
  const qs = at ? `?startingTime=${iso10(at)}` : "";
  const res = await fetch(`${FEED}/${kind}/${gameId}${qs}`, { cache: "force-cache" });
  if (!res.ok || res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        out[i] = { status: "fulfilled", value: await fn(items[i]) };
      } catch (reason) {
        out[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/** Busca la ventana final de la partida: primero por la duración del VOD y si no, por bisección. */
async function finalMoment(gameId: string, firstFrame: number, hint: number | null) {
  const at = async (ms: number) => {
    const w = await feed("window", gameId, ms);
    return w?.frames?.length ? w : null;
  };
  const finished = (w: Json) => w.frames.at(-1)?.gameState === "finished";
  if (hint) {
    for (const off of [-20_000, 0, 30_000, 90_000]) {
      const w = await at(hint + off);
      if (w && finished(w)) return { w, ms: hint + off };
    }
  }
  let lo = firstFrame;
  let hi = firstFrame + 80 * 60_000;
  let best: { w: Json; ms: number } | null = null;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    const w = await at(mid);
    if (!w) {
      hi = mid;
      continue;
    }
    best = { w, ms: mid };
    if (finished(w)) break;
    lo = mid;
  }
  return best;
}

async function loadGame(game: Json): Promise<GameRecord | null> {
  const gameId = String(game.id);
  const start = await feed("window", gameId);
  const meta = start?.gameMetadata;
  if (!meta) return null;
  const firstFrame = Date.parse(start.frames?.[0]?.rfc460Timestamp ?? "");
  const vod = (game.vods ?? []).find((v: Json) => v.firstFrameTime && v.endMillis && v.startMillis != null);
  const hint = vod ? Date.parse(vod.firstFrameTime) + (vod.endMillis - vod.startMillis) : null;
  const end = Number.isFinite(firstFrame) ? await finalMoment(gameId, firstFrame, hint) : null;

  const blueId = String(meta.blueTeamMetadata?.esportsTeamId ?? "");
  const redId = String(meta.redTeamMetadata?.esportsTeamId ?? "");
  let winnerTeamId: string | null = null;
  const last = end?.w.frames.at(-1);
  if (last?.gameState === "finished") {
    const score = (t: Json) => (t?.towers ?? 0) * 100 + (t?.inhibitors ?? 0) * 10 + (t?.totalKills ?? 0) / 100;
    winnerTeamId = score(last.blueTeam) >= score(last.redTeam) ? blueId : redId;
  }

  const details = end ? await feed("details", gameId, end.ms) : null;
  const finalStats = new Map<number, Json>();
  for (const p of details?.frames?.at(-1)?.participants ?? []) finalStats.set(p.participantId, p);

  const participants: Participant[] = [];
  for (const [side, teamId] of [
    ["blueTeamMetadata", blueId],
    ["redTeamMetadata", redId],
  ] as const) {
    for (const p of meta[side]?.participantMetadata ?? []) {
      const s = finalStats.get(p.participantId);
      participants.push({
        playerId: String(p.esportsPlayerId ?? p.summonerName),
        name: p.summonerName ?? "",
        teamId,
        role: p.role ?? "",
        champion: p.championId ?? "",
        kills: s?.kills ?? 0,
        deaths: s?.deaths ?? 0,
        assists: s?.assists ?? 0,
        cs: s?.creepScore ?? 0,
        items: s?.items ?? [],
      });
    }
  }
  return { gameId, winnerTeamId, participants };
}

/** Partidas terminadas del torneo. */
async function loadGames(t: TournamentConfig, warnings: string[]) {
  const matches = (await fetchSchedule(t)).filter((m) => m.state === "completed");
  const events = await mapLimit(matches, 6, (m) => api("getEventDetails", { id: m.id }, false));
  const games: Json[] = [];
  const teamIds = new Set<string>();
  for (const e of events) {
    if (e.status === "rejected") {
      warnings.push(`evento: ${String(e.reason)}`);
      continue;
    }
    const match = e.value.data?.event?.match;
    for (const team of match?.teams ?? []) if (team.id) teamIds.add(String(team.id));
    for (const g of match?.games ?? []) if (g.state === "completed") games.push(g);
  }
  const loaded = await mapLimit(games, 6, loadGame);
  const records: GameRecord[] = [];
  for (const r of loaded) {
    if (r.status === "fulfilled" && r.value) records.push(r.value);
    else if (r.status === "rejected") warnings.push(`partida: ${String(r.reason)}`);
  }
  return { records, teamIds };
}

export async function getStats(t: TournamentConfig = TOURNAMENT): Promise<StatsData> {
  try {
    return await buildStats(t);
  } catch (err) {
    return {
      tournament: { slug: t.slug, name: t.name, tagline: t.tagline },
      error: err instanceof Error ? err.message : String(err),
      updatedAt: new Date().toISOString(),
      version: "",
      totalGames: 0,
      champions: [],
      players: [],
      teams: [],
      warnings: [],
    };
  }
}

async function buildStats(t: TournamentConfig): Promise<StatsData> {
  const warnings: string[] = [];
  const [{ version, champions: dd }, { records, teamIds }, slugs] = await Promise.all([
    getChampions(),
    loadGames(t, warnings),
    fetchTeamSlugs(t).catch(() => [] as string[]),
  ]);
  // En torneos pasados la plantilla actual ya no es la que jugó: solo cuentan las partidas.
  const ongoing = Date.parse(t.end) > Date.now();

  // Equipos: los de la clasificación más los que aparezcan en partidas.
  const teamResults = await mapLimit([...new Set([...slugs, ...teamIds])], 6, fetchTeamDetails);
  const teams = new Map<string, TeamDetails>();
  for (const r of teamResults) if (r.status === "fulfilled" && r.value) teams.set(r.value.id, r.value);

  const ddByLower = new Map(Object.values(dd).map((c) => [c.id.toLowerCase(), c]));
  const champOf = (id: string): Champion | undefined => dd[id] ?? ddByLower.get(id.toLowerCase());

  const champs = new Map<string, ChampStat & { _players: Map<string, { name: string; teamCode: string; games: number }> }>();
  const players = new Map<string, PlayerStat & { _champs: Map<string, { games: number; wins: number }> }>();
  const teamGames = new Map<string, { games: number; wins: number }>();

  // Plantillas primero, para que salgan también los jugadores que aún no han jugado.
  for (const team of ongoing ? teams.values() : []) {
    for (const p of team.players) {
      players.set(p.id, {
        ...p,
        teamCode: team.code,
        teamName: team.name,
        teamImage: team.image,
        games: 0,
        wins: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        cs: 0,
        champions: [],
        _champs: new Map(),
      });
    }
  }

  for (const g of records) {
    const sides = new Set(g.participants.map((p) => p.teamId));
    for (const teamId of sides) {
      const tg = teamGames.get(teamId) ?? { games: 0, wins: 0 };
      tg.games++;
      if (g.winnerTeamId === teamId) tg.wins++;
      teamGames.set(teamId, tg);
    }
    for (const p of g.participants) {
      const won = g.winnerTeamId === p.teamId;
      const team = teams.get(p.teamId);
      const c = champOf(p.champion);
      const champId = c?.id ?? p.champion;

      let cs = champs.get(champId);
      if (!cs) {
        cs = {
          id: champId,
          name: c?.name ?? p.champion,
          title: c?.title ?? "",
          tags: c?.tags ?? [],
          icon: championIcon(version, champId),
          picks: 0,
          wins: 0,
          roles: {},
          topPlayers: [],
          _players: new Map(),
        };
        champs.set(champId, cs);
      }
      cs.picks++;
      if (won) cs.wins++;
      cs.roles[p.role] = (cs.roles[p.role] ?? 0) + 1;

      let ps = players.get(p.playerId);
      if (!ps) {
        const prefix = team ? new RegExp(`^${team.code}\\s+`, "i") : /^$/;
        ps = {
          id: p.playerId,
          name: p.name.replace(prefix, ""),
          realName: "",
          image: "",
          teamCode: team?.code ?? "",
          teamName: team?.name ?? "",
          teamImage: team?.image ?? "",
          role: p.role,
          games: 0,
          wins: 0,
          kills: 0,
          deaths: 0,
          assists: 0,
          cs: 0,
          champions: [],
          _champs: new Map(),
        };
        players.set(p.playerId, ps);
      }
      ps.games++;
      if (won) ps.wins++;
      ps.kills += p.kills;
      ps.deaths += p.deaths;
      ps.assists += p.assists;
      ps.cs += p.cs;
      if (!ps.role) ps.role = p.role;
      const pc = ps._champs.get(champId) ?? { games: 0, wins: 0 };
      pc.games++;
      if (won) pc.wins++;
      ps._champs.set(champId, pc);

      const tp = cs._players.get(ps.id) ?? { name: ps.name, teamCode: ps.teamCode, games: 0 };
      tp.games++;
      cs._players.set(ps.id, tp);
    }
  }

  const championList: ChampStat[] = [...champs.values()]
    .map(({ _players, ...c }) => ({ ...c, topPlayers: [..._players.values()].sort((a, b) => b.games - a.games).slice(0, 3) }))
    .sort((a, b) => b.picks - a.picks || b.wins - a.wins);

  const playerList: PlayerStat[] = [...players.values()]
    .map(({ _champs, ...p }) => ({
      ...p,
      champions: [..._champs.entries()]
        .map(([id, v]) => ({ id, name: champOf(id)?.name ?? id, icon: championIcon(version, id), ...v }))
        .sort((a, b) => b.games - a.games || b.wins - a.wins),
    }))
    .sort((a, b) => a.teamCode.localeCompare(b.teamCode) || roleIndex(a.role) - roleIndex(b.role));

  const teamList: TeamStat[] = [...teams.values()]
    .map((team) => ({
      id: team.id,
      code: team.code,
      name: team.name,
      image: team.image,
      region: team.region,
      games: teamGames.get(team.id)?.games ?? 0,
      wins: teamGames.get(team.id)?.wins ?? 0,
    }))
    .sort((a, b) => (a.region ?? "").localeCompare(b.region ?? "") || a.code.localeCompare(b.code));

  return {
    tournament: { slug: t.slug, name: t.name, tagline: t.tagline },
    updatedAt: new Date().toISOString(),
    version,
    totalGames: records.length,
    champions: championList,
    players: playerList,
    teams: teamList,
    warnings,
  };
}

const ROLES = ["top", "jungle", "mid", "bottom", "support"];
const roleIndex = (r: string) => (ROLES.includes(r) ? ROLES.indexOf(r) : 9);
