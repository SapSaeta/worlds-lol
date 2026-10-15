"use client";

import { useEffect, useState } from "react";
import { ChampSprite, Hp, TypeBadge } from "@/components/game/parts";
import { CLS_LABEL, movesOf, typeMult, type Action, type Battle, type Fighter } from "@/lib/game/engine";

const LINE_MS = 420;

function Info({ f, mine }: { f: Fighter; mine?: boolean }) {
  return (
    <div className="g-info card">
      <div className="g-info-name">
        <span className="bold">{f.champ.name}</span>
        <span className="g-lv">Nv {f.unit.level}</span>
      </div>
      <TypeBadge cls={f.champ.tags.includes("Monster") ? "Monster" : f.champ.cls} />
      <Hp hp={f.hp} max={f.max.hp} shield={f.shield} showNumbers={!!mine} />
    </div>
  );
}

function Balls({ fs, active }: { fs: Fighter[]; active: number }) {
  return (
    <span className="g-balls" aria-hidden>
      {fs.map((f, i) => (
        <i key={f.unit.uid} className={f.hp <= 0 ? "ko" : i === active ? "now" : ""} />
      ))}
    </span>
  );
}

/** Pantalla de combate por turnos, al estilo de los juegos de Pokémon. */
export function BattleView({ battle, onAction, onDone }: { battle: Battle; onAction: (a: Action) => void; onDone: () => void }) {
  const [shown, setShown] = useState(battle.lines.length);
  const [switching, setSwitching] = useState(false);
  const me = battle.mine[battle.a];
  const foe = battle.theirs[battle.b];
  const busy = shown < battle.lines.length;

  // Las frases del turno aparecen una a una; un toque en el cuadro las enseña todas.
  useEffect(() => {
    setShown(1);
    setSwitching(false);
  }, [battle]);
  useEffect(() => {
    if (shown >= battle.lines.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), LINE_MS);
    return () => clearTimeout(t);
  }, [shown, battle.lines.length]);

  const listOpen = battle.mustSwitch || switching;
  const foeCls = foe.champ.tags.includes("Monster") ? null : foe.champ.cls;

  return (
    <div className={`g-battle card${battle.kind === "boss" ? " boss" : ""}`}>
      <div className="g-foe-tag px-small">
        {battle.kind === "boss" ? "JEFE · " : ""}
        {battle.foe.name}
        {battle.foe.team && battle.kind !== "boss" ? ` (${battle.foe.team})` : ""}
        <Balls fs={battle.theirs} active={battle.b} />
      </div>
      <div className="g-field">
        <div className="g-row foe">
          <Info f={foe} />
          <div className={`g-sprite${foe.hp <= 0 ? " down" : ""}`}>
            <ChampSprite champ={foe.champ} size={104} res={30} />
          </div>
        </div>
        <div className="g-row me">
          <div className={`g-sprite${me.hp <= 0 ? " down" : ""}`}>
            <ChampSprite champ={me.champ} size={104} res={30} />
          </div>
          <Info f={me} mine />
        </div>
      </div>

      <button type="button" className="g-dialog card" onClick={() => setShown(battle.lines.length)} aria-live="polite">
        {battle.lines.slice(0, shown).map((l, i) => (
          <span key={i}>{l}</span>
        ))}
        {busy ? <span className="next">▼</span> : null}
      </button>

      {battle.result ? (
        <div className="g-actions-row">
          <button type="button" className="btn" onClick={onDone} disabled={busy}>
            Continuar
          </button>
        </div>
      ) : listOpen ? (
        <div className="g-switch">
          <div className="px-small g-switch-title">{battle.mustSwitch ? "¿A quién sacas?" : "Cambiar de campeón"}</div>
          {battle.mine.map((f, i) => (
            <button key={f.unit.uid} type="button" className="g-switch-btn card" disabled={busy || f.hp <= 0 || i === battle.a} onClick={() => onAction({ type: "switch", to: i })}>
              <ChampSprite champ={f.champ} size={32} />
              <span className="g-switch-name">
                {f.champ.name} <span className="g-lv">Nv {f.unit.level}</span>
              </span>
              <Hp hp={f.hp} max={f.max.hp} />
            </button>
          ))}
          {!battle.mustSwitch ? (
            <button type="button" className="btn sm" onClick={() => setSwitching(false)}>
              Volver
            </button>
          ) : null}
        </div>
      ) : (
        <div className="g-moves">
          {movesOf(me.champ).map((m) => {
            const cd = m.key === "R" && me.cdR > 0;
            const tm = m.power > 0 && foeCls ? typeMult(me.champ.cls, foeCls) : 1;
            return (
              <button key={m.key} type="button" className={`g-move card${cd ? " cd" : ""}`} disabled={busy || cd} onClick={() => onAction({ type: "move", key: m.key })}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.icon ? <img src={m.icon} alt="" width={32} height={32} loading="lazy" /> : <span className="g-key">{m.key}</span>}
                <span className="g-move-text">
                  <span className="g-move-name">
                    <span className="g-key">{m.key}</span> {m.name}
                  </span>
                  <span className="px-small muted">
                    {cd ? `Lista en ${me.cdR} ${me.cdR === 1 ? "turno" : "turnos"}` : m.note}
                    {tm > 1 ? <b className="eff up"> · Eficaz</b> : tm < 1 ? <b className="eff down"> · Poco eficaz</b> : null}
                  </span>
                </span>
              </button>
            );
          })}
          <button type="button" className="btn sm g-switch-open" disabled={busy || battle.mine.filter((f) => f.hp > 0).length < 2} onClick={() => setSwitching(true)}>
            Cambiar
          </button>
          {foeCls ? (
            <span className="px-small muted g-matchup">
              {CLS_LABEL[me.champ.cls]} contra {CLS_LABEL[foeCls]}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
