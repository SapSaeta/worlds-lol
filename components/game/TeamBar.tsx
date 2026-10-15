"use client";

import { useState } from "react";
import { ChampSprite, Hp, ItemIcon, StatLine, TypeBadge, statsText } from "@/components/game/parts";
import { MAX_ITEMS, movesOf, unitStats, type Run, type Unit } from "@/lib/game/engine";
import type { GameData } from "@/lib/game/types";

/** Tu equipo: icono, nivel y vida de cada campeón. Al tocar uno se ve su ficha. */
export function TeamBar({
  run,
  data,
  onPick,
  pickLabel,
  disabled,
  hint,
}: {
  run: Run;
  data: GameData;
  onPick?: (u: Unit) => void;
  pickLabel?: string;
  disabled?: (u: Unit) => boolean;
  hint?: (u: Unit) => string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const shown = run.team.find((u) => u.uid === open);
  return (
    <div className="g-team">
      <div className="g-team-row">
        {run.team.map((u) => {
          const c = data.champions[u.champ];
          const d = unitStats(u, data, run.trainer.role);
          const off = disabled?.(u);
          return (
            <button
              key={u.uid}
              type="button"
              className={`g-unit card${u.hp <= 0 ? " ko" : ""}${open === u.uid ? " open" : ""}`}
              disabled={off}
              onClick={() => (onPick ? onPick(u) : setOpen(open === u.uid ? null : u.uid))}
              title={onPick ? pickLabel : "Ver ficha"}
            >
              <ChampSprite champ={c} size={40} />
              <span className="g-unit-name">{c.name}</span>
              <span className="g-lv">Nv {u.level}</span>
              <Hp hp={u.hp} max={d.hp} showNumbers={false} />
              <span className="g-unit-items">
                {Array.from({ length: MAX_ITEMS }, (_, i) => {
                  const it = data.items.find((x) => x.id === u.items[i]);
                  return it ? <ItemIcon key={i} item={it} size={14} /> : <i key={i} />;
                })}
              </span>
              {hint?.(u) ? <span className="g-hint px-small">{hint(u)}</span> : null}
            </button>
          );
        })}
      </div>
      {shown && !onPick ? <UnitSheet unit={shown} run={run} data={data} /> : null}
    </div>
  );
}

export function UnitSheet({ unit, run, data }: { unit: Unit; run: Run; data: GameData }) {
  const c = data.champions[unit.champ];
  const d = unitStats(unit, data, run.trainer.role);
  return (
    <div className="g-sheet card">
      <div className="g-sheet-head">
        <ChampSprite champ={c} size={56} />
        <div>
          <div className="bold g-sheet-name">
            {c.name} <span className="g-lv">Nv {unit.level}</span>
          </div>
          <div className="px-small muted">{c.title}</div>
          <TypeBadge cls={c.cls} /> <span className="px-small muted">{c.magic ? "Daño mágico" : "Daño físico"}</span>
        </div>
      </div>
      <Hp hp={unit.hp} max={d.hp} />
      <StatLine d={d} magic={c.magic} />
      <ul className="g-moves-list">
        {movesOf(c).map((m) => (
          <li key={m.key}>
            <span className="g-key">{m.key}</span> {m.name} <span className="muted">· {m.note}</span>
          </li>
        ))}
      </ul>
      {unit.items.length ? (
        <div className="g-sheet-items">
          {unit.items.map((id, i) => {
            const it = data.items.find((x) => x.id === id);
            return it ? (
              <div key={i} className="px-small">
                <ItemIcon item={it} size={20} /> {it.name} <span className="muted">{statsText(it.stats)}</span>
              </div>
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
}
