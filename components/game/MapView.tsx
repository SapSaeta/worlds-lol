"use client";

import { useLocale } from "@/components/LocaleProvider";
import { PixelImg } from "@/components/PixelImg";
import { TeamLogo } from "@/components/TeamLogo";
import { PixelIcon } from "@/components/game/parts";
import { STAGES, monsterIcon, monsterName, reachable, type MapNode, type NodeKind, type Run } from "@/lib/game/engine";
import type { GameData } from "@/lib/game/types";

const KIND_LABEL: Record<NodeKind, [string, string]> = {
  fight: ["Combate", "Battle"],
  shop: ["Tienda", "Shop"],
  event: ["Evento", "Event"],
  fountain: ["Fuente", "Fountain"],
  objective: ["Objetivo", "Objective"],
  boss: ["Jefe", "Boss"],
};

/** Mapa de la fase sobre la Grieta: de tu base (abajo) al nexo rival (arriba), con los caminos posibles. */
export function MapView({ run, data, onEnter }: { run: Run; data: GameData; onEnter: (row: number, col: number) => void }) {
  const { t } = useLocale();
  const map = run.maps[run.stage];
  const rows = map.rows;
  const next = reachable(run);
  const nextRow = run.row + 1;
  const boss = data.teams.find((t) => t.code === map.boss);
  const x = (i: number, n: number) => ((i + 1) / (n + 1)) * 100;
  const y = (r: number) => 100 - ((r + 0.5) / rows.length) * 100;
  const title = (n: MapNode) => (n.kind === "objective" && n.monster ? monsterName(n.monster, n.drake) : n.kind === "boss" ? `${t("Jefe", "Boss")}: ${boss?.name ?? map.boss}` : t(...KIND_LABEL[n.kind]));

  return (
    <div className="g-map card">
      <div className="g-map-head">
        <div className="g-stages" aria-label={t("Fases", "Stages")}>
          {STAGES.map((s, i) => (
            <span key={s.name} className={`g-pip${i < run.stage ? " done" : i === run.stage ? " now" : ""}`} title={s.name} />
          ))}
        </div>
        <div className="g-map-title">
          {map.name} <span className="muted">· {map.city}</span>
        </div>
        <div className="g-map-boss px-small">
          {t("Jefe", "Boss")}: <TeamLogo code={map.boss} image={boss?.image ?? ""} size={18} /> {boss?.name ?? map.boss}
        </div>
      </div>
      <div className="g-rift">
        <svg className="g-paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {rows.flatMap((row, r) =>
            row.flatMap((n, i) =>
              n.next.map((j) => {
                const walked = n.done && rows[r + 1][j].done;
                const open = r === run.row && i === run.col && next.includes(j);
                return (
                  <line
                    key={`${r}-${i}-${j}`}
                    x1={x(i, row.length)}
                    y1={y(r)}
                    x2={x(j, rows[r + 1].length)}
                    y2={y(r + 1)}
                    className={walked ? "walked" : open ? "open" : ""}
                    vectorEffect="non-scaling-stroke"
                  />
                );
              }),
            ),
          )}
        </svg>
        {rows.map((row, r) =>
          row.map((n, i) => {
            const can = r === nextRow && next.includes(i);
            const here = r === run.row && i === run.col;
            const t = title(n);
            return (
              <button
                key={`${r}-${i}`}
                type="button"
                className={`g-node ${n.kind}${can ? " can" : ""}${here ? " here" : ""}${n.done ? " done" : ""}`}
                style={{ left: `${x(i, row.length)}%`, top: `${y(r)}%` }}
                disabled={!can}
                onClick={() => onEnter(r, i)}
                title={t}
                aria-label={t}
              >
                {n.kind === "objective" && n.monster ? (
                  <PixelImg src={monsterIcon(n.monster, n.drake)} alt="" size={34} res={24} />
                ) : n.kind === "boss" ? (
                  <TeamLogo code={map.boss} image={boss?.image ?? ""} size={40} />
                ) : (
                  <PixelIcon name={n.kind} size={24} />
                )}
              </button>
            );
          }),
        )}
      </div>
      <div className="g-legend px-small">
        {(Object.keys(KIND_LABEL) as NodeKind[]).map((k) => (
          <span key={k}>
            <PixelIcon name={k} size={14} /> {t(...KIND_LABEL[k])}
          </span>
        ))}
      </div>
    </div>
  );
}
