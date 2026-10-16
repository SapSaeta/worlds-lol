"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import type { Match, WorldsData } from "@/lib/types";

/** Recuadro de la cabecera con el partido en juego o el siguiente. */
export function NextMatchChip() {
  const { t, intl } = useLocale();
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/worlds")
        .then((r) => (r.ok ? (r.json() as Promise<WorldsData>) : null))
        .then((d) => {
          if (!alive || !d) return;
          const live = d.matches.find((m) => m.state === "inProgress");
          setMatch(live ?? d.matches.find((m) => m.state === "unstarted") ?? null);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 120_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!match) return null;
  const [a, b] = match.teams;
  const live = match.state === "inProgress";
  const fmt = new Intl.DateTimeFormat(intl, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <span className="status-chip" title={match.blockName}>
      {live ? <span className="live-dot" /> : null}
      {a.code} vs {b.code}
      <span style={{ color: "#fff" }}>{live ? t("EN VIVO", "LIVE") : fmt.format(new Date(match.startTime))}</span>
    </span>
  );
}
