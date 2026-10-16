"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { useMatchSpoilers } from "@/components/SpoilerProvider";
import type { Match, WorldsData } from "@/lib/types";

/** Recuadro de la cabecera con el partido en juego o el siguiente. */
export function NextMatchChip() {
  const { t, intl } = useLocale();
  const [matches, setMatches] = useState<Match[]>([]);
  const spoilers = useMatchSpoilers(matches);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/worlds")
        .then((r) => (r.ok ? (r.json() as Promise<WorldsData>) : null))
        .then((d) => {
          if (!alive || !d) return;
          setMatches(d.matches);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 120_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const match = matches.find((m) => m.state === "inProgress") ?? matches.find((m) => m.state === "unstarted");
  if (!match) return null;
  // En modo sin spoilers, saber quién juega puede destripar la serie anterior.
  const [a, b] = spoilers.hidesTeams(match) ? ["?", "?"] : match.teams.map((t) => t.code);
  const live = match.state === "inProgress";
  const fmt = new Intl.DateTimeFormat(intl, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <span className={`status-chip ${spoilers.guard}`} title={match.blockName}>
      {live ? <span className="live-dot" /> : null}
      {a} vs {b}
      <span style={{ color: "#fff" }}>{live ? t("EN VIVO", "LIVE") : fmt.format(new Date(match.startTime))}</span>
    </span>
  );
}
