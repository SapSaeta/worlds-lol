"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import type { Match, Team, WorldsData } from "@/lib/types";

type SortKey = "record" | "games" | "name";

const ROLE_LABEL: Record<string, string> = {
  top: "Top",
  jungle: "Jungla",
  mid: "Mid",
  bottom: "ADC",
  support: "Supp",
};

const ROLE_ORDER = ["top", "jungle", "mid", "bottom", "support"];

function winrate(t: Team) {
  const total = t.wins + t.losses;
  return total ? t.wins / total : 0;
}

function sortTeams(teams: Team[], key: SortKey) {
  return [...teams].sort((a, b) => {
    if (key === "name") return a.code.localeCompare(b.code);
    if (key === "games") return b.gameWins - b.gameLosses - (a.gameWins - a.gameLosses) || b.gameWins - a.gameWins;
    return b.wins - a.wins || a.losses - b.losses || b.gameWins - b.gameLosses - (a.gameWins - a.gameLosses);
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

function HpBar({ value }: { value: number }) {
  const cls = value >= 0.5 ? "" : value >= 0.25 ? "mid" : "low";
  return (
    <div className="hp" title={`${Math.round(value * 100)}% de victorias`}>
      <span className="hp-label">WR</span>
      <span className="hp-track">
        <span className={`hp-fill ${cls}`} style={{ width: `${Math.max(value * 100, 2)}%` }} />
      </span>
    </div>
  );
}

function TeamDex({ team, matches }: { team: Team; matches: Match[] }) {
  const next = matches.find((m) => m.state !== "completed" && m.teams.some((t) => t.code === team.code));
  const rival = next?.teams.find((t) => t.code !== team.code);
  const mounted = useMounted();
  const players = [...team.players].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  return (
    <div className="dex-card">
      <div className="dex-head">
        <TeamLogo code={team.code} image={team.image} size={40} />
        <div>
          <div className="px-title">{team.name}</div>
          {team.region ? <span className="badge oficial">{team.region}</span> : null}
        </div>
      </div>
      <div className="dex-stats">
        <div className="dex-stat">
          <span className="px-small muted">Series</span>
          <b>
            {team.wins}-{team.losses}
          </b>
        </div>
        <div className="dex-stat">
          <span className="px-small muted">Partidas</span>
          <b>
            {team.gameWins}-{team.gameLosses}
          </b>
        </div>
        <div className="dex-stat">
          <span className="px-small muted">Victorias</span>
          <b>{Math.round(winrate(team) * 100)}%</b>
        </div>
      </div>
      {next && rival ? (
        <p style={{ margin: "6px 0" }}>
          <span className="px-small muted">Siguiente: </span>
          vs <strong>{rival.code}</strong> · {next.state === "inProgress" ? "¡en juego!" : `${fmtDay(next.startTime, mounted)}, ${fmtTime(next.startTime, mounted)}`}
        </p>
      ) : null}
      {players.length ? (
        <div className="roster">
          {players.map((p) => (
            <div className="roster-row" key={p.name + p.role}>
              <span className={`role ${ROLE_LABEL[p.role] ? p.role : "none"}`}>{ROLE_LABEL[p.role] ?? p.role ?? "—"}</span>
              <span className="pname">{p.name}</span>
              {p.realName ? <span className="muted" style={{ fontSize: 13 }}>{p.realName}</span> : null}
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
            <th>#</th>
            <th>{sortBtn("name", "Equipo")}</th>
            <th>{sortBtn("record", "V-D")}</th>
            <th>{sortBtn("games", "Forma")}</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => (
            <Fragment key={t.code}>
              <tr className="row" aria-expanded={open === t.code} onClick={() => setOpen(open === t.code ? null : t.code)}>
                <td className="rank">{i + 1}</td>
                <td>
                  <div className="team-cell">
                    <TeamLogo code={t.code} image={t.image} />
                    <span className="team-code">{t.code}</span>
                  </div>
                </td>
                <td className="record">
                  <span className="w">{t.wins}</span>-<span className="l">{t.losses}</span>
                </td>
                <td style={{ width: 96 }}>
                  <HpBar value={winrate(t)} />
                  <div className="form" style={{ marginTop: 4 }}>
                    {t.form.slice(-5).map((f, j) => (
                      <i key={j} className={f} title={f === "W" ? "Victoria" : "Derrota"} />
                    ))}
                  </div>
                </td>
              </tr>
              {open === t.code ? (
                <tr>
                  <td colSpan={4} style={{ padding: 0, background: "transparent" }}>
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
              {showDay && day ? <div className="muted" style={{ margin: "6px 2px 4px", fontSize: 13 }}>{day}</div> : null}
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
        <TeamLogo code={a.code} image={a.image} size={20} />
        <span className="team-code">{a.code}</span>
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
        <span className="team-code">{b.code}</span>
        <TeamLogo code={b.code} image={b.image} size={20} />
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
    <aside className="side-panel pixel-box">
      <div className="side-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "tabla"} onClick={() => setTab("tabla")}>
          Clasificación
        </button>
        <button role="tab" aria-selected={tab === "partidos"} onClick={() => setTab("partidos")}>
          Partidos
        </button>
      </div>
      <div className="side-body">
        {data.source === "demo" ? (
          <div className="demo-banner px-small">Datos de demostración: la API oficial no responde ahora mismo.</div>
        ) : null}
        {tab === "tabla" ? <StandingsTab data={data} /> : <MatchesTab data={data} />}
      </div>
      <div className="side-foot px-small muted">
        <span>{data.source === "demo" ? "Demo" : "lolesports.com"}</span>
        <span>{loading ? "Actualizando…" : `Act. ${updated}`}</span>
      </div>
    </aside>
  );
}
