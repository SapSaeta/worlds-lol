"use client";

import { PixelIcon } from "@/components/game/parts";
import { MONSTERS, STAGES, reachable, type MapNode, type NodeKind, type Run } from "@/lib/game/engine";

const KIND_LABEL: Record<NodeKind, string> = {
  fight: "Combate",
  shop: "Tienda",
  event: "Evento",
  fountain: "Fuente",
  objective: "Objetivo",
  boss: "Jefe",
};

const nodeTitle = (n: MapNode) => (n.kind === "objective" && n.monster ? MONSTERS[n.monster].name : KIND_LABEL[n.kind]);

/** Mapa de la fase: de abajo (inicio) a arriba (jefe), con los caminos posibles. */
export function MapView({ run, onEnter }: { run: Run; onEnter: (row: number, col: number) => void }) {
  const map = run.maps[run.stage];
  const rows = map.rows;
  const next = reachable(run);
  const nextRow = run.row + 1;
  const x = (i: number, n: number) => ((i + 1) / (n + 1)) * 100;
  const y = (r: number) => 100 - ((r + 0.5) / rows.length) * 100;

  return (
    <div className="g-map card">
      <div className="g-map-head">
        <div className="g-stages" aria-label="Fases">
          {STAGES.map((s, i) => (
            <span key={s.name} className={`g-pip${i < run.stage ? " done" : i === run.stage ? " now" : ""}`} title={s.name} />
          ))}
        </div>
        <div className="g-map-title">
          {map.name} <span className="muted">· {map.city}</span>
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
            return (
              <button
                key={`${r}-${i}`}
                type="button"
                className={`g-node ${n.kind}${can ? " can" : ""}${here ? " here" : ""}${n.done ? " done" : ""}`}
                style={{ left: `${x(i, row.length)}%`, top: `${y(r)}%` }}
                disabled={!can}
                onClick={() => onEnter(r, i)}
                title={nodeTitle(n)}
                aria-label={nodeTitle(n)}
              >
                <PixelIcon name={n.kind} size={n.kind === "boss" ? 32 : 24} />
              </button>
            );
          }),
        )}
      </div>
      <div className="g-legend px-small">
        {(Object.keys(KIND_LABEL) as NodeKind[]).map((k) => (
          <span key={k}>
            <PixelIcon name={k} size={14} /> {KIND_LABEL[k]}
          </span>
        ))}
      </div>
    </div>
  );
}
