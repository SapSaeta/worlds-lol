"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { HpBar, ROLE_ORDER, RoleBadge, StatBars, roleLabel } from "@/components/Pixel";
import { PixelImg } from "@/components/PixelImg";
import { TeamLogo } from "@/components/TeamLogo";
import { TournamentMap } from "@/components/TournamentMap";
import type { StageInfo } from "@/config/tournament";
import type { ChampStat, PlayerStat, StatsData } from "@/lib/gamestats";
import type { Team, TournamentMap as MapData } from "@/lib/types";

const TABS = [
  { id: "mapa", label: "Mapa", en: "Map" },
  { id: "equipos", label: "Equipos", en: "Teams" },
  { id: "jugadores", label: "Jugadores", en: "Players" },
  { id: "campeones", label: "Campeones", en: "Champions" },
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
const CLASS_LABEL_EN: Record<string, string> = Object.fromEntries(Object.keys(CLASS_LABEL).map((k) => [k, k]));
const CLASSES = Object.keys(CLASS_LABEL);

/** Clases de campeón en el idioma de la página. */
function useClassLabel() {
  const { locale } = useLocale();
  return locale === "en" ? CLASS_LABEL_EN : CLASS_LABEL;
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const kda = (p: PlayerStat) => (p.kills + p.assists) / Math.max(1, p.deaths);
const num = (n: number) => String(n).padStart(3, "0");

type TourLink = { slug: string; name: string; href: string };

type Props = { stats: StatsData; teams: Team[]; ongoing: boolean; tournaments: TourLink[]; map: MapData; stages: StageInfo[] };

export function Worlddex({ stats, teams, ongoing, tournaments, map, stages }: Props) {
  const [tab, setTab] = useState<TabId>("mapa");
  const { t, locale } = useLocale();

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
      <h1 className="screen-title">{t("¡Worlddex!", "Worlddex!")}</h1>
      <p className="screen-subtitle">{stats.tournament.name}</p>
      <div className="dex-summary">
        <span>
          {stats.totalGames} {t("partidas", "games")}
        </span>
        <span>
          {played} {t("jugadores", "players")}
        </span>
        <span>
          {stats.champions.length} {t("campeones", "champions")}
        </span>
      </div>

      {tournaments.length > 1 ? (
        <nav className="tour-switch" aria-label={t("Torneo", "Tournament")}>
          {tournaments.map((t) => (
            <Link key={t.slug} href={t.href} className="btn sm" aria-current={t.slug === stats.tournament.slug ? "page" : undefined}>
              {t.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="dex-tabs" role="tablist">
        {TABS.map((tb) => (
          <button key={tb.id} type="button" role="tab" className="btn" aria-selected={tab === tb.id} aria-pressed={tab === tb.id} onClick={() => choose(tb.id)}>
            {locale === "en" ? tb.en : tb.label}
          </button>
        ))}
      </div>

      {stats.error ? (
        <div className="card dialog note">
          {t(
            `No he podido cargar las estadísticas ahora mismo (${stats.error}). Vuelve a intentarlo en un rato.`,
            `Couldn't load the stats right now (${stats.error}). Please try again in a while.`,
          )}
        </div>
      ) : null}

      {tab === "mapa" ? <TournamentMap map={map} info={stages} teams={teams} /> : null}
      {tab === "equipos" ? <TeamsTab stats={stats} teams={teams} ongoing={ongoing} /> : null}
      {tab === "jugadores" ? <PlayersTab stats={stats} tournaments={tournaments} /> : null}
      {tab === "campeones" ? <ChampionsTab stats={stats} tournaments={tournaments} /> : null}
    </div>
  );
}

function EmptyGames({ stats, tournaments }: { stats: StatsData; tournaments: TourLink[] }) {
  const { t } = useLocale();
  const other = tournaments.find((x) => x.slug !== stats.tournament.slug);
  return (
    <div className="card dialog note">
      {t(
        `Todavía no se ha terminado ninguna partida de ${stats.tournament.name}. En cuanto acabe la primera, aparecerán aquí sus jugadores y campeones.`,
        `No ${stats.tournament.name} game has finished yet. As soon as the first one ends, its players and champions will show up here.`,
      )}
      {other ? (
        <>
          {" "}
          {t("Mientras tanto puedes ver la", "Meanwhile you can check the")} <Link href={`${other.href}#campeones`}>{t(`Worlddex de ${other.name}`, `${other.name} Worlddex`)}</Link>.
        </>
      ) : null}
    </div>
  );
}

/* ---------- Equipos ---------- */

type TeamSort = "ranking" | "region";

const byRegion = (a: Team, b: Team) => (a.region ?? "").localeCompare(b.region ?? "") || a.code.localeCompare(b.code);
const byRanking = (a: Team, b: Team) => (a.gpr?.rank ?? Infinity) - (b.gpr?.rank ?? Infinity) || byRegion(a, b);

function TeamsTab({ stats, teams, ongoing }: { stats: StatsData; teams: Team[]; ongoing: boolean }) {
  const { t: tt, intl } = useLocale();
  const shortDate = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: "UTC" });
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

  if (!list.length) return <div className="card dialog note">{tt("Aún no hay equipos confirmados para este torneo.", "No teams confirmed for this tournament yet.")}</div>;

  return (
    <>
      {ranked.length ? (
        <div className="dex-filters card">
          <div className="filter-row">
            <span className="px-small muted sort-label">{tt("Ordenar", "Sort")}</span>
            <button type="button" className="chip" aria-pressed={sort === "ranking"} onClick={() => setSort("ranking")}>
              {tt("Ranking global", "Global ranking")}
            </button>
            <button type="button" className="chip" aria-pressed={sort === "region"} onClick={() => setSort("region")}>
              {tt("Región", "Region")}
            </button>
          </div>
          <p className="px-small muted dex-hint">
            {tt("Ranking global de Riot (Global Power Rankings)", "Riot Global Power Rankings")}
            {gprDate ? tt(`, actualizado el ${shortDate.format(new Date(gprDate))}`, `, updated ${shortDate.format(new Date(gprDate))}`) : ""}.
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
              <div className="px-small muted dex-no">
                {tt("Nº", "No.")} {num(i + 1)}
              </div>
              <div className="sprite">
                <TeamLogo code={t.code} image={t.image} size={64} />
              </div>
              <div className="name bold">{t.name}</div>
              <div className="lv">{t.code}</div>
              <div className="badges">
                {t.region ? <span className="badge region">{t.region}</span> : <span className="badge">Worlds</span>}
                {t.gpr ? (
                  <span className="badge gpr" title={tt(`Ranking global de Riot: ${t.gpr.score} puntos`, `Riot Global Power Rankings: ${t.gpr.score} points`)}>
                    #{t.gpr.rank} {tt("mundial", "world")}
                  </span>
                ) : null}
              </div>
              <StatBars
                stats={[
                  { k: tt("Vic", "W"), v: t.wins, max: Math.max(series, 1) },
                  { k: tt("Der", "L"), v: t.losses, max: Math.max(series, 1) },
                  { k: tt("Part", "Gms"), v: t.gameWins + t.gameLosses, max: maxGames },
                  { k: "Win%", v: wr * 100, max: 100, text: `${Math.round(wr * 100)}%`, gold: true },
                ]}
              />
              <HpBar value={series ? wr : 1} label={series ? `${t.wins}/${series} series` : tt("Sin jugar", "Not played")} />
              <div className="move inset">
                <div className="move-title bold">{tt("Plantilla", "Roster")}</div>
                {roster.length ? (
                  <ul className="mini-roster">
                    {roster.map((p) => (
                      <li key={p.id}>
                        <RoleBadge role={p.role} />
                        <span className="bold">{p.name}</span>
                        {p.games ? <span className="muted px-small">{p.games}{tt("P", "G")}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-small muted">{tt("Próximamente", "Coming soon")}</div>
                )}
                {games?.games ? (
                  <div className="px-small muted move-foot">
                    {tt("Partidas", "Games")} {games.wins}-{games.games - games.wins}
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
  const { t, locale } = useLocale();

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
            {t("Todos", "All")}
          </button>
          {ROLE_ORDER.map((r) => (
            <button key={r} type="button" className="chip" aria-pressed={role === r} onClick={() => setRole(r)}>
              {roleLabel(r, locale)}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <label className="px-small muted" htmlFor="dex-team">
            {t("Equipo", "Team")}
          </label>
          <select id="dex-team" className="select" value={team} onChange={(e) => setTeam(e.target.value)}>
            <option value="all">{t("Todos", "All")}</option>
            {teamCodes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="px-small muted sort-label">{t("Ordenar", "Sort")}</span>
          {(
            [
              ["games", t("Partidas", "Games")],
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
  const { t } = useLocale();
  return (
    <article className="card starter">
      <div className="px-small muted dex-no">
        {t("Nº", "No.")} {num(n)}
      </div>
      <div className="sprite">{p.image ? <PixelImg src={p.image} alt={p.name} size={72} res={30} /> : <TeamLogo code={p.teamCode} image={p.teamImage} size={64} />}</div>
      <div className="name bold">{p.name}</div>
      <div className="lv">
        {p.teamCode}
        {p.realName ? ` · ${p.realName}` : ""}
      </div>
      <RoleBadge role={p.role} />
      <StatBars
        stats={[
          { k: t("Part", "Gms"), v: p.games, max: maxGames },
          { k: "KDA", v: Math.min(k, 10), max: 10, text: p.games ? k.toFixed(1) : "-" },
          { k: "CS", v: p.games ? p.cs / p.games : 0, max: 350, text: p.games ? String(Math.round(p.cs / p.games)) : "-" },
          { k: "Win%", v: wr * 100, max: 100, text: p.games ? `${Math.round(wr * 100)}%` : "-", gold: true },
        ]}
      />
      <HpBar value={p.games ? wr : 1} label={p.games ? `${per(p.kills)} / ${per(p.deaths)} / ${per(p.assists)}` : t("Sin jugar", "Not played")} />
      <div className="move inset">
        <div className="move-title bold">{t("Campeones", "Champions")}</div>
        {p.champions.length ? (
          <ul className="champ-mini">
            {p.champions.slice(0, 4).map((c) => (
              <li key={c.id} title={t(`${c.name}: ${c.games} partidas, ${c.wins} victorias`, `${c.name}: ${c.games} games, ${c.wins} wins`)}>
                <PixelImg src={c.icon} alt={c.name} size={36} res={20} />
                <span className="px-small">{c.games}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-small muted">{t("Aún sin partidas", "No games yet")}</div>
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
  const { t } = useLocale();
  const CLASS = useClassLabel();

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
            {t("Todas", "All")}
          </button>
          {CLASSES.map((c) => (
            <button key={c} type="button" className="chip" aria-pressed={cls === c} onClick={() => setCls(c)}>
              {CLASS[c]}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <span className="px-small muted sort-label">{t("Ordenar", "Sort")}</span>
          <button type="button" className="chip" aria-pressed={sort === "picks"} onClick={() => setSort("picks")}>
            {t("Más jugados", "Most picked")}
          </button>
          <button type="button" className="chip" aria-pressed={sort === "wr"} onClick={() => setSort("wr")}>
            Win%
          </button>
        </div>
        <p className="px-small muted dex-hint">
          {t(
            "Los baneos no aparecen en los datos oficiales de lolesports, así que aquí solo cuentan las elecciones.",
            "Bans are not in the official lolesports data, so only picks are counted here.",
          )}
        </p>
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
  const { t, locale } = useLocale();
  const CLASS = useClassLabel();
  return (
    <article className="card starter">
      <div className="px-small muted dex-no">
        {t("Nº", "No.")} {num(n)}
      </div>
      <div className="sprite">
        <PixelImg src={c.icon} alt={c.name} size={72} res={26} />
      </div>
      <div className="name bold">{c.name}</div>
      <div className="lv champ-title">{c.title}</div>
      <div className="type-row">
        {c.tags.map((tag) => (
          <span key={tag} className={`badge t-${tag}`}>
            {CLASS[tag] ?? tag}
          </span>
        ))}
      </div>
      <StatBars
        stats={[
          { k: "Picks", v: c.picks, max: maxPicks },
          { k: t("Pres", "Pres"), v: pct(c.picks, totalGames), max: 100, text: `${pct(c.picks, totalGames)}%` },
          { k: "Win%", v: wr * 100, max: 100, text: `${Math.round(wr * 100)}%`, gold: true },
        ]}
      />
      <HpBar value={wr} label={t(`${c.wins}V ${c.picks - c.wins}D`, `${c.wins}W ${c.picks - c.wins}L`)} />
      <div className="move inset">
        <div className="move-title bold">{t("Jugado por", "Played by")}</div>
        <ul className="mini-roster">
          {c.topPlayers.map((p) => (
            <li key={`${p.teamCode}-${p.name}`}>
              <span className="badge region">{p.teamCode || "?"}</span>
              <span className="bold">{p.name}</span>
              <span className="muted px-small">
                {p.games}
                {t("P", "G")}
              </span>
            </li>
          ))}
        </ul>
        {roles.length ? (
          <div className="px-small muted move-foot">
            {roles.map(([r, v]) => `${roleLabel(r, locale) ?? r} ${v}`).join(" · ")}
          </div>
        ) : null}
      </div>
    </article>
  );
}
