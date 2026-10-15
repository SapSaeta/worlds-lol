"use client";

import { useEffect, useState } from "react";
import { ChampSprite, Hp, PixelIcon, Portrait, TypeBadge } from "@/components/game/parts";
import { CLS_LABEL, estimate, moveNote, movesOf, type Action, type BEvent, type Battle, type Fighter } from "@/lib/game/engine";

/** Lo que tarda cada paso del turno, para que se vean los golpes. */
const STEP_MS: Record<BEvent["kind"], number> = { intro: 700, move: 520, hit: 720, miss: 620, heal: 620, shield: 560, status: 620, ko: 820, switch: 620, end: 500 };

const STATUS_LABEL: [keyof Fighter["st"], string][] = [
  ["stun", "Aturdido"],
  ["slow", "Ralentizado"],
  ["haste", "Rápido"],
  ["buff", "Potenciado"],
  ["guard", "Protegido"],
  ["evade", "Esquiva"],
];

function Info({ f, hp, shield, mine, showStatus }: { f: Fighter; hp: number; shield: number; mine?: boolean; showStatus: boolean }) {
  const monster = f.champ.tags.includes("Monster");
  return (
    <div className={`g-info card${mine ? " mine" : ""}`}>
      <div className="g-info-name">
        <span className="bold">{f.champ.name}</span>
        <span className="g-lv">Nv {f.unit.level}</span>
      </div>
      <div className="g-info-tags">
        <TypeBadge cls={monster ? "Monster" : f.champ.cls} />
        {showStatus
          ? STATUS_LABEL.filter(([k]) => f.st[k] > 0).map(([k, label]) => (
              <span key={k} className={`g-status s-${k}`}>
                {label}
              </span>
            ))
          : null}
      </div>
      <Hp hp={hp} max={f.max.hp} shield={shield} showNumbers={!!mine} />
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

/** Número que sale flotando sobre el campeón: daño, cura o esquiva. */
function Float({ ev }: { ev: BEvent }) {
  if (ev.kind === "hit" && ev.amount) return <span className={`g-float dmg${ev.crit ? " crit" : ""}`}>-{ev.amount}</span>;
  if (ev.kind === "heal" && ev.amount) return <span className="g-float heal">+{ev.amount}</span>;
  if (ev.kind === "miss") return <span className="g-float miss">¡Esquiva!</span>;
  if (ev.kind === "status" && /aturdido!/.test(ev.text)) return <span className="g-float stun">¡Aturdido!</span>;
  return null;
}

/** Pantalla de combate por turnos, al estilo de los juegos de Pokémon. */
export function BattleView({ battle, onAction, onDone }: { battle: Battle; onAction: (a: Action) => void; onDone: () => void }) {
  const [shown, setShown] = useState(battle.log.length);
  const [switching, setSwitching] = useState(false);
  const busy = shown < battle.log.length;

  // Los pasos del turno aparecen uno a uno; un toque en el cuadro los enseña todos.
  useEffect(() => {
    setShown(1);
    setSwitching(false);
  }, [battle]);
  useEffect(() => {
    if (shown >= battle.log.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), STEP_MS[battle.log[shown - 1]?.kind ?? "status"]);
    return () => clearTimeout(t);
  }, [shown, battle.log]);

  const ev = battle.log[Math.max(0, Math.min(shown, battle.log.length) - 1)];
  const snap = ev?.snap ?? { a: battle.a, b: battle.b, ha: battle.mine[battle.a].hp, hb: battle.theirs[battle.b].hp, sa: 0, sb: 0 };
  const me = battle.mine[busy ? snap.a : battle.a];
  const foe = battle.theirs[busy ? snap.b : battle.b];
  const hpMe = busy ? snap.ha : me.hp;
  const hpFoe = busy ? snap.hb : foe.hp;
  // Animación del paso actual: quién embiste y quién recibe.
  const anim = (side: 0 | 1) => {
    if (!ev || !busy) return "";
    if (ev.kind === "move" && ev.side === side) return side === 0 ? "lunge-me" : "lunge-foe";
    if (ev.kind === "hit" && ev.side === side) return ev.crit ? "hurt crit" : "hurt";
    if (ev.kind === "heal" && ev.side === side) return "glow-heal";
    if (ev.kind === "shield" && ev.side === side) return "glow-shield";
    if (ev.kind === "miss" && ev.side === side) return "dodge";
    if (ev.kind === "switch" && ev.side === side) return "enter";
    return "";
  };

  const listOpen = battle.mustSwitch || switching;
  const foeCls = foe.champ.tags.includes("Monster") ? null : foe.champ.cls;
  const canSwitch = battle.mine.filter((f) => f.hp > 0).length >= 2;

  // Teclado: Q W E R para las habilidades, A para el ataque básico, C para
  // cambiar (1-5 eligen) y Espacio o Intro para pasar el texto o continuar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      const skip = k === " " || k === "enter";
      if (busy) {
        if (skip || "qwerac".includes(k)) {
          e.preventDefault();
          setShown(battle.log.length);
        }
        return;
      }
      if (battle.result) {
        if (skip) {
          e.preventDefault();
          onDone();
        }
        return;
      }
      if (listOpen) {
        const i = Number(k) - 1;
        const f = battle.mine[i];
        if (f && f.hp > 0 && i !== battle.a) onAction({ type: "switch", to: i });
        else if (k === "escape" && !battle.mustSwitch) setSwitching(false);
        return;
      }
      const key = k === "a" ? "A" : k.length === 1 && "qwer".includes(k) ? k.toUpperCase() : null;
      if (key) {
        const m = movesOf(me.champ).find((x) => x.key === key);
        if (m && !(me.cd[m.key] ?? 0)) {
          e.preventDefault();
          onAction({ type: "move", key: m.key });
        }
      } else if (k === "c" && canSwitch) setSwitching(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [battle, busy, listOpen, me, canSwitch, onAction, onDone]);
  const arena = battle.kind === "boss" ? "nexo" : battle.kind === "objective" ? "foso" : "jungla";

  return (
    <div className={`g-battle card${battle.kind === "boss" ? " boss" : ""}`}>
      <div className="g-foe-tag px-small">
        {battle.kind === "boss" ? "JEFE · " : ""}
        {battle.foe.name}
        {battle.foe.team && battle.kind !== "boss" ? ` (${battle.foe.team})` : ""}
        <Balls fs={battle.theirs} active={battle.b} />
      </div>
      <div className={`g-field arena-${arena}`}>
        <div className="g-row foe">
          <Info f={foe} hp={hpFoe} shield={busy ? snap.sb : foe.shield} showStatus={!busy} />
          <div className={`g-sprite foe${hpFoe <= 0 ? " down" : ""}`}>
            <span className="g-plat" />
            <span key={`f${shown}`} className={`g-anim ${anim(1)}`}>
              <Portrait champ={foe.champ} size={foe.champ.tags.includes("Monster") ? 150 : 120} side="foe" />
              {ev && busy && ev.side === 1 ? <Float ev={ev} /> : null}
            </span>
          </div>
        </div>
        <div className="g-row me">
          <div className={`g-sprite me${hpMe <= 0 ? " down" : ""}`}>
            <span className="g-plat" />
            <span key={`m${shown}`} className={`g-anim ${anim(0)}`}>
              <Portrait champ={me.champ} size={132} side="me" />
              {ev && busy && ev.side === 0 ? <Float ev={ev} /> : null}
            </span>
          </div>
          <Info f={me} hp={hpMe} shield={busy ? snap.sa : me.shield} mine showStatus={!busy} />
        </div>
      </div>

      <button type="button" className="g-dialog card" onClick={() => setShown(battle.log.length)} aria-live="polite">
        {battle.log.slice(Math.max(0, shown - 3), shown).map((l, i) => (
          <span key={`${shown}-${i}`} className={l.kind === "move" ? "bold" : ""}>
            {l.text}
          </span>
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
                <span className="g-key kbd-only">{i + 1}</span>{" "}
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
            const cd = me.cd[m.key] ?? 0;
            const { dmg, tm } = estimate(battle, 0, m);
            const kills = dmg >= foe.hp + foe.shield;
            return (
              <button
                key={m.key}
                type="button"
                className={`g-move card${cd ? " cd" : ""}${m.key === "A" ? " basic" : ""}${m.key === "R" ? " ult" : ""}`}
                disabled={busy || cd > 0}
                onClick={() => onAction({ type: "move", key: m.key })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.icon ? <img src={m.icon} alt="" width={36} height={36} loading="lazy" /> : <PixelIcon name="fight" size={36} />}
                <span className="g-move-text">
                  <span className="g-move-name">
                    <span className="g-key">{m.key}</span> {m.name}
                  </span>
                  <span className="px-small muted g-move-note">{moveNote(m)}</span>
                  <span className="px-small g-move-dmg">
                    {cd ? (
                      <span className="muted">
                        Lista en {cd} {cd === 1 ? "turno" : "turnos"}
                      </span>
                    ) : dmg ? (
                      <>
                        ≈ {dmg} de daño{kills ? <b className="eff up"> · Lo remata</b> : null}
                        {tm > 1 ? <b className="eff up"> · Eficaz</b> : tm < 1 ? <b className="eff down"> · Poco eficaz</b> : null}
                      </>
                    ) : (
                      <span className="muted">Sin daño</span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
          <button type="button" className="btn sm g-switch-open" disabled={busy || !canSwitch} onClick={() => setSwitching(true)}>
            Cambiar <span className="kbd-only muted">(C)</span>
          </button>
          {foeCls ? (
            <span className="px-small muted g-matchup">
              {CLS_LABEL[me.champ.cls]} contra {CLS_LABEL[foeCls]}
            </span>
          ) : null}
          <span className="px-small muted g-keys-hint kbd-only">Teclado: Q W E R habilidades · A ataque básico · C cambiar · Espacio pasa el texto</span>
        </div>
      )}
    </div>
  );
}
