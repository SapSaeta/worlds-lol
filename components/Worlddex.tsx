"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HpBar, ROLE_LABEL, ROLE_ORDER, RoleBadge, StatBars } from "@/components/Pixel";
import { PixelImg } from "@/components/PixelImg";
import { TeamLogo } from "@/components/TeamLogo";
import { TournamentMap } from "@/components/TournamentMap";
import type { StageInfo } from "@/config/tournament";
import type { ChampStat, PlayerStat, StatsData } from "@/lib/gamestats";
import type { Team, TournamentMap as MapData } from "@/lib/types";

const TABS = [
  { id: "mapa", label: "Mapa" },
  { id: "equipos", label: "Equipos" },
  { id: "jugadores", label: "Jugadores" },
  { id: "campeones", label: "Campeones" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const CLASS_LABEL: Record<string, string> = {
  Fighter: "Luchador",
  Tank: "Tanque",
  Mage: "Mago",
  Assassin: "Asesino",
  Marksman: "Tirador",
  Support: "Soporte",
};
const CLASSES = Object.keys(CLASS_LABEL);

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const kda = (p: PlayerStat) => (p.kills + p.assists) / Math.max(1, p.deaths);
const num = (n: number) => String(n).padStart(3, "0");

type TourLink = { slug: string; name: string; href: string };

type Props = { stats: StatsData; teams: Team[]; ongoing: boolean; tournaments: TourLink[]; map: MapData; stages: StageInfo[] };

export function Worlddex({ stats, teams, ongoing, tournaments, map, stages }: Props) {
  const [tab, setTab] = useState<TabId>("mapa");

  useEffect(() => {
    const fromHash = () => {
      const h = location.hash.slice(1);
      if (TABS.some((t) => t.id === h)) setTab(h as TabId);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  const choose = (id: TabId) => {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
  };

  const played = stats.players.filter((p) => p.games > 0).length;

  return (
    <div className="page">
      <h1 className="screen-title">¡Worlddex!</h1>
      <p className="screen-subtitle">{stats.tournament.name}</p>
      <div className="dex-summary">
        <span>{stats.totalGames} partidas</span>
        <span>{played} jugadores</span>
        <span>{stats.champions.length} campeones</span>
      </div>

      {tournaments.length > 1 ? (
        <nav className="tour-switch" aria-label="Torneo">
          {tournaments.map((t) => (
            <Link key={t.slug} href={t.href} className="btn sm" aria-current={t.slug === stats.tournament.slug ? "page" : undefined}>
              {t.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="dex-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" className="btn" aria-selected={tab === t.id} aria-pressed={tab === t.id} onClick={() => choose(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {stats.error ? (
        <div className="card dialog note">No he podido cargar las estadísticas ahora mismo ({stats.error}). Vuelve a intentarlo en un rato.</div>
      ) : null}

      {tab === "mapa" ? <TournamentMap map={map} info={stages} teams={teams} /> : null}
      {tab === "equipos" ? <TeamsTab stats={stats} teams={teams} ongoing={ongoing} /> : null}
      {tab === "jugadores" ? <PlayersTab stats={stats} tournaments={tournaments} /> : null}
      {tab === "campeones" ? <ChampionsTab stats={stats} tournaments={tournaments} /> : null}
    </div>
  );
}

function EmptyGames({ stats, tournaments }: { stats: StatsData; tournaments: TourLink[] }) {
  const other = tournaments.find((t) => t.slug !== stats.tournament.slug);
  return (
    <div className="card dialog note">
      Todavía no se ha terminado ninguna partida de {stats.tournament.name}. En cuanto acabe la primera, aparecerán aquí sus jugadores y campeones.
      {other ? (
        <>
          {" "}
          Mientras tanto puedes ver la <Link href={`${other.href}#campeones`}>Worlddex de {other.name}</Link>.
        </>
      ) : null}
    </div>
  );
}

/* ---------- Equipos ---------- */

type TeamSort = "ranking" | "region";

const shortDate = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });
const byRegion = (a: Team, b: Team) => (a.region ?? "").localeCompare(b.region ?? "") || a.code.localeCompare(b.code);
const byRanking = (a: Team, b: Team) => (a.gpr?.rank ?? Infinity) - (b.gpr?.rank ?? Infinity) || byRegion(a, b);

function TeamsTab({ stats, teams, ongoing }: { stats: StatsData; teams: Team[]; ongoing: boolean }) {
  const ranked = teams.filter((t) => t.gpr);
  const [sort, setSort] = useState<TeamSort>(ranked.length ? "ranking" : "region");
  const byCode = new Map(stats.teams.map((t) => [t.code, t]));
  const rosters = new Map<string, PlayerStat[]>();
  for (const p of stats.players) {
    if (!ongoing && p.games === 0) continue;
    rosters.set(p.teamCode, [...(rosters.get(p.teamCode) ?? []), p]);
  }
  const list = [...teams].sort(sort === "ranking" ? byRanking : byRegion);
  const maxGames = Math.max(1, ...list.map((t) => t.gameWins + t.gameLosses));
  const gprDate = ranked.map((t) => t.gpr!.date).sort().pop();

  if (!list.length) return <div className="card dialog note">Aún no hay equipos confirmados para este torneo.</div>;

  return (
    <>
      {ranked.length ? (
        <div className="dex-filters card">
          <div className="filter-row">
            <span className="px-small muted sort-label">Ordenar</span>
            <button type="button" className="chip" aria-pressed={sort === "ranking"} onClick={() => setSort("ranking")}>
              Ranking global
            </button>
            <button type="button" className="chip" aria-pressed={sort === "region"} onClick={() => setSort("region")}>
              Región
            </button>
          </div>
          <p className="px-small muted dex-hint">
            Ranking global de Riot (Global Power Rankings){gprDate ? `, actualizado el ${shortDate.format(new Date(gprDate))}` : ""}.
          </p>
        </div>
      ) : null}
      <div className="grid-cards">
        {list.map((t, i) => {
          const series = t.wins + t.losses;
          const wr = series ? t.wins / series : 0;
          const games = byCode.get(t.code);
          const roster = (rosters.get(t.code) ?? []).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || b.games - a.games);
          return (
            <article key={t.code} className="card starter">
              <div className="px-small muted dex-no">Nº {num(i + 1)}</div>
              <div className="sprite">
                <TeamLogo code={t.code} image={t.image} size={64} />
              </div>
              <div className="name bold">{t.name}</div>
              <div className="lv">{t.code}</div>
              <div className="badges">
                {t.region ? <span className="badge region">{t.region}</span> : <span className="badge">Worlds</span>}
                {t.gpr ? (
                  <span className="badge gpr" title={`Ranking global de Riot: ${t.gpr.score} puntos`}>
                    #{t.gpr.rank} mundial
                  </span>
                ) : null}
              </div>
              <StatBars
                stats={[
                  { k: "Vic", v: t.wins, max: Math.max(series, 1) },
                  { k: "Der", v: t.losses, max: Math.max(series, 1) },
                  { k: "Part", v: t.gameWins + t.gameLosses, max: maxGames },
                  { k: "Win%", v: wr * 100, max: 100, text: `${Math.round(wr * 100)}%`, gold: true },
                ]}
              />
              <HpBar value={series ? wr : 1} label={series ? `${t.wins}/${series} series` : "Sin jugar"} />
              <div className="move inset">
                <div className="move-title bold">Plantilla</div>
                {roster.length ? (
                  <ul className="mini-roster">
                    {roster.map((p) => (
                      <li key={p.id}>
                        <RoleBadge role={p.role} />
                        <span className="bold">{p.name}</span>
                        {p.games ? <span className="muted px-small">{p.games}P</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-small muted">Próximamente</div>
                )}
                {games?.games ? (
                  <div className="px-small muted move-foot">
                    Partidas {games.wins}-{games.games - games.wins}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Jugadores ---------- */

type PlayerSort = "games" | "kda" | "wr";

function PlayersTab({ stats, tournaments }: { stats: StatsData; tournaments: TourLink[] }) {
  const [role, setRole] = useState<string>("all");
  const [team, setTeam] = useState<string>("all");
  const [sort, setSort] = useState<PlayerSort>("games");

  const teamCodes = useMemo(() => [...new Set(stats.players.map((p) => p.teamCode).filter(Boolean))].sort(), [stats.players]);
  const list = useMemo(() => {
    const out = stats.players.filter((p) => (role === "all" || p.role === role) && (team === "all" || p.teamCode === team));
    const key = (p: PlayerStat) => (sort === "games" ? p.games : sort === "kda" ? (p.games ? kda(p) : -1) : p.games ? p.wins / p.games : -1);
    return out.sort((a, b) => key(b) - key(a) || b.games - a.games || a.name.localeCompare(b.name));
  }, [stats.players, role, team, sort]);

  if (!stats.players.length) return <EmptyGames stats={stats} tournaments={tournaments} />;
  const maxGames = Math.max(1, ...stats.players.map((p) => p.games));

  return (
    <>
      <div className="dex-filters card">
        <div className="filter-row">
          <button type="button" className="chip" aria-pressed={role === "all"} onClick={() => setRole("all")}>
            Todos
          </button>
          {ROLE_ORDER.map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={role === r} onClick={() => setRole(r)}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <label className="px-small muted" htmlFor="dex-team">
            Equipo
          </label>
          <select id="dex-team" className="select" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="all">Todos</option>
            {teamCodes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="px-small muted sort-label">Ordenar</span>
          {(
            [
              ["games", "Partidas"],
              ["kda", "KDA"],
              ["wr", "Win%"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} type="button" className="chip" aria-pressed={sort === k} onClick={() => setSort(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {stats.totalGames === 0 ? <EmptyGames stats={stats} tournaments={tournaments} /> : null}

      <div className="grid-cards">
        {list.map((p, i) => (
          <PlayerCard key={p.id} p={p} n={i + 1} maxGames={maxGames} />
        ))}
      </div>
    </>
  );
}

function PlayerCard({ p, n, maxGames }: { p: PlayerStat; n: number; maxGames: number }) {
  const wr = p.games ? p.wins / p.games : 0;
  const k = kda(p);
  const per = (v: number) => (p.games ? (v / p.games).toFixed(1) : "0");
  return (
    <article className="card starter">
      <div className="px-small muted dex-no">Nº {num(n)}</div>
      <div className="sprite">{p.image ? <PixelImg src={p.image} alt={p.name} size={72} res={30} /> : <TeamLogo code={p.teamCode} image={p.teamImage} size={64} />}</div>
      <div className="name bold">{p.name}</div>
      <div className="lv">
        {p.teamCode}
        {p.realName ? ` · ${p.realName}` : ""}
      </div>
      <RoleBadge role={p.role} />
      <StatBars
        stats={[
          { k: "Part", v: p.games, max: maxGames },
          { k: "KDA", v: Math.min(k, 10), max: 10, text: p.games ? k.toFixed(1) : "-" },
          { k: "CS", v: p.games ? p.cs / p.games : 0, max: 350, text: p.games ? String(Math.round(p.cs / p.games)) : "-" },
          { k: "Win%", v: wr * 100, max: 100, text: p.games ? `${Math.round(wr * 100)}%` : "-", gold: true },
        ]}
      />
      <HpBar value={p.games ? wr : 1} label={p.games ? `${per(p.kills)} / ${per(p.deaths)} / ${per(p.assists)}` : "Sin jugar"} />
      <div className="move inset">
        <div className="move-title bold">Campeones</div>
        {p.champions.length ? (
          <ul className="champ-mini">
            {p.champions.slice(0, 4).map((c) => (
              <li key={c.id} title={`${c.name}: ${c.games} partidas, ${c.wins} victorias`}>
                <PixelImg src={c.icon} alt={c.name} size={36} res={20} />
                <span className="px-small">{c.games}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-small muted">Aún sin partidas</div>
        )}
      </div>
    </article>
  );
}

/* ---------- Campeones ---------- */

type ChampSort = "picks" | "wr";

function ChampionsTab({ stats, tournaments }: { stats: StatsData; tournaments: TourLink[] }) {
  const [cls, setCls] = useState<string>("all");
  const [sort, setSort] = useState<ChampSort>("picks");

  const ranked = useMemo(() => new Map(stats.champions.map((c, i) => [c.id, i + 1])), [stats.champions]);
  const list = useMemo(() => {
    const out = stats.champions.filter((c) => cls === "all" || c.tags.includes(cls));
    if (sort === "wr") out.sort((a, b) => b.wins / b.picks - a.wins / a.picks || b.picks - a.picks);
    return out;
  }, [stats.champions, cls, sort]);

  if (!stats.champions.length) return <EmptyGames stats={stats} tournaments={tournaments} />;
  const maxPicks = Math.max(1, ...stats.champions.map((c) => c.picks));

  return (
    <>
      <div className="dex-filters card">
        <div className="filter-row">
          <button type="button" className="chip" aria-pressed={cls === "all"} onClick={() => setCls("all")}>
            Todas
          </button>
          {CLASSES.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={cls === c} onClick={() => setCls(c)}>
              {CLASS_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <span className="px-small muted sort-label">Ordenar</span>
          <button type="button" className="chip" aria-pressed={sort === "picks"} onClick={() => setSort("picks")}>
            Más jugados
          </button>
          <button type="button" className="chip" aria-pressed={sort === "wr"} onClick={() => setSort("wr")}>
            Win%
          </button>
        </div>
        <p className="px-small muted dex-hint">Los baneos no aparecen en los datos oficiales de lolesports, así que aquí solo cuentan las elecciones.</p>
      </div>

      <div className="grid-cards">
        {list.map((c) => (
          <ChampCard key={c.id} c={c} n={ranked.get(c.id) ?? 0} maxPicks={maxPicks} totalGames={stats.totalGames} />
        ))}
      </div>
    </>
  );
}

function ChampCard({ c, n, maxPicks, totalGames }: { c: ChampStat; n: number; maxPicks: number; totalGames: number }) {
  const wr = c.picks ? c.wins / c.picks : 0;
  const roles = Object.entries(c.roles).sort((a, b) => b[1] - a[1]);
  return (
    <article className="card starter">
      <div className="px-small muted dex-no">Nº {num(n)}</div>
      <div className="sprite">
        <PixelImg src={c.icon} alt={c.name} size={72} res={26} />
      </div>
      <div className="name bold">{c.name}</div>
      <div className="lv champ-title">{c.title}</div>
      <div className="type-row">
        {c.tags.map((t) => (
          <span key={t} className={`badge t-${t}`}>
            {CLASS_LABEL[t] ?? t}
          </span>
        ))}
      </div>
      <StatBars
        stats={[
          { k: "Picks", v: c.picks, max: maxPicks },
          { k: "Pres", v: pct(c.picks, totalGames), max: 100, text: `${pct(c.picks, totalGames)}%` },
          { k: "Win%", v: wr * 100, max: 100, text: `${Math.round(wr * 100)}%`, gold: true },
        ]}
      />
      <HpBar value={wr} label={`${c.wins}V ${c.picks - c.wins}D`} />
      <div className="move inset">
        <div className="move-title bold">Jugado por</div>
        <ul className="mini-roster">
          {c.topPlayers.map((p) => (
            <li key={`${p.teamCode}-${p.name}`}>
              <span className="badge region">{p.teamCode || "?"}</span>
              <span className="bold">{p.name}</span>
              <span className="muted px-small">{p.games}P</span>
            </li>
          ))}
        </ul>
        {roles.length ? (
          <div className="px-small muted move-foot">
            {roles.map(([r, v]) => `${ROLE_LABEL[r] ?? r} ${v}`).join(" · ")}
          </div>
        ) : null}
      </div>
    </article>
  );
}
