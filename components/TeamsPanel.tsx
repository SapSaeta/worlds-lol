"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { HpBar, ROLE_ORDER, RoleBadge, StatBars } from "@/components/Pixel";
import { TeamLogo } from "@/components/TeamLogo";
import type { Match, Team, WorldsData } from "@/lib/types";

type SortKey = "record" | "games" | "name" | "gpr";

function winrate(t: Team) {
  const total = t.wins + t.losses;
  return total ? t.wins / total : 0;
}

// Sin ranking, al final. También desempata el resto de órdenes.
const gprRank = (t: Team) => t.gpr?.rank ?? Infinity;

function sortTeams(teams: Team[], key: SortKey) {
  return [...teams].sort((a, b) => {
    if (key === "name") return a.code.localeCompare(b.code);
    if (key === "gpr") return gprRank(a) - gprRank(b) || a.code.localeCompare(b.code);
    if (key === "games") return b.gameWins - b.gameLosses - (a.gameWins - a.gameLosses) || b.gameWins - a.gameWins || gprRank(a) - gprRank(b);
    return b.wins - a.wins || a.losses - b.losses || b.gameWins - b.gameLosses - (a.gameWins - a.gameLosses) || gprRank(a) - gprRank(b);
  });
}

const timeFmt = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });

// Las horas dependen de la zona horaria del visitante, así que solo se pintan
// en el navegador para no desajustar el HTML generado en el servidor.
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

const fmtTime = (iso: string, mounted: boolean) => (mounted ? timeFmt.format(new Date(iso)) : "--:--");
const fmtDay = (iso: string, mounted: boolean) => (mounted ? dayFmt.format(new Date(iso)) : "");

function TeamDex({ team, matches }: { team: Team; matches: Match[] }) {
  const next = matches.find((m) => m.state !== "completed" && m.teams.some((t) => t.code === team.code));
  const rival = next?.teams.find((t) => t.code !== team.code);
  const mounted = useMounted();
  const players = [...team.players].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  const games = team.gameWins + team.gameLosses;
  return (
    <div className="dex-card">
      <div className="sprite">
        <TeamLogo code={team.code} image={team.image} size={56} />
      </div>
      <div className="bold" style={{ fontSize: 24 }}>
        {team.name}
      </div>
      {team.region || team.gpr ? (
        <div className="badges" style={{ marginTop: 6 }}>
          {team.region ? <span className="badge region">{team.region}</span> : null}
          {team.gpr ? (
            <span className="badge gpr" title={`Ranking global de Riot: ${team.gpr.score} puntos`}>
              #{team.gpr.rank} mundial
            </span>
          ) : null}
        </div>
      ) : null}
      <StatBars
        stats={[
          { k: "Series", v: team.wins, max: Math.max(team.wins + team.losses, 1), text: `${team.wins}-${team.losses}` },
          { k: "Partidas", v: team.gameWins, max: Math.max(games, 1), text: `${team.gameWins}-${team.gameLosses}` },
          { k: "Win%", v: winrate(team) * 100, max: 100, text: `${Math.round(winrate(team) * 100)}%`, gold: true },
        ]}
      />
      {next && rival ? (
        <div className="inset" style={{ padding: 8 }}>
          <div className="px-small muted">Siguiente combate</div>
          <div className="bold" style={{ fontSize: 22, marginTop: 4 }}>
            vs {rival.code}
          </div>
          <div className="px-small" style={{ color: "var(--ink-2)" }}>
            {next.state === "inProgress" ? "¡En juego!" : `${fmtDay(next.startTime, mounted)} · ${fmtTime(next.startTime, mounted)}`}
          </div>
        </div>
      ) : null}
      {players.length ? (
        <div className="roster">
          {players.map((p) => (
            <div className="roster-row" key={p.name + p.role}>
              <RoleBadge role={p.role} />
              <span className="pname bold">{p.name}</span>
              {p.realName ? <span className="real">{p.realName}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StandingsTab({ data }: { data: WorldsData }) {
  const [sort, setSort] = useState<SortKey>("record");
  const [region, setRegion] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const regions = useMemo(
    () => [...new Set(data.teams.map((t) => t.region).filter((r): r is string => !!r))].sort(),
    [data.teams],
  );
  const teams = sortTeams(
    data.teams.filter((t) => !region || t.region === region),
    sort,
  );

  const sortBtn = (key: SortKey, label: string) => (
    <button data-active={sort === key} onClick={() => setSort(key)}>
      {label}
      {sort === key ? "▾" : ""}
    </button>
  );

  return (
    <>
      {regions.length > 1 ? (
        <div className="filter-row" role="group" aria-label="Filtrar por región">
          <button className="chip" aria-pressed={region === null} onClick={() => setRegion(null)}>
            Todas
          </button>
          {regions.map((r) => (
            <button key={r} className="chip" aria-pressed={region === r} onClick={() => setRegion(region === r ? null : r)}>
              {r}
            </button>
          ))}
        </div>
      ) : null}
      <table className="team-table">
        <thead>
          <tr>
            <th title="Ranking global de Riot">{sortBtn("gpr", "#")}</th>
            <th>{sortBtn("name", "Equipo")}</th>
            <th>{sortBtn("record", "V-D")}</th>
            <th>{sortBtn("games", "Forma")}</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => (
            <Fragment key={t.code}>
              <tr className="row" aria-expanded={open === t.code} onClick={() => setOpen(open === t.code ? null : t.code)}>
                <td className="rank">{sort === "gpr" ? (t.gpr?.rank ?? "–") : i + 1}</td>
                <td>
                  <div className="team-cell">
                    <TeamLogo code={t.code} image={t.image} />
                    <span className="team-code bold">{t.code}</span>
                  </div>
                </td>
                <td className="record">
                  <span className="w">{t.wins}</span>-<span className="l">{t.losses}</span>
                </td>
                <td style={{ width: 104 }}>
                  <HpBar value={t.wins + t.losses ? winrate(t) : 1} />
                  <div className="form">
                    {t.form.slice(-5).map((f, j) => (
                      <i key={j} className={f} title={f === "W" ? "Victoria" : "Derrota"} />
                    ))}
                  </div>
                </td>
              </tr>
              {open === t.code ? (
                <tr className="detail">
                  <td colSpan={4}>
                    <TeamDex team={t} matches={data.matches} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
      {teams.length === 0 ? <p className="muted">Aún no hay equipos con partidos.</p> : null}
    </>
  );
}

function MatchesTab({ data }: { data: WorldsData }) {
  const mounted = useMounted();
  // Partidos en juego, los próximos y los últimos resultados, agrupados por día.
  const live = data.matches.filter((m) => m.state === "inProgress");
  const upcoming = data.matches.filter((m) => m.state === "unstarted").slice(0, 12);
  const recent = data.matches
    .filter((m) => m.state === "completed")
    .slice(-12)
    .reverse();

  const renderGroup = (title: string, list: Match[]) => {
    if (!list.length) return null;
    let lastDay = "";
    return (
      <section>
        <h3 className="px-small day-sep">{title}</h3>
        {list.map((m) => {
          const day = fmtDay(m.startTime, mounted);
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <Fragment key={m.id}>
              {showDay && day ? <div className="muted" style={{ margin: "8px 0 6px", fontSize: 18 }}>{day}</div> : null}
              <MatchRow m={m} mounted={mounted} />
            </Fragment>
          );
        })}
      </section>
    );
  };

  return (
    <>
      {renderGroup("● En juego", live)}
      {renderGroup("Próximos", upcoming)}
      {renderGroup("Resultados", recent)}
      {!data.matches.length ? <p className="muted">No hay partidos en el calendario.</p> : null}
    </>
  );
}

function MatchRow({ m, mounted }: { m: Match; mounted: boolean }) {
  const [a, b] = m.teams;
  const done = m.state === "completed";
  const aLost = done && a.outcome === "loss";
  const bLost = done && b.outcome === "loss";
  return (
    <div className={`match ${m.state === "inProgress" ? "live" : ""}`}>
      <div className={`side ${aLost ? "loser" : ""}`}>
        <TeamLogo code={a.code} image={a.image} size={24} />
        <span className="team-code bold">{a.code}</span>
      </div>
      <div className="score">
        {m.state === "unstarted" ? (
          <span className="px-small">{fmtTime(m.startTime, mounted)}</span>
        ) : (
          <>
            {a.gameWins} - {b.gameWins}
          </>
        )}
      </div>
      <div className={`side right ${bLost ? "loser" : ""}`}>
        <span className="team-code bold">{b.code}</span>
        <TeamLogo code={b.code} image={b.image} size={24} />
      </div>
      <div className="meta px-small muted">
        <span>{m.blockName}</span>
        <span>{m.state === "inProgress" ? <span style={{ color: "var(--red)" }}>En vivo</span> : `Bo${m.bestOf}`}</span>
      </div>
    </div>
  );
}

export function TeamsPanel({ data, loading }: { data: WorldsData; loading: boolean }) {
  const [tab, setTab] = useState<"tabla" | "partidos">("tabla");
  const mounted = useMounted();
  const updated = fmtTime(data.updatedAt, mounted);
  return (
    <aside className="side-panel card">
      <div className="side-head">
        <div className="px-title">{tab === "tabla" ? "EQUIPOS" : "COMBATES"}</div>
      </div>
      <div className="side-tabs" role="tablist">
        <button className="btn sm" role="tab" aria-pressed={tab === "tabla"} onClick={() => setTab("tabla")}>
          Clasificación
        </button>
        <button className="btn sm" role="tab" aria-pressed={tab === "partidos"} onClick={() => setTab("partidos")}>
          Partidos
        </button>
      </div>
      <div className="side-body">
        {data.source === "demo" ? (
          <div className="demo-banner px-small">Datos de demostración: la API oficial no responde ahora mismo.</div>
        ) : null}
        {tab === "tabla" ? <StandingsTab data={data} /> : <MatchesTab data={data} />}
      </div>
      <div className="side-foot px-small">
        <span>{data.source === "demo" ? "Demo" : "lolesports.com"}</span>
        <span>{loading ? "Actualizando…" : `Act. ${updated}`}</span>
      </div>
    </aside>
  );
}
