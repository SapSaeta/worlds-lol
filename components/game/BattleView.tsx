"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { ChampSprite, Hp, PixelIcon, Portrait, TypeBadge } from "@/components/game/parts";
import {
  CLS_LABEL,
  allyMove,
  battleMoves,
  bench,
  estimate,
  moveNote,
  type Action,
  type BEvent,
  type Battle,
  type Fighter,
  type Move,
  type MoveKey,
  type Order,
} from "@/lib/game/engine";

/** Lo que tarda cada paso del turno, para que se vean los golpes. */
const STEP_MS: Record<BEvent["kind"], number> = { intro: 700, move: 520, hit: 720, miss: 620, heal: 620, shield: 560, status: 620, ko: 820, switch: 620, end: 500 };

const STATUS_LABEL: [keyof Fighter["st"], string, string][] = [
  ["stun", "Aturdido", "Stunned"],
  ["slow", "Ralentizado", "Slowed"],
  ["haste", "Rápido", "Fast"],
  ["buff", "Potenciado", "Empowered"],
  ["guard", "Protegido", "Guarded"],
  ["evade", "Esquiva", "Evasive"],
  ["peel", "Protegiendo", "Peeling"],
];

function Info({ f, hp, shield, mine, showStatus, turn }: { f: Fighter; hp: number; shield: number; mine?: boolean; showStatus: boolean; turn?: boolean }) {
  const monster = f.champ.tags.includes("Monster");
  const { t } = useLocale();
  return (
    <div className={`g-info card${mine ? " mine" : ""}${turn ? " turn" : ""}`}>
      <div className="g-info-name">
        <span className="bold">{f.champ.name}</span>
        <span className="g-lv">
          {t("Nv", "Lv")} {f.unit.level}
        </span>
      </div>
      <div className="g-info-tags">
        <TypeBadge cls={monster ? "Monster" : f.champ.cls} />
        {showStatus
          ? STATUS_LABEL.filter(([k]) => f.st[k] > 0).map(([k, es, en]) => (
              <span key={k} className={`g-status s-${k}`}>
                {t(es, en)}
              </span>
            ))
          : null}
      </div>
      <Hp hp={hp} max={f.max.hp} shield={shield} showNumbers={!!mine} />
    </div>
  );
}

function Balls({ fs, active }: { fs: Fighter[]; active: number[] }) {
  return (
    <span className="g-balls" aria-hidden>
      {fs.map((f, i) => (
        <i key={f.unit.uid} className={f.hp <= 0 ? "ko" : active.includes(i) ? "now" : ""} />
      ))}
    </span>
  );
}

/** Número que sale flotando sobre el campeón: daño, cura o esquiva. */
function Float({ ev }: { ev: BEvent }) {
  const { t } = useLocale();
  if (ev.kind === "hit" && ev.amount) return <span className={`g-float dmg${ev.crit ? " crit" : ""}`}>-{ev.amount}</span>;
  if (ev.kind === "heal" && ev.amount) return <span className="g-float heal">+{ev.amount}</span>;
  if (ev.kind === "miss") return <span className="g-float miss">{t("¡Esquiva!", "Dodged!")}</span>;
  if (ev.kind === "status" && /aturdido!|is stunned!/.test(ev.text)) return <span className="g-float stun">{t("¡Aturdido!", "Stunned!")}</span>;
  return null;
}

/** Pantalla de combate por turnos, al estilo de los juegos de Pokémon. En 2v2, das una orden a cada campeón. */
export function BattleView({ battle, onAction, onDone }: { battle: Battle; onAction: (a: Action) => void; onDone: () => void }) {
  const { t } = useLocale();
  const [shown, setShown] = useState(battle.log.length);
  const [switching, setSwitching] = useState(false);
  /** Órdenes ya dadas este turno, por hueco (2v2) */
  const [draft, setDraft] = useState<(Order | undefined)[]>([]);
  /** Movimiento elegido que espera objetivo */
  const [aiming, setAiming] = useState<Move | null>(null);
  const busy = shown < battle.log.length;

  // Los pasos del turno aparecen uno a uno; un toque en el cuadro los enseña todos.
  useEffect(() => {
    setShown(1);
    setSwitching(false);
    setDraft([]);
    setAiming(null);
  }, [battle]);
  useEffect(() => {
    if (shown >= battle.log.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), STEP_MS[battle.log[shown - 1]?.kind ?? "status"]);
    return () => clearTimeout(t);
  }, [shown, battle.log]);

  const ev = battle.log[Math.max(0, Math.min(shown, battle.log.length) - 1)];
  const live = { on: battle.on, hp: [battle.mine.map((f) => f.hp), battle.theirs.map((f) => f.hp)], sh: [battle.mine.map((f) => f.shield), battle.theirs.map((f) => f.shield)] };
  const snap = busy && ev ? ev.snap : live;
  const fs = (side: 0 | 1) => (side === 0 ? battle.mine : battle.theirs);
  // Huecos del campo: en 1v1 uno por lado; en 2v2, dos.
  const field = (side: 0 | 1) => snap.on[side].map((k, s) => ({ k, s })).filter(({ k }) => k >= 0);

  // Hueco tuyo al que toca dar orden: el primero en pie sin orden.
  const mySlots = battle.on[0].map((k, s) => ({ k, s })).filter(({ k }) => k >= 0 && battle.mine[k].hp > 0);
  const cur = mySlots.find(({ s }) => !draft[s]) ?? mySlots[0];
  const me: Fighter | undefined = cur ? battle.mine[cur.k] : undefined;
  const foes = battle.on[1].map((k, s) => ({ k, s })).filter(({ k }) => k >= 0 && battle.theirs[k].hp > 0);
  const mates = mySlots;
  const ordered = mySlots.filter(({ s }) => draft[s]).length;

  // Animación del paso actual: quién embiste y quién recibe.
  const anim = (side: 0 | 1, who: number) => {
    if (!ev || !busy || ev.side !== side || (ev.who !== undefined && ev.who !== who)) return "";
    if (ev.kind === "move") return side === 0 ? "lunge-me" : "lunge-foe";
    if (ev.kind === "hit") return ev.crit ? "hurt crit" : "hurt";
    if (ev.kind === "heal") return "glow-heal";
    if (ev.kind === "shield") return "glow-shield";
    if (ev.kind === "miss") return "dodge";
    if (ev.kind === "switch") return "enter";
    return "";
  };

  const listOpen = battle.mustSwitch || switching;
  const taken = new Set(draft.filter((o): o is Extract<Order, { type: "switch" }> => o?.type === "switch").map((o) => o.to));
  const reserves = bench(battle, 0).filter((i) => !taken.has(i));
  const canSwitch = reserves.length > 0;

  /** Guarda la orden del campeón actual; con todas, se juega el turno. */
  const give = (o: Order) => {
    setAiming(null);
    setSwitching(false);
    if (!battle.duo || !cur) return onAction(o);
    const next = [...draft];
    next[cur.s] = o;
    if (mySlots.every(({ s }) => next[s])) onAction({ type: "duo", orders: battle.on[0].map((_, s) => next[s] ?? { type: "move", key: "A" }) });
    else setDraft(next);
  };
  const undo = () => {
    const last = [...mySlots].reverse().find(({ s }) => draft[s]);
    if (!last) return;
    const next = [...draft];
    next[last.s] = undefined;
    setDraft(next);
    setAiming(null);
  };
  /** A quién puede ir un movimiento: rivales si hace daño, aliados si es de apoyo (2v2). */
  const aims = (m: Move) => {
    if (m.fx.includes("peel")) return [];
    if (m.power > 0) return m.area ? [] : foes;
    return battle.duo && allyMove(m) ? mates : [];
  };
  const choose = (m: Move) => {
    const opts = aims(m);
    if (opts.length > 1) return setAiming(m);
    give({ type: "move", key: m.key, target: opts[0]?.s });
  };
  const canPeel = mates.length > 1;
  const usable = (m: Move) => !!me && !(me.cd[m.key] ?? 0) && (!m.fx.includes("peel") || canPeel);

  // Teclado: Q W E R para las habilidades, A para el ataque básico, P para
  // proteger (2v2), C para cambiar (1-5 eligen), 1-2 eligen objetivo y
  // Espacio o Intro para pasar el texto o continuar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      const skip = k === " " || k === "enter";
      if (busy) {
        if (skip || "qwerapc".includes(k)) {
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
        if (f && battle.mustSwitch && bench(battle, 0).includes(i)) onAction({ type: "switch", to: i });
        else if (f && reserves.includes(i)) give({ type: "switch", to: i });
        else if (k === "escape" && !battle.mustSwitch) setSwitching(false);
        return;
      }
      if (aiming) {
        const opt = aims(aiming)[Number(k) - 1];
        if (opt) give({ type: "move", key: aiming.key, target: opt.s });
        else if (k === "escape" || k === "backspace") setAiming(null);
        return;
      }
      if ((k === "escape" || k === "backspace") && ordered) return undo();
      const key = k === "a" ? "A" : k === "p" ? "P" : k.length === 1 && "qwer".includes(k) ? k.toUpperCase() : null;
      if (key && me) {
        const m = battleMoves(battle, me).find((x) => x.key === (key as MoveKey));
        if (m && usable(m)) {
          e.preventDefault();
          choose(m);
        }
      } else if (k === "c" && canSwitch) setSwitching(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const arena = battle.kind === "boss" ? "nexo" : battle.kind === "objective" ? "foso" : "jungla";
  const duo = battle.duo;
  const sprite = (side: 0 | 1) =>
    field(side).map(({ k, s }) => {
      const f = fs(side)[k];
      const hp = snap.hp[side][k];
      const monster = f.champ.tags.includes("Monster");
      const size = side === 1 ? (monster ? (duo ? 132 : 150) : duo ? 96 : 120) : duo ? 104 : 132;
      return (
        <div key={`${s}-${k}`} className={`g-sprite ${side === 0 ? "me" : "foe"}${hp <= 0 ? " down" : ""}${side === 0 && !busy && cur?.k === k && duo && !listOpen ? " turn" : ""}`}>
          <span className="g-plat" />
          <span key={`${side}${k}${shown}`} className={`g-anim ${anim(side, k)}`}>
            <Portrait champ={f.champ} size={size} side={side === 0 ? "me" : "foe"} />
            {ev && busy && ev.side === side && (ev.who === undefined || ev.who === k) ? <Float ev={ev} /> : null}
          </span>
        </div>
      );
    });
  const infos = (side: 0 | 1) =>
    field(side).map(({ k, s }) => (
      <Info
        key={`${s}-${k}`}
        f={fs(side)[k]}
        hp={snap.hp[side][k]}
        shield={snap.sh[side][k]}
        mine={side === 0}
        showStatus={!busy}
        turn={side === 0 && duo && !busy && !listOpen && cur?.k === k}
      />
    ));

  const foeCls = foes[0] && !battle.theirs[foes[0].k].champ.tags.includes("Monster") ? battle.theirs[foes[0].k].champ.cls : null;

  return (
    <div className={`g-battle card${battle.kind === "boss" ? " boss" : ""}`}>
      <div className="g-foe-tag px-small">
        {battle.kind === "boss" ? t("JEFE · ", "BOSS · ") : ""}
        {battle.foe.name}
        {battle.foe.team && battle.kind !== "boss" ? ` (${battle.foe.team})` : ""}
        <Balls fs={battle.theirs} active={battle.on[1]} />
        {duo ? <span className="g-duo-tag">2v2</span> : null}
      </div>
      <div className={`g-field arena-${arena}${duo ? " duo" : ""}`}>
        <div className="g-row foe">
          <div className="g-infos">{infos(1)}</div>
          <div className="g-sprites">{sprite(1)}</div>
        </div>
        <div className="g-row me">
          <div className="g-sprites">{sprite(0)}</div>
          <div className="g-infos">{infos(0)}</div>
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
            {t("Continuar", "Continue")}
          </button>
        </div>
      ) : listOpen ? (
        <div className="g-switch">
          <div className="px-small g-switch-title">
            {battle.mustSwitch ? t("¿A quién sacas?", "Who do you send out?") : duo && me ? t(`¿Quién entra por ${me.champ.name}?`, `Who comes in for ${me.champ.name}?`) : t("Cambiar de campeón", "Switch champion")}
          </div>
          {battle.mine.map((f, i) => {
            const ok = battle.mustSwitch ? bench(battle, 0).includes(i) : reserves.includes(i);
            return (
              <button
                key={f.unit.uid}
                type="button"
                className="g-switch-btn card"
                disabled={busy || !ok}
                onClick={() => (battle.mustSwitch ? onAction({ type: "switch", to: i }) : give({ type: "switch", to: i }))}
              >
                <ChampSprite champ={f.champ} size={32} />
                <span className="g-switch-name">
                  <span className="g-key kbd-only">{i + 1}</span>{" "}
                  {f.champ.name}{" "}
                  <span className="g-lv">
                    {t("Nv", "Lv")} {f.unit.level}
                  </span>
                  {battle.on[0].includes(i) && f.hp > 0 ? <span className="px-small muted"> · {t("en el campo", "on the field")}</span> : null}
                </span>
                <Hp hp={f.hp} max={f.max.hp} />
              </button>
            );
          })}
          {!battle.mustSwitch ? (
            <button type="button" className="btn sm" onClick={() => setSwitching(false)}>
              {t("Volver", "Back")}
            </button>
          ) : null}
        </div>
      ) : aiming && me ? (
        <div className="g-switch">
          <div className="px-small g-switch-title">
            {aiming.power > 0 ? t(`${aiming.name}: ¿a quién?`, `${aiming.name}: target?`) : t(`${aiming.name}: ¿sobre quién?`, `${aiming.name}: on whom?`)}
          </div>
          {aims(aiming).map(({ k, s }, n) => {
            const f = aiming.power > 0 ? battle.theirs[k] : battle.mine[k];
            const dmg = aiming.power > 0 ? estimate(battle, 0, cur!.k, aiming, s).dmg : 0;
            return (
              <button key={`${s}-${k}`} type="button" className="g-switch-btn card" onClick={() => give({ type: "move", key: aiming.key, target: s })}>
                <ChampSprite champ={f.champ} size={32} />
                <span className="g-switch-name">
                  <span className="g-key kbd-only">{n + 1}</span> {f.champ.name}
                  {k === cur!.k && aiming.power <= 0 ? <span className="px-small muted"> · {t("él mismo", "itself")}</span> : null}
                  {dmg ? <span className="px-small"> · ≈ {t(`${dmg} de daño`, `${dmg} damage`)}{dmg >= f.hp + f.shield ? <b className="eff up"> · {t("Lo remata", "Finishes it")}</b> : null}</span> : null}
                </span>
                <Hp hp={f.hp} max={f.max.hp} shield={f.shield} showNumbers={aiming.power <= 0} />
              </button>
            );
          })}
          <button type="button" className="btn sm" onClick={() => setAiming(null)}>
            {t("Volver", "Back")}
          </button>
        </div>
      ) : me ? (
        <div className="g-moves">
          {duo ? (
            <div className="px-small g-order-title">
              {t(`¿Qué hace ${me.champ.name}?`, `What will ${me.champ.name} do?`)} <span className="muted">({ordered + 1}/{mySlots.length})</span>
              {ordered ? (
                <button type="button" className="btn sm" onClick={undo}>
                  {t("Atrás", "Back")}
                </button>
              ) : null}
            </div>
          ) : null}
          {battleMoves(battle, me).map((m) => {
            const cd = me.cd[m.key] ?? 0;
            const peel = m.fx.includes("peel");
            const hits = m.power > 0 ? (m.area ? foes.slice(0, 1) : foes).map(({ k, s }) => ({ f: battle.theirs[k], ...estimate(battle, 0, cur!.k, m, s) })) : [];
            const dmg = hits.map((h) => h.dmg);
            const kills = hits.some((h) => h.dmg >= h.f.hp + h.f.shield) || (m.area && foes.every(({ k }) => estimate(battle, 0, cur!.k, m, battle.on[1].indexOf(k)).dmg >= battle.theirs[k].hp + battle.theirs[k].shield));
            const tm = hits[0]?.tm ?? 1;
            return (
              <button
                key={m.key}
                type="button"
                className={`g-move card${cd ? " cd" : ""}${m.key === "A" ? " basic" : ""}${m.key === "R" ? " ult" : ""}${peel ? " peel" : ""}`}
                disabled={busy || !usable(m)}
                onClick={() => choose(m)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.icon ? <img src={m.icon} alt="" width={36} height={36} loading="lazy" /> : <PixelIcon name={peel ? "shield" : "fight"} size={36} />}
                <span className="g-move-text">
                  <span className="g-move-name">
                    <span className="g-key">{m.key}</span> {m.name}
                  </span>
                  <span className="px-small muted g-move-note">{peel ? t("Recibe los golpes de tu compañero este turno", "Takes the hits aimed at your partner this turn") : moveNote(m)}</span>
                  <span className="px-small g-move-dmg">
                    {cd ? (
                      <span className="muted">{t(`Lista en ${cd} ${cd === 1 ? "turno" : "turnos"}`, `Ready in ${cd} ${cd === 1 ? "turn" : "turns"}`)}</span>
                    ) : dmg.length ? (
                      <>
                        ≈ {t(`${dmg.join(" / ")} de daño`, `${dmg.join(" / ")} damage`)}
                        {m.area && foes.length > 1 ? <span className="muted"> · {t("a todos", "to all")}</span> : null}
                        {kills ? <b className="eff up"> · {t("Lo remata", "Finishes it")}</b> : null}
                        {foes.length < 2 ? tm > 1 ? <b className="eff up"> · {t("Eficaz", "Effective")}</b> : tm < 1 ? <b className="eff down"> · {t("Poco eficaz", "Not effective")}</b> : null : null}
                      </>
                    ) : peel && !canPeel ? (
                      <span className="muted">{t("Sin compañero en el campo", "No partner on the field")}</span>
                    ) : (
                      <span className="muted">{duo && allyMove(m) ? t("Sin daño · elige aliado", "No damage · pick an ally") : t("Sin daño", "No damage")}</span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
          <button type="button" className="btn sm g-switch-open" disabled={busy || !canSwitch} onClick={() => setSwitching(true)}>
            {t("Cambiar", "Switch")} <span className="kbd-only muted">(C)</span>
          </button>
          {foeCls && !duo ? (
            <span className="px-small muted g-matchup">
              {CLS_LABEL[me.champ.cls]} {t("contra", "vs")} {CLS_LABEL[foeCls]}
            </span>
          ) : null}
          <span className="px-small muted g-keys-hint kbd-only">
            {duo
              ? t("Teclado: Q W E R habilidades · A ataque básico · P proteger · 1-2 objetivo · C cambiar · Retroceso deshace", "Keys: Q W E R abilities · A basic attack · P peel · 1-2 target · C switch · Backspace undoes")
              : t("Teclado: Q W E R habilidades · A ataque básico · C cambiar · Espacio pasa el texto", "Keys: Q W E R abilities · A basic attack · C switch · Space skips text")}
          </span>
        </div>
      ) : null}
    </div>
  );
}
