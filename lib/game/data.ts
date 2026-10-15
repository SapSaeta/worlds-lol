// Datos del juego: campeones con sus habilidades y objetos de Data Dragon, y
// los jugadores de los equipos clasificados con su pool de campeones, sacado
// de sus últimas series oficiales (en su liga y en el torneo).

import { TOURNAMENT, type TournamentConfig } from "@/config/tournament";
import { getChampions, type Champion } from "@/lib/ddragon";
import { mapLimit } from "@/lib/gamestats";
import { api, feedWindow, fetchGpr, fetchTeamDetails, fetchTeamSlugs, leagueIdsByName, type Json, type TeamDetails } from "@/lib/lolesports";
import { classifySpell } from "@/lib/game/spells";
import { ROLES, type Cls, type GameData, type GChamp, type GItem, type GPlayer, type GTeam, type Role, type Spell, type Stats } from "@/lib/game/types";

const DD = "https://ddragon.leagueoflegends.com";
const LANG = "es_ES";

/** Series que se miran para el pool de cada jugador */
const POOL_SERIES = 6;
/** De ellas, las más recientes que cuentan para saber quién es titular */
const ACTIVE_SERIES = 3;
/** Campeones mínimos por jugador; si faltan se completa con los más jugados de su rol */
const MIN_POOL = 4;
const MAX_POOL = 8;

type Picks = { name: string; role: string; games: number; active: boolean; champs: Map<string, number> };

/** Campeones que ha jugado cada jugador del equipo en sus últimas series. */
async function teamPicks(team: TeamDetails, leagueIds: string[]): Promise<Map<string, Picks>> {
  const schedules = await Promise.all(leagueIds.map((id) => api("getSchedule", { leagueId: id }, 3600).catch(() => null)));
  const events = schedules
    .flatMap((s) => (s?.data?.schedule?.events ?? []) as Json[])
    .filter((e) => e.state === "completed" && e.match?.id && (e.match.teams ?? []).some((x: Json) => x.code === team.code))
    .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))
    .slice(0, POOL_SERIES);
  const out = new Map<string, Picks>();
  for (const [i, e] of events.entries()) {
    const d = await api("getEventDetails", { id: String(e.match.id) }, false).catch(() => null);
    const games: Json[] = (d?.data?.event?.match?.games ?? []).filter((g: Json) => g.state === "completed");
    const windows = await Promise.all(games.map((g) => feedWindow(String(g.id)).catch(() => null)));
    for (const w of windows)
      for (const side of [w?.gameMetadata?.blueTeamMetadata, w?.gameMetadata?.redTeamMetadata]) {
        if (!side || String(side.esportsTeamId) !== team.id) continue;
        for (const p of side.participantMetadata ?? []) {
          if (!p.esportsPlayerId || !p.championId) continue;
          const id = String(p.esportsPlayerId);
          const cur = out.get(id) ?? { name: p.summonerName ?? "", role: p.role ?? "", games: 0, active: false, champs: new Map() };
          cur.games++;
          if (i < ACTIVE_SERIES) cur.active = true;
          cur.champs.set(p.championId, (cur.champs.get(p.championId) ?? 0) + 1);
          out.set(id, cur);
        }
      }
  }
  return out;
}

const CLASSES: Cls[] = ["Fighter", "Tank", "Mage", "Assassin", "Marksman", "Support"];

async function championSpells(version: string, id: string): Promise<Spell[]> {
  const res = await fetch(`${DD}/cdn/${version}/data/${LANG}/champion/${id}.json`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`ddragon ${id} → HTTP ${res.status}`);
  const c: Json = (await res.json()).data?.[id];
  return ((c?.spells ?? []) as Json[]).slice(0, 4).map((s, i) => ({
    key: (["Q", "W", "E", "R"] as const)[i],
    name: s.name,
    icon: `${DD}/cdn/${version}/img/spell/${s.image?.full}`,
    cd: Number(s.cooldown?.[0]) || 10,
    ...classifySpell(String(s.description ?? "")),
  }));
}

function toGChamp(version: string, c: Champion, spells: Spell[]): GChamp {
  const cls = (CLASSES.find((k) => k === c.tags[0]) ?? "Fighter") as Cls;
  const magic = c.info.magic > c.info.attack;
  return {
    id: c.id,
    name: c.name,
    title: c.title,
    cls,
    tags: c.tags,
    magic,
    base: {
      hp: Math.round(c.stats.hp),
      ad: Math.round(c.stats.attackdamage),
      // Data Dragon no da poder de habilidad: sale de la puntuación de magia del
      // campeón, en la misma escala que el daño de ataque (50-75).
      ap: Math.round(50 + c.info.magic * 2.5),
      ar: Math.round(c.stats.armor),
      mr: Math.round(c.stats.spellblock),
      ms: Math.round(c.stats.movespeed),
    },
    icon: `${DD}/cdn/${version}/img/champion/${c.id}.png`,
    spells,
  };
}

const STAT_MAP: Record<string, keyof Stats> = {
  FlatPhysicalDamageMod: "ad",
  FlatMagicDamageMod: "ap",
  FlatHPPoolMod: "hp",
  FlatArmorMod: "ar",
  FlatSpellBlockMod: "mr",
  FlatCritChanceMod: "crit",
  PercentAttackSpeedMod: "as",
  FlatMovementSpeedMod: "ms",
  PercentLifeStealMod: "ls",
};

const POTION = "2003";

async function getItems(version: string): Promise<GItem[]> {
  const res = await fetch(`${DD}/cdn/${version}/data/${LANG}/item.json`, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`ddragon objetos → HTTP ${res.status}`);
  const data: Record<string, Json> = (await res.json()).data ?? {};
  const items: GItem[] = [];
  for (const [id, x] of Object.entries(data)) {
    if (!x.maps?.["11"] || !x.gold?.purchasable || x.requiredChampion || x.requiredAlly || x.inStore === false || x.hideFromAll) continue;
    const tags: string[] = x.tags ?? [];
    const from: string[] = x.from ?? [];
    const into: string[] = x.into ?? [];
    const stats: Stats = {};
    for (const [k, v] of Object.entries<number>(x.stats ?? {})) if (STAT_MAP[k] && v) stats[STAT_MAP[k]] = v;
    let kind: GItem["kind"];
    if (id === POTION) kind = "potion";
    else if (tags.includes("Consumable") || tags.includes("Trinket") || tags.includes("Jungle") || tags.includes("GoldPer")) continue;
    else if (!Object.keys(stats).length || (!from.length && !into.length)) continue;
    else kind = !from.length ? "basic" : into.length ? "epic" : "legendary";
    items.push({ id, name: x.name, icon: `${DD}/cdn/${version}/img/item/${x.image?.full}`, gold: x.gold.total, from, kind, stats });
  }
  return items.sort((a, b) => a.gold - b.gold);
}

export async function getGameData(t: TournamentConfig = TOURNAMENT): Promise<GameData> {
  const warnings: string[] = [];
  const warn = (what: string) => (err: unknown) => {
    warnings.push(`${what}: ${err instanceof Error ? err.message : String(err)}`);
  };
  const [{ version, champions: dd }, slugs, gpr, leagues] = await Promise.all([
    getChampions(),
    fetchTeamSlugs(t),
    fetchGpr(t).catch((err) => (warn("ranking")(err), new Map())),
    leagueIdsByName().catch(() => new Map<string, string>()),
  ]);
  const ddByLower = new Map(Object.values(dd).map((c) => [c.id.toLowerCase(), c]));
  const champOf = (id: string) => dd[id] ?? ddByLower.get(id.toLowerCase());

  const details = (await mapLimit(slugs, 6, fetchTeamDetails)).flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
  const picks = await mapLimit(details, 6, (team) => teamPicks(team, [t.leagueId, ...(team.region && leagues.get(team.region) ? [leagues.get(team.region)!] : [])]));

  // Titulares: por rol, el jugador activo con más partidas recientes.
  const players: GPlayer[] = [];
  const teams: GTeam[] = [];
  const byRole = new Map<Role, Map<string, number>>(ROLES.map((r) => [r, new Map()]));
  for (const [i, team] of details.entries()) {
    const r = picks[i];
    const seen = r.status === "fulfilled" ? r.value : new Map<string, Picks>();
    if (r.status === "rejected") warn(`pool ${team.code}`)(r.reason);
    const roster = new Map(team.players.map((p) => [p.id, p]));
    const starters: GPlayer[] = [];
    for (const role of ROLES) {
      const candidates = [...seen.entries()].filter(([, p]) => p.role === role).sort((a, b) => Number(b[1].active) - Number(a[1].active) || b[1].games - a[1].games);
      const [id, p] = candidates[0] ?? [];
      const fallback = team.players.find((x) => x.role === role);
      const pid = id ?? fallback?.id;
      if (!pid) continue;
      const known = roster.get(pid);
      const pool = p
        ? [...p.champs.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([c]) => champOf(c)?.id)
            .filter((c): c is string => !!c)
        : [];
      for (const [c, n] of p?.champs ?? []) {
        const cid = champOf(c)?.id;
        if (cid) byRole.get(role)!.set(cid, (byRole.get(role)!.get(cid) ?? 0) + n);
      }
      starters.push({
        id: pid,
        name: known?.name || (p?.name ?? "").replace(new RegExp(`^${team.code}\\s+`, "i"), "") || pid,
        role,
        team: team.code,
        image: known?.image ?? "",
        pool: [...new Set(pool)].slice(0, MAX_POOL),
      });
    }
    if (starters.length < 5) {
      warnings.push(`plantilla incompleta: ${team.code}`);
      if (!starters.length) continue;
    }
    players.push(...starters);
    teams.push({
      code: team.code,
      name: team.name,
      image: team.image,
      rank: gpr.get(team.id)?.rank ?? 99,
      region: team.region ?? "",
      players: starters.map((p) => p.id),
    });
  }

  // Pools cortos (o sin datos): se completan con lo más jugado en su rol.
  const roleTop = new Map(ROLES.map((r) => [r, [...byRole.get(r)!.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)]));
  const TAG_FALLBACK: Record<Role, string[]> = { top: ["Fighter", "Tank"], jungle: ["Fighter", "Assassin"], mid: ["Mage", "Assassin"], bottom: ["Marksman"], support: ["Support", "Tank"] };
  for (const p of players) {
    const extra = [...(roleTop.get(p.role) ?? []), ...Object.values(dd).filter((c) => TAG_FALLBACK[p.role].includes(c.tags[0])).map((c) => c.id)];
    for (const c of extra) {
      if (p.pool.length >= MIN_POOL) break;
      if (!p.pool.includes(c)) p.pool.push(c);
    }
  }

  // Habilidades solo de los campeones que pueden salir.
  const needed = [...new Set(players.flatMap((p) => p.pool))];
  const spells = await mapLimit(needed, 10, (id) => championSpells(version, id));
  const champions: Record<string, GChamp> = {};
  for (const [i, id] of needed.entries()) {
    const s = spells[i];
    if (s.status === "rejected" || s.value.length < 4) {
      warn(`habilidades ${id}`)(s.status === "rejected" ? s.reason : "incompletas");
      continue;
    }
    champions[id] = toGChamp(version, dd[id], s.value);
  }
  for (const p of players) p.pool = p.pool.filter((c) => champions[c]);

  const items = await getItems(version).catch((err) => (warn("objetos")(err), [] as GItem[]));
  return { version, champions, items, players, teams: teams.sort((a, b) => a.rank - b.rank), updatedAt: new Date().toISOString(), warnings };
}
