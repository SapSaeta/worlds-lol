"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { RevealButton, SpoilerGate, useGate, useMatchSpoilers } from "@/components/SpoilerProvider";
import { TeamLogo } from "@/components/TeamLogo";
import type { StageInfo } from "@/config/tournament";
import { byTime, isTbd, stageLayout, stageState, type Slot, type StageState, type SwissRecord } from "@/lib/bracket";
import type { Match, Team, TournamentMap as MapData } from "@/lib/types";

const STATE_LABEL: Record<StageState, [string, string]> = { done: ["Terminada", "Finished"], live: ["En juego", "Live"], next: ["Próximamente", "Upcoming"] };
const DRAW_OF: Record<string, [string, string]> = {
  play_ins: ["del Play-In", "the Play-In"],
  swiss: ["de la fase suiza", "the Swiss stage"],
  knockouts: ["de las eliminatorias", "the knockouts"],
};

/** Formatos de fecha en la zona horaria de quien mira (Madrid hasta que carga el navegador). */
function useDates() {
  const { intl } = useLocale();
  const [tz, setTz] = useState("Europe/Madrid");
  useEffect(() => {
    const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (local) setTz(local);
  }, []);
  return useMemo(() => {
    const day = new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", month: "short", timeZone: tz });
    const hour = new Intl.DateTimeFormat(intl, { hour: "2-digit", minute: "2-digit", timeZone: tz });
    const span = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", timeZone: tz });
    return {
      tz,
      when: (iso: string, withHour = true) => (iso ? `${day.format(new Date(iso)).replace(",", "")}${withHour ? ` · ${hour.format(new Date(iso))}` : ""}` : ""),
      range: (ms: Match[]) => {
        const times = ms.map((m) => Date.parse(m.startTime)).filter((t) => !Number.isNaN(t));
        if (!times.length) return "";
        return span.formatRange(Math.min(...times), Math.max(...times));
      },
    };
  }, [tz, intl]);
}

type Dates = ReturnType<typeof useDates>;
type Spoilers = ReturnType<typeof useMatchSpoilers>;

export function TournamentMap({ map, info, teams }: { map: MapData; info: StageInfo[]; teams: Team[] }) {
  const dates = useDates();
  const { t, locale } = useLocale();
  const stages = useMemo(
    () =>
      map.stages.map((st) => {
        const meta = info.find((i) => i.slug === st.slug);
        return { ...st, name: meta?.name ?? st.name, meta, state: stageState(st.matches), layout: stageLayout(st.slug, st.matches, locale) };
      }),
    [map.stages, info, locale],
  );
  // La fase "de hoy": la primera que no ha terminado.
  const current = Math.max(0, stages.findIndex((s) => s.state !== "done"));
  const allDone = stages.every((s) => s.state === "done");
  const [sel, setSel] = useState(current);
  const [team, setTeam] = useState<string | null>(null);
  const allMatches = useMemo(() => map.stages.flatMap((s) => s.matches), [map.stages]);
  const spoilers = useMatchSpoilers(allMatches);
  const records = useGate("balances");

  const pickable = useMemo(() => {
    const out = new Map<string, { code: string; name: string; image: string; rank: number }>();
    for (const t of teams) out.set(t.code, { code: t.code, name: t.name, image: t.image, rank: t.gpr?.rank ?? Infinity });
    for (const st of map.stages)
      for (const m of st.matches) for (const t of m.teams) if (!isTbd(t) && !out.has(t.code)) out.set(t.code, { code: t.code, name: t.name, image: t.image, rank: Infinity });
    return [...out.values()].sort((a, b) => a.rank - b.rank || a.code.localeCompare(b.code));
  }, [teams, map.stages]);

  if (!stages.length) {
    const err = map.error ? ` (${map.error})` : "";
    return (
      <div className="card dialog note">
        {t(`No he podido cargar el cuadro del torneo ahora mismo${err}. Vuelve a intentarlo en un rato.`, `Couldn't load the tournament bracket right now${err}. Please try again in a while.`)}
      </div>
    );
  }

  const stage = stages[Math.min(sel, stages.length - 1)];
  const toggle = (code: string) => setTeam((t) => (t === code ? null : code));
  const chosen = pickable.find((t) => t.code === team);

  return (
    <div className="tmap">
      <ol className="tm-route card" aria-label={t("Fases del torneo", "Tournament stages")}>
        {stages.map((s, i) => {
          const plays = team ? s.matches.some((m) => !spoilers.hidesTeams(m) && m.teams.some((t) => t.code === team)) : false;
          return (
            <li key={s.slug}>
              <button type="button" className={`tm-town ${s.state}`} aria-pressed={i === sel} onClick={() => setSel(i)}>
                {i === current && !allDone ? <span className="tm-here">{t("Hoy", "Now")}</span> : null}
                <span className="tm-house" aria-hidden>
                  {plays && chosen ? <TeamLogo code={chosen.code} image={chosen.image} size={22} /> : <i />}
                </span>
                <span className="tm-town-name">{s.name}</span>
                <span className="tm-town-city">{s.meta?.city ?? ""}</span>
                <span className="tm-town-dates">{dates.range(s.matches)}</span>
                <span className={`badge tm-state ${s.state}`}>{t(...STATE_LABEL[s.state])}</span>
              </button>
            </li>
          );
        })}
      </ol>

      {stage.meta ? (
        <div className="tm-info card">
          <span className="bold">{stage.meta.venue}</span>
          <span>{stage.meta.format}</span>
        </div>
      ) : null}

      <div className="dex-filters card tm-teams">
        <div className="filter-row">
          <span className="px-small muted sort-label">{t("Sigue a", "Follow")}</span>
          <button type="button" className="chip" aria-pressed={!team} onClick={() => setTeam(null)}>
            {t("Todos", "All")}
          </button>
          {pickable.map((p) => (
            <button key={p.code} type="button" className="chip tm-chip" aria-pressed={team === p.code} title={p.name} onClick={() => toggle(p.code)}>
              {p.image ? <TeamLogo code={p.code} image={p.image} size={16} /> : null}
              {p.code}
            </button>
          ))}
        </div>
        {chosen ? <TeamPath code={chosen.code} name={chosen.name} stages={stages} dates={dates} spoilers={spoilers} onStage={setSel} /> : null}
      </div>

      <div className={`tm-board ${stage.layout.kind} ${spoilers.guard}`} data-team={team ?? undefined}>
        {stage.layout.columns.map((col) => (
          <section key={col.title} className="tm-col">
            <h3 className="tm-col-title">
              {col.title}
              <small>{dates.range(col.groups.flatMap((g) => g.slots.map((s) => s.match)))}</small>
            </h3>
            <div className="tm-col-body">
              {col.groups.map((g, gi) => (
                <div key={g.title ?? gi} className="tm-group">
                  {g.title ? <div className="tm-group-title">{g.title}</div> : null}
                  {g.slots.map((slot) => (
                    <MatchCard key={slot.match.id} slot={slot} team={team} dates={dates} spoilers={spoilers} onTeam={toggle} />
                  ))}
                </div>
              ))}
              {col.note ? <div className="tm-col-note px-small">{col.note}</div> : null}
            </div>
          </section>
        ))}
        {stage.layout.kind === "swiss" ? (
          <section className="tm-col tm-out">
            <h3 className="tm-col-title">{t("Balance final", "Final records")}</h3>
            <div className="tm-col-body">
              {records.hidden ? (
                <SpoilerGate
                  text={t("Quién pasa y quién cae, oculto.", "Who advances and who is out, hidden.")}
                  action={t("Ver balances", "Show records")}
                  onShow={records.show}
                />
              ) : (
                <>
                  <RecordList title={t("A eliminatorias", "To knockouts")} list={stage.layout.qualified ?? []} total={8} cls="up" team={team} onTeam={toggle} />
                  <RecordList title={t("Eliminados", "Eliminated")} list={stage.layout.eliminated ?? []} total={8} cls="down" team={team} onTeam={toggle} />
                </>
              )}
            </div>
          </section>
        ) : null}
      </div>
      <p className="px-small muted tm-tz">
        {t(
          `Horas en tu zona horaria (${dates.tz.replace(/_/g, " ")}). Toca un equipo para seguir su camino.`,
          `Times in your time zone (${dates.tz.replace(/_/g, " ")}). Tap a team to follow its path.`,
        )}
      </p>
    </div>
  );
}

function MatchCard({ slot, team, dates, spoilers, onTeam }: { slot: Slot; team: string | null; dates: Dates; spoilers: Spoilers; onTeam: (code: string) => void }) {
  const { t, href } = useLocale();
  const m = slot.match;
  const live = m.state === "inProgress";
  const hideTeams = spoilers.hidesTeams(m);
  const hideScore = spoilers.hidesResult(m);
  const done = m.state === "completed" && !hideScore;
  const mine = !hideTeams && !!team && m.teams.some((t) => t.code === team);
  const cls = ["tm-match", live ? "live" : "", done ? "done" : "", mine ? "hl" : team ? "dim" : ""].filter(Boolean).join(" ");
  return (
    <article className={cls}>
      <div className="tm-match-head">
        <span>
          {live
            ? `${t("Ahora", "Now")}${m.bestOf ? ` · Bo${m.bestOf}` : ""}`
            : slot.approx
              ? t("Cruce por sortear", "Matchup to be drawn")
              : dates.when(m.startTime) || t("Fecha por fijar", "Date TBD")}
        </span>
        {live ? <span className="badge live">{t("Directo", "Live")}</span> : m.bestOf ? <span className="tm-bo">Bo{m.bestOf}</span> : null}
      </div>
      {m.teams.map((tm, i) => {
        if (hideTeams)
          return (
            <div key={i} className="tm-row empty">
              <span className="team-logo fallback tm-q">?</span>
              <span className="tm-code">{t("Oculto", "Hidden")}</span>
            </div>
          );
        const tbd = isTbd(tm);
        const win = done && (tm.outcome === "win" || (tm.outcome == null && tm.gameWins > m.teams[1 - i].gameWins));
        return (
          <button
            key={i}
            type="button"
            className={`tm-row${win ? " win" : ""}${done && !win ? " loss" : ""}${tm.code === team ? " me" : ""}`}
            disabled={tbd}
            title={tbd ? undefined : tm.name}
            onClick={() => onTeam(tm.code)}
          >
            {tbd ? <span className="team-logo fallback tm-q">?</span> : <TeamLogo code={tm.code} image={tm.image} size={20} />}
            <span className="tm-code">{tbd ? (slot.hints?.[i] ?? t("Por decidir", "TBD")) : tm.code}</span>
            <span className="tm-score">{hideScore ? "?" : done || live ? tm.gameWins : ""}</span>
          </button>
        );
      })}
      {hideScore || hideTeams ? (
        <RevealButton className="tm-reveal" onClick={() => spoilers.reveal(m.id)} label={hideScore ? undefined : t("Ver equipos", "Show teams")} />
      ) : null}
      {live ? (
        <Link href={href("/")} className="tm-watch px-small">
          {t("Ver en directo ▸", "Watch live ▸")}
        </Link>
      ) : null}
    </article>
  );
}

function RecordList({ title, list, total, cls, team, onTeam }: { title: string; list: SwissRecord[]; total: number; cls: string; team: string | null; onTeam: (code: string) => void }) {
  const { t } = useLocale();
  return (
    <div className={`tm-group tm-records ${cls}`}>
      <div className="tm-group-title">{title}</div>
      {list.map((r) => (
        <button key={r.team.code} type="button" className={`tm-row${r.team.code === team ? " me" : ""}`} title={r.team.name} onClick={() => onTeam(r.team.code)}>
          <TeamLogo code={r.team.code} image={r.team.image} size={20} />
          <span className="tm-code">{r.team.code}</span>
          <span className="tm-score">
            {r.w}-{r.l}
          </span>
        </button>
      ))}
      {Array.from({ length: Math.max(0, total - list.length) }, (_, i) => (
        <div key={i} className="tm-row empty">
          <span className="team-logo fallback tm-q">?</span>
          <span className="tm-code">{t("Plaza libre", "Open spot")}</span>
        </div>
      ))}
    </div>
  );
}

type StageView = { slug: string; name: string; matches: Match[] };

function TeamPath({ code, name, stages, dates, spoilers, onStage }: { code: string; name: string; stages: StageView[]; dates: Dates; spoilers: Spoilers; onStage: (i: number) => void }) {
  const all = stages.flatMap((s, i) => s.matches.filter((m) => m.teams.some((t) => t.code === code)).map((m) => ({ m, stage: s.name, i }))).sort((a, b) => byTime(a.m, b.m));
  // Sin spoilers, el camino se corta en el primer cruce tapado.
  const path = all.filter(({ m }) => !spoilers.hidesTeams(m));
  const cut = path.length < all.length;
  // Un equipo sin partidos entra en la primera fase cuyo primer cruce aún está por sortear.
  const waiting = stages.find((s) => [...s.matches].sort(byTime)[0]?.teams.some(isTbd));
  const { t } = useLocale();
  const draw = waiting && DRAW_OF[waiting.slug];
  return (
    <div className="tm-path">
      <div className="px-small bold">{t(`Camino de ${name}`, `${name}'s path`)}</div>
      {path.length ? (
        <ol>
          {path.map(({ m, stage, i }) => {
            const me = m.teams.find((t) => t.code === code)!;
            const rival = m.teams.find((t) => t !== me)!;
            const done = m.state === "completed" && !spoilers.hidesResult(m);
            const won = done && (me.outcome === "win" || (me.outcome == null && me.gameWins > rival.gameWins));
            return (
              <li key={m.id}>
                <button type="button" onClick={() => onStage(i)}>
                  <span className="muted">{stage}</span>
                  <span>{dates.when(m.startTime, !done)}</span>
                  <span className="tm-vs">
                    vs {isTbd(rival) ? t("por decidir", "TBD") : rival.code}
                    {done ? ` · ${me.gameWins}-${rival.gameWins}` : ""}
                  </span>
                  {done ? <span className={`badge ${won ? "tm-w" : "tm-l"}`}>{won ? t("Victoria", "Win") : t("Derrota", "Loss")}</span> : m.state === "inProgress" ? <span className="badge live">{t("Directo", "Live")}</span> : null}
                </button>
                {spoilers.hidesResult(m) ? <RevealButton className="tm-path-reveal" onClick={() => spoilers.reveal(m.id)} /> : null}
              </li>
            );
          })}
        </ol>
      ) : cut ? null : (
        <p className="px-small muted">
          {t(
            `Aún sin rival asignado${draw ? `: su primer cruce sale del sorteo ${draw[0]}` : ""}.`,
            `No opponent assigned yet${draw ? `: their first matchup comes from the ${draw[1]} draw` : ""}.`,
          )}
        </p>
      )}
      {cut ? (
        <p className="px-small muted">
          {t("Sus siguientes cruces están ocultos hasta que destapes los resultados anteriores.", "Their next matchups stay hidden until you reveal the earlier results.")}
        </p>
      ) : null}
    </div>
  );
}
