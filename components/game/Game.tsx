"use client";

// "Camino a la Copa": las pantallas de la partida. El estado vive aquí (la
// partida y la pantalla actual) y todas las reglas están en lib/game/engine.

import { useEffect, useState } from "react";
import { PixelImg } from "@/components/PixelImg";
import { TeamLogo } from "@/components/TeamLogo";
import { BattleView } from "@/components/game/BattleView";
import { MapView } from "@/components/game/MapView";
import { ShopView } from "@/components/game/ShopView";
import { TeamBar } from "@/components/game/TeamBar";
import { ChampSprite, Hp, PixelIcon, StatLine, TypeBadge } from "@/components/game/parts";
import { drawCard, resultLine, shareText, toBlob, xIntent } from "@/components/game/share";
import {
  MAX_TEAM,
  ROLE_LABEL,
  ROLE_PERK,
  STAGES,
  addUnit,
  bossTeam,
  buy,
  captureOptions,
  derive,
  finishBattle,
  healAll,
  monsterSide,
  movesOf,
  newRun,
  nextStage,
  playTurn,
  randomEvent,
  rivalTrainer,
  score,
  shopStock,
  stageLevel,
  startBattle,
  trainerOptions,
  type Action,
  type Battle,
  type GameEvent,
  type Run,
  type Unit,
} from "@/lib/game/engine";
import type { GameData, GItem, GPlayer } from "@/lib/game/types";

type Screen =
  | { s: "title" }
  | { s: "trainer"; options: GPlayer[]; rerolls: number }
  | { s: "starter"; trainer: GPlayer }
  | { s: "map" }
  | { s: "battle"; battle: Battle }
  | { s: "reward"; battle: Battle; gold: number; levels: number; reward?: string }
  | { s: "shop"; stock: GItem[]; msg?: string }
  | { s: "event"; ev: GameEvent; result?: string }
  | { s: "fountain" }
  | { s: "stageClear"; from: number }
  | { s: "end" };

const fmt = (n: number) => n.toLocaleString("es-ES");

export function Game({ data }: { data: GameData }) {
  const [screen, setScreen] = useState<Screen>({ s: "title" });
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen.s]);

  if (data.players.length < 3 || !Object.keys(data.champions).length) {
    return (
      <div className="g-wrap">
        <h1 className="screen-title">Camino a la Copa</h1>
        <div className="dialog card" style={{ marginTop: 24 }}>
          Ahora mismo no se pueden cargar los jugadores del torneo. Vuelve a probar en un rato.
        </div>
      </div>
    );
  }

  const go = (s: Screen) => setScreen(s);

  /* ---------- Inicio ---------- */

  if (screen.s === "title" || !run) {
    if (screen.s === "trainer")
      return (
        <div className="g-wrap">
          <h1 className="screen-title">Elige a tu entrenador</h1>
          <p className="screen-subtitle">Cada jugador trae su pool de campeones y una ventaja según su rol</p>
          <div className="g-trainers">
            {screen.options.map((p) => (
              <TrainerCard key={p.id} p={p} data={data} onPick={() => go({ s: "starter", trainer: p })} />
            ))}
          </div>
          <div className="g-actions-row">
            <button type="button" className="btn" disabled={!screen.rerolls} onClick={() => go({ s: "trainer", options: trainerOptions(data), rerolls: screen.rerolls - 1 })}>
              Otros tres ({screen.rerolls})
            </button>
          </div>
        </div>
      );
    if (screen.s === "starter") {
      const t = screen.trainer;
      return (
        <div className="g-wrap">
          <h1 className="screen-title">¿Con quién empieza {t.name}?</h1>
          <p className="screen-subtitle">Tres campeones de su pool. El resto se ficha por el camino</p>
          <div className="g-starters">
            {t.pool.slice(0, 3).map((c) => (
              <StarterCard
                key={c}
                id={c}
                trainer={t}
                data={data}
                onPick={() => {
                  setRun(newRun(t, c, data));
                  go({ s: "map" });
                }}
              />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="g-wrap g-title">
        <h1 className="screen-title g-big">Camino a la Copa</h1>
        <p className="screen-subtitle">Un roguelike de los Worlds 2026</p>
        <div className="g-title-art" aria-hidden>
          {data.players
            .filter((p) => p.pool[0])
            .slice(0, 5)
            .map((p) => (
              <ChampSprite key={p.id} champ={data.champions[p.pool[0]]} size={56} />
            ))}
        </div>
        <div className="dialog card">
          Elige a un jugador de los Worlds como entrenador y empieza con un campeón de su pool. Recorre la Grieta desde el
          Play-In hasta la final de Nueva York: combate, ficha campeones rivales, compra objetos y vence a los equipos jefe.
          <span className="next">▼</span>
        </div>
        <div className="g-actions-row">
          <button type="button" className="btn g-start" onClick={() => go({ s: "trainer", options: trainerOptions(data), rerolls: 2 })}>
            Empezar
          </button>
        </div>
      </div>
    );
  }

  /* ---------- Partida ---------- */

  const enter = (row: number, col: number) => {
    const r: Run = structuredClone(run);
    r.row = row;
    r.col = col;
    const node = r.maps[r.stage].rows[row][col];
    node.done = true;
    if (node.kind === "fight") go({ s: "battle", battle: startBattle(r, data, "fight", rivalTrainer(r, data)) });
    else if (node.kind === "boss") go({ s: "battle", battle: startBattle(r, data, "boss", bossTeam(r, data)) });
    else if (node.kind === "objective" && node.monster) go({ s: "battle", battle: startBattle(r, data, "objective", monsterSide(node.monster, r, data), node.monster) });
    else if (node.kind === "shop") go({ s: "shop", stock: shopStock(data, r.stage) });
    else if (node.kind === "fountain") {
      healAll(r, data);
      go({ s: "fountain" });
    } else {
      const ev = randomEvent(r, data);
      go({ s: "event", ev, result: ev.choice ? undefined : ev.apply(r, data) });
    }
    setRun(r);
  };

  const afterReward = (battle: Battle, r: Run) => {
    if (battle.kind !== "boss") return go({ s: "map" });
    const from = r.stage;
    const n = nextStage(r, data);
    setRun(n);
    go(n.over ? { s: "end" } : { s: "stageClear", from });
  };

  let body: React.ReactNode = null;

  if (screen.s === "map") {
    body = (
      <>
        <MapView run={run} onEnter={enter} />
        <TeamBar run={run} data={data} />
      </>
    );
  } else if (screen.s === "battle") {
    body = (
      <BattleView
        battle={screen.battle}
        onAction={(a: Action) => go({ s: "battle", battle: playTurn(screen.battle, a, run) })}
        onDone={() => {
          const res = finishBattle(run, screen.battle, data);
          setRun(res.run);
          go(res.run.over ? { s: "end" } : { s: "reward", battle: screen.battle, gold: res.gold, levels: res.levels, reward: res.reward });
        }}
      />
    );
  } else if (screen.s === "reward") {
    body = <Reward run={run} data={data} screen={screen} onDone={(r) => (setRun(r), afterReward(screen.battle, r))} />;
  } else if (screen.s === "shop") {
    body = (
      <ShopView
        run={run}
        data={data}
        stock={screen.stock}
        msg={screen.msg}
        onLeave={() => go({ s: "map" })}
        onBuy={(item, u) => {
          if (run.gold < item.gold) return go({ ...screen, msg: "No te llega el oro." });
          const res = buy(run, item, u.uid, data);
          if (!res) return go({ ...screen, msg: `${data.champions[u.champ].name} no tiene hueco para eso.` });
          setRun(res.run);
          go({ s: "shop", stock: item.kind === "potion" ? screen.stock : screen.stock.filter((x) => x !== item), msg: res.text });
        }}
      />
    );
  } else if (screen.s === "event") {
    const { ev, result } = screen;
    body = (
      <div className="g-event card">
        <PixelIcon name="event" size={40} />
        <h2 className="px-title g-event-title">{ev.title}</h2>
        <p>{ev.text}</p>
        {result ? <p className="bold g-event-result">{result}</p> : null}
        <div className="g-actions-row">
          {!result && ev.choice ? (
            <>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const r: Run = structuredClone(run);
                  const text = ev.apply(r, data);
                  setRun(r);
                  go({ s: "event", ev, result: text });
                }}
              >
                {ev.choice.yes}
              </button>
              <button type="button" className="btn" onClick={() => go({ s: "event", ev, result: "Lo dejas como está." })}>
                {ev.choice.no}
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => go({ s: "map" })}>
              Continuar
            </button>
          )}
        </div>
        <TeamBar run={run} data={data} />
      </div>
    );
  } else if (screen.s === "fountain") {
    body = (
      <div className="g-event card">
        <PixelIcon name="fountain" size={40} />
        <h2 className="px-title g-event-title">Fuente</h2>
        <p>Vuelves a la base. La fuente cura del todo a tu equipo.</p>
        <TeamBar run={run} data={data} />
        <div className="g-actions-row">
          <button type="button" className="btn" onClick={() => go({ s: "map" })}>
            Continuar
          </button>
        </div>
      </div>
    );
  } else if (screen.s === "stageClear") {
    const now = STAGES[run.stage];
    body = (
      <div className="g-event card">
        <PixelIcon name="boss" size={40} />
        <h2 className="px-title g-event-title">¡{STAGES[screen.from].name} superado!</h2>
        <p>
          Siguiente parada: <span className="bold">{now.name}</span> en {now.city}. El equipo descansa y llega con la vida al máximo.
        </p>
        <div className="g-stages big" aria-hidden>
          {STAGES.map((s, i) => (
            <span key={s.name} className={`g-pip${i < run.stage ? " done" : i === run.stage ? " now" : ""}`} />
          ))}
        </div>
        <div className="g-actions-row">
          <button type="button" className="btn" onClick={() => go({ s: "map" })}>
            Continuar
          </button>
        </div>
      </div>
    );
  } else if (screen.s === "end") {
    body = (
      <End
        run={run}
        data={data}
        onAgain={() => {
          setRun(null);
          go({ s: "trainer", options: trainerOptions(data), rerolls: 2 });
        }}
      />
    );
  }

  return (
    <div className="g-wrap">
      {screen.s !== "end" ? <Hud run={run} data={data} /> : null}
      {body}
    </div>
  );
}

/* ---------- Piezas de pantalla ---------- */

function Hud({ run, data }: { run: Run; data: GameData }) {
  const t = run.trainer;
  const team = data.teams.find((x) => x.code === t.team);
  return (
    <div className="g-hud card">
      <div className="g-hud-who">
        {t.image ? <PixelImg src={t.image} alt={t.name} size={40} res={24} /> : <TeamLogo code={t.team} image={team?.image ?? ""} size={40} />}
        <div>
          <div className="bold">
            {t.name} <span className="muted">{t.team}</span>
          </div>
          <span className={`role ${t.role}`}>{ROLE_LABEL[t.role]}</span>
        </div>
      </div>
      <div className="g-hud-stats px-small">
        <span title="Oro" className="g-gold">
          {fmt(run.gold)} oro
        </span>
        {run.dragons ? <span title="Dragones">Dragón ×{run.dragons}</span> : null}
        {run.baron ? <span title="Mano del Barón">Barón</span> : null}
        <span title="Puntos">{fmt(score(run))} pts</span>
      </div>
    </div>
  );
}

function TrainerCard({ p, data, onPick }: { p: GPlayer; data: GameData; onPick: () => void }) {
  const team = data.teams.find((t) => t.code === p.team);
  return (
    <button type="button" className="g-trainer card" onClick={onPick}>
      <span className="g-trainer-photo">{p.image ? <PixelImg src={p.image} alt={p.name} size={96} res={32} /> : <TeamLogo code={p.team} image={team?.image ?? ""} size={72} />}</span>
      <span className="g-trainer-name bold">{p.name}</span>
      <span className="g-trainer-team">
        <TeamLogo code={p.team} image={team?.image ?? ""} size={18} /> {team?.name ?? p.team}
      </span>
      <span className={`role ${p.role}`}>{ROLE_LABEL[p.role]}</span>
      <span className="g-perk">{ROLE_PERK[p.role]}</span>
      <span className="g-pool">
        {p.pool.slice(0, 6).map((c) => (data.champions[c] ? <ChampSprite key={c} champ={data.champions[c]} size={30} /> : null))}
      </span>
    </button>
  );
}

function StarterCard({ id, trainer, data, onPick }: { id: string; trainer: GPlayer; data: GameData; onPick: () => void }) {
  const c = data.champions[id];
  const d = derive(c, stageLevel(0), [], data, { role: trainer.role });
  return (
    <div className="g-starter card">
      <ChampSprite champ={c} size={88} res={30} />
      <div className="g-starter-name bold">{c.name}</div>
      <div className="px-small muted">{c.title}</div>
      <div className="g-starter-type">
        <TypeBadge cls={c.cls} /> <span className="px-small muted">{c.magic ? "Mágico" : "Físico"}</span>
      </div>
      <Hp hp={d.hp} max={d.hp} />
      <StatLine d={d} magic={c.magic} />
      <ul className="g-moves-list">
        {movesOf(c).map((m) => (
          <li key={m.key}>
            <span className="g-key">{m.key}</span> {m.name} <span className="muted">· {m.note}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={onPick}>
        ¡Te elijo!
      </button>
    </div>
  );
}

function Reward({ run, data, screen, onDone }: { run: Run; data: GameData; screen: Extract<Screen, { s: "reward" }>; onDone: (r: Run) => void }) {
  const [replacing, setReplacing] = useState<Unit | null>(null);
  const { battle, gold, levels, reward } = screen;
  const captures = captureOptions(battle).filter((u) => !run.team.some((m) => m.champ === u.champ));
  const title = battle.kind === "boss" ? `¡Has eliminado a ${battle.foe.name}!` : battle.kind === "objective" ? `¡${battle.foe.name} es tuyo!` : "¡Victoria!";
  return (
    <div className="g-event card">
      <h2 className="px-title g-event-title">{title}</h2>
      <p>
        {gold ? `+${fmt(gold)} de oro · ` : ""}+{levels} {levels === 1 ? "nivel" : "niveles"} para todo el equipo
      </p>
      {reward ? <p className="bold">{reward}</p> : null}
      {replacing ? (
        <>
          <p className="px-small g-switch-title">¿Quién deja su sitio a {data.champions[replacing.champ].name}?</p>
          <TeamBar run={run} data={data} pickLabel="Sustituir" onPick={(u) => onDone(addUnit(run, replacing, data, u.uid))} />
          <div className="g-actions-row">
            <button type="button" className="btn sm" onClick={() => setReplacing(null)}>
              Volver
            </button>
          </div>
        </>
      ) : captures.length ? (
        <>
          <p className="px-small g-switch-title">Ficha a un campeón de {battle.foe.name}</p>
          <div className="g-captures">
            {captures.map((u) => {
              const c = data.champions[u.champ];
              return (
                <button key={u.uid} type="button" className="g-capture card" onClick={() => (run.team.length < MAX_TEAM ? onDone(addUnit(run, u, data)) : setReplacing(u))}>
                  <ChampSprite champ={c} size={56} />
                  <span className="bold">{c.name}</span>
                  <TypeBadge cls={c.cls} />
                  <span className="g-lv">Nv {Math.max(1, u.level - 1)}</span>
                </button>
              );
            })}
          </div>
          {run.team.length >= MAX_TEAM ? <p className="px-small muted">Tu equipo está lleno: si fichas, eliges a quién sustituye.</p> : null}
        </>
      ) : null}
      {!replacing ? (
        <div className="g-actions-row">
          <button type="button" className="btn" onClick={() => onDone(run)}>
            {captures.length ? "No fichar a nadie" : "Continuar"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function End({ run, data, onAgain }: { run: Run; data: GameData; onAgain: () => void }) {
  const [img, setImg] = useState<{ url: string; blob: Blob | null } | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    drawCard(run, data)
      .then(async (canvas) => {
        const blob = await toBlob(canvas).catch(() => null);
        if (alive) setImg({ url: canvas.toDataURL("image/png"), blob });
      })
      .catch(() => alive && setNote("No se ha podido generar la imagen."));
    return () => {
      alive = false;
    };
  }, [run, data]);

  const share = async () => {
    const url = `${location.origin}/jugar`;
    const file = img?.blob ? new File([img.blob], "camino-a-la-copa.png", { type: "image/png" }) : null;
    try {
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `${shareText(run)} ${url}` });
      else if (navigator.share) await navigator.share({ text: shareText(run), url });
      else {
        await navigator.clipboard.writeText(`${shareText(run)} ${url}`);
        setNote("Texto copiado. Descarga la imagen y súbela donde quieras.");
      }
    } catch {
      /* compartir cancelado */
    }
  };

  const champion = run.over === "champion";
  return (
    <div className="g-end">
      <h1 className={`screen-title g-big${champion ? " gold" : ""}`}>{resultLine(run)}</h1>
      <div className="g-end-grid">
        <div className="g-card-preview card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img src={img.url} alt="Tu tarjeta de Camino a la Copa" /> : <span className="px-small muted">{note || "Dibujando tu tarjeta…"}</span>}
        </div>
        <div className="g-end-side">
          <div className="g-score card">
            <div className="px-small muted">Puntos</div>
            <div className="g-score-num">{fmt(score(run))}</div>
            <ul className="px-small">
              <li>
                Combates ganados: {run.wins} × 100
              </li>
              <li>
                Objetivos: {run.objectives} × 300
              </li>
              <li>
                Jefes: {run.bosses} × 1.000
              </li>
              <li>Oro sobrante: {fmt(Math.floor(run.gold / 10))}</li>
              {champion ? <li>Campeón del mundo: 5.000</li> : null}
            </ul>
          </div>
          <div className="g-share">
            <button type="button" className="btn" onClick={share} disabled={!img}>
              Compartir
            </button>
            <a className="btn" href={xIntent(run, typeof location !== "undefined" ? `${location.origin}/jugar` : "https://worlddex.lol/jugar")} target="_blank" rel="noopener noreferrer">
              Publicar en X
            </a>
            <a className={`btn${img ? "" : " off"}`} href={img?.url} download="camino-a-la-copa.png" aria-disabled={!img}>
              Descargar imagen
            </a>
            <button type="button" className="btn" onClick={onAgain}>
              Jugar otra vez
            </button>
          </div>
          {note && img ? <p className="px-small muted">{note}</p> : null}
          <p className="px-small muted">Para Instagram o TikTok, comparte desde el móvil o descarga la imagen y súbela desde la app.</p>
        </div>
      </div>
      <TeamBar run={run} data={data} />
    </div>
  );
}
