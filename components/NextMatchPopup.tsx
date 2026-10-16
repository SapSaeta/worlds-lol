"use client";

import { useEffect, useState } from "react";
import { TeamLogo } from "@/components/TeamLogo";
import type { Match, MatchTeam } from "@/lib/types";

const dayFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
const hourFmt = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZoneName: "short" });

function countdown(ms: number) {
  if (ms <= 60_000) return "A punto de empezar";
  const min = Math.round(ms / 60_000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d) return `Empieza en ${d} d ${h} h`;
  if (h) return `Empieza en ${h} h ${m} min`;
  return `Empieza en ${m} min`;
}

/** El siguiente partido, solo si no hay ninguno en juego. */
export function pickNextMatch(matches: Match[]): Match | null {
  if (matches.some((m) => m.state === "inProgress")) return null;
  return matches.find((m) => m.state === "unstarted" && m.startTime) ?? null;
}

/**
 * Aviso centrado sobre el reproductor cuando no hay partido en directo. La
 * hora se pinta en el navegador para usar su zona horaria.
 */
export function NextMatchPopup({ match }: { match: Match }) {
  const [now, setNow] = useState<number | null>(null);
  const [closedId, setClosedId] = useState<string | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (now === null || closedId === match.id) return null;

  const start = new Date(match.startTime);
  const [a, b] = match.teams;
  const day = dayFmt.format(start);
  const meta = [match.blockName, match.bestOf ? `Bo${match.bestOf}` : ""].filter(Boolean).join(" · ");

  return (
    <div className="next-popup-wrap">
      <div className="next-popup card" role="dialog" aria-label="Próximo partido">
        <button className="dock-btn next-popup-close" onClick={() => setClosedId(match.id)} aria-label="Cerrar aviso" title="Cerrar">
          ✕
        </button>
        <p className="next-popup-kicker px-small">Ahora no hay partido en directo</p>
        <h2 className="next-popup-title">Próximo partido</h2>
        <div className="next-popup-teams">
          <PopupTeam team={a} />
          <span className="next-popup-vs" aria-hidden>
            VS
          </span>
          <PopupTeam team={b} />
        </div>
        <p className="next-popup-when">
          <span className="next-popup-day">{day.charAt(0).toUpperCase() + day.slice(1)}</span>
          <span className="next-popup-hour">{hourFmt.format(start)}</span>
        </p>
        <p className="next-popup-meta">
          <span className="next-popup-count">{countdown(start.getTime() - now)}</span>
          {meta ? <span>{meta}</span> : null}
        </p>
      </div>
    </div>
  );
}

function PopupTeam({ team }: { team: MatchTeam }) {
  return (
    <div className="next-popup-team">
      <div className="next-popup-logo">
        <TeamLogo code={team.code} image={team.image} size={88} />
      </div>
      <span className="next-popup-code">{team.code}</span>
      <span className="next-popup-name">{team.name}</span>
    </div>
  );
}
