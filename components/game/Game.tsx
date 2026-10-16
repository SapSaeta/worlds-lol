"use client";

// "Camino a la Copa": las pantallas de la partida. El estado vive aquí (la
// partida y la pantalla actual) y todas las reglas están en lib/game/engine.

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { PixelImg } from "@/components/PixelImg";
import { TeamLogo } from "@/components/TeamLogo";
import { BattleView } from "@/components/game/BattleView";
import { MapView } from "@/components/game/MapView";
import { ShopView } from "@/components/game/ShopView";
import { TeamBar } from "@/components/game/TeamBar";
import { ChampSprite, Hp, PixelIcon, StatLine, TypeBadge } from "@/components/game/parts";
import { drawCard, resultLine, resultSub, resultUrl, shareText, stageStates, telegramLink, toBlob, whatsappLink, xIntent, type CardFormat } from "@/components/game/share";
import {
  DIFFICULTY,
  DRAKES,
  MAX_TEAM,
  MONSTERS,
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
  moveNote,
  movesOf,
  newRun,
  nextStage,
  playTurn,
  randomEvent,
  rivalTrainer,
  score,
  seedRandom,
  setGameLocale,
  shopStock,
  startBattle,
  trainerOptions,
  type Action,
  type Battle,
  type GameEvent,
  type Run,
  type Unit,
} from "@/lib/game/engine";
import { dailyNumber, dailySeed, freshSeed } from "@/lib/game/daily";
import type { GameData, GItem, GPlayer } from "@/lib/game/types";
import { fmtNum } from "@/lib/i18n";

/** Partida con semilla: el reto del día o el reto que te pasa un amigo. */
type Mode = { seed: number; daily?: number };

/** Lee un reto del enlace (/jugar?semilla=…&reto=…). */
function challengeFromUrl(): Mode | null {
  const q = new URLSearchParams(location.search);
  const seed = Math.floor(Number(q.get("semilla")));
  if (!seed || seed < 1 || seed > 2 ** 32 - 1) return null;
  const daily = Math.floor(Number(q.get("reto"))) || undefined;
  return { seed, daily: daily && daily > 0 && daily < 10000 ? daily : undefined };
}

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

/** Número con separador de miles en el idioma de la página. */
function useFmt() {
  const { locale } = useLocale();
  return (n: number) => fmtNum(locale, n);
}

export function Game({ data }: { data: GameData }) {
  const { locale, t } = useLocale();
  // Los textos del motor salen en el idioma de la página (solo en el navegador).
  if (typeof window !== "undefined") setGameLocale(locale);
  const [screen, setScreen] = useState<Screen>({ s: "title" });
  const [run, setRun] = useState<Run | null>(null);
  const [mode, setMode] = useState<Mode>({ seed: 0 });
  const [today, setToday] = useState(0);
  const [challenge, setChallenge] = useState<Mode | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen.s]);

  // Fecha y enlace solo en el navegador, para no desajustar el HTML del servidor.
  useEffect(() => {
    setToday(dailyNumber());
    setChallenge(challengeFromUrl());
  }, []);

  if (data.players.length < 3 || !Object.keys(data.champions).length) {
    return (
      <div className="g-wrap">
        <h1 className="screen-title">{t("Camino a la Copa", "Road to the Cup")}</h1>
        <div className="dialog card" style={{ marginTop: 24 }}>
          {t("Ahora mismo no se pueden cargar los jugadores del torneo. Vuelve a probar en un rato.", "The tournament players can't be loaded right now. Please try again in a while.")}
        </div>
      </div>
    );
  }

  const go = (s: Screen) => setScreen(s);

  /** Empieza una partida: con semilla fija (reto) o con una nueva (libre). */
  const start = (m: Mode) => {
    seedRandom(m.seed);
    setMode(m);
    setRun(null);
    go({ s: "trainer", options: trainerOptions(data), rerolls: 2 });
  };
  const daily = () => start({ seed: dailySeed(today || dailyNumber()), daily: today || dailyNumber() });
  const free = () => start({ seed: freshSeed() });

  /* ---------- Inicio ---------- */

  if (screen.s === "title" || !run) {
    if (screen.s === "trainer")
      return (
        <div className="g-wrap">
          <h1 className="screen-title">{t("Elige a tu entrenador", "Choose your trainer")}</h1>
          <p className="screen-subtitle">{t("Cada jugador trae su pool de campeones y una ventaja según su rol", "Each player brings their champion pool and a perk based on their role")}</p>
          <div className="g-trainers">
            {screen.options.map((p) => (
              <TrainerCard key={p.id} p={p} data={data} onPick={() => go({ s: "starter", trainer: p })} />
            ))}
          </div>
          <div className="g-actions-row">
            <button type="button" className="btn" disabled={!screen.rerolls} onClick={() => go({ s: "trainer", options: trainerOptions(data), rerolls: screen.rerolls - 1 })}>
              {t("Otros tres", "Three more")} ({screen.rerolls})
            </button>
          </div>
        </div>
      );
    if (screen.s === "starter") {
      const tr = screen.trainer;
      return (
        <div className="g-wrap">
          <h1 className="screen-title">{t(`¿Con quién empieza ${tr.name}?`, `Who does ${tr.name} start with?`)}</h1>
          <p className="screen-subtitle">{t("Tres campeones de su pool. El resto se ficha por el camino", "Three champions from their pool. You recruit the rest along the way")}</p>
          <div className="g-starters">
            {tr.pool.slice(0, 3).map((c) => (
              <StarterCard
                key={c}
                id={c}
                trainer={tr}
                data={data}
                onPick={() => {
                  setRun(newRun(tr, c, data, mode.seed, mode.daily));
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
        <h1 className="screen-title g-big">{t("Camino a la Copa", "Road to the Cup")}</h1>
        <p className="screen-subtitle">{t("Un roguelike de los Worlds 2026", "A Worlds 2026 roguelike")}</p>
        <div className="g-title-art" aria-hidden>
          {data.players
            .filter((p) => p.pool[0])
            .slice(0, 5)
            .map((p) => (
              <ChampSprite key={p.id} champ={data.champions[p.pool[0]]} size={56} />
            ))}
        </div>
        <div className="dialog card">
          {t(
            "Elige a un jugador de los Worlds como entrenador y empieza con un campeón de su pool. Recorre la Grieta desde el Play-In hasta la final de Nueva York: combate, ficha campeones rivales, compra objetos, caza dragones y vence a los equipos jefe. Solo tienes una vida: a la primera derrota, quedas eliminado.",
            "Pick a Worlds player as your trainer and start with a champion from their pool. Cross the Rift from the Play-In to the New York final: battle, recruit enemy champions, buy items, hunt dragons and beat the boss teams. You only have one life: lose once and you're out.",
          )}
          <span className="next">▼</span>
        </div>
        {challenge ? (
          <div className="g-actions-row g-modes">
            <button type="button" className="btn g-start" onClick={() => start(challenge)}>
              {challenge.daily ? t(`Jugar el reto #${challenge.daily}`, `Play challenge #${challenge.daily}`) : t("Aceptar el reto", "Accept the challenge")}
            </button>
            <p className="px-small g-mode-note">
              {t("La misma partida que te han pasado: mismos entrenadores, mismo mapa. ¿Llegas más lejos?", "The same run you were sent: same trainers, same map. Can you go further?")}
            </p>
            <button type="button" className="btn" onClick={free}>
              {t("Partida libre", "Free play")}
            </button>
          </div>
        ) : (
          <div className="g-actions-row g-modes">
            <button type="button" className="btn g-start" onClick={daily}>
              {t("Reto del día", "Daily challenge")}
              {today ? ` #${today}` : ""}
            </button>
            <p className="px-small g-mode-note">{t("La misma partida para todos hoy. Compárate con tus amigos.", "The same run for everyone today. Compare with your friends.")}</p>
            <button type="button" className="btn" onClick={free}>
              {t("Partida libre", "Free play")}
            </button>
          </div>
        )}
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
    else if (node.kind === "objective" && node.monster)
      go({ s: "battle", battle: startBattle(r, data, "objective", monsterSide(node.monster, r, data, node.drake), node.monster, node.drake) });
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
    if (battle.kind !== "boss" || battle.result !== "win") return go({ s: "map" });
    const from = r.stage;
    const n = nextStage(r, data);
    setRun(n);
    go(n.over ? { s: "end" } : { s: "stageClear", from });
  };

  let body: React.ReactNode = null;

  if (screen.s === "map") {
    body = (
      <>
        <MapView run={run} data={data} onEnter={enter} />
        <TeamBar run={run} data={data} />
      </>
    );
  } else if (screen.s === "battle") {
    body = (
      <BattleView
        battle={screen.battle}
        onAction={(a: Action) => go({ s: "battle", battle: playTurn(screen.battle, a) })}
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
          if (run.gold < item.gold) return go({ ...screen, msg: t("No te llega el oro.", "Not enough gold.") });
          const res = buy(run, item, u.uid, data);
          if (!res) return go({ ...screen, msg: t(`${data.champions[u.champ].name} no tiene hueco para eso.`, `${data.champions[u.champ].name} has no room for that.`) });
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
              <button type="button" className="btn" onClick={() => go({ s: "event", ev, result: t("Lo dejas como está.", "You leave things as they are.") })}>
                {ev.choice.no}
              </button>
            </>
          ) : (
            <button type="button" className="btn" onClick={() => go({ s: "map" })}>
              {t("Continuar", "Continue")}
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
        <h2 className="px-title g-event-title">{t("Fuente", "Fountain")}</h2>
        <p>{t("Vuelves a la base. La fuente cura del todo a tu equipo.", "You recall to base. The fountain fully heals your team.")}</p>
        <TeamBar run={run} data={data} />
        <div className="g-actions-row">
          <button type="button" className="btn" onClick={() => go({ s: "map" })}>
            {t("Continuar", "Continue")}
          </button>
        </div>
      </div>
    );
  } else if (screen.s === "stageClear") {
    const now = STAGES[run.stage];
    body = (
      <div className="g-event card">
        <PixelIcon name="boss" size={40} />
        <h2 className="px-title g-event-title">{t(`¡${STAGES[screen.from].name} superado!`, `${STAGES[screen.from].name} cleared!`)}</h2>
        <p>
          {t("Siguiente parada:", "Next stop:")} <span className="bold">{now.name}</span> {t("en", "in")} {now.city}.{" "}
          {t("El equipo descansa y llega con la vida al máximo.", "The team rests and arrives at full health.")}
        </p>
        <div className="g-stages big" aria-hidden>
          {STAGES.map((s, i) => (
            <span key={s.name} className={`g-pip${i < run.stage ? " done" : i === run.stage ? " now" : ""}`} />
          ))}
        </div>
        <div className="g-actions-row">
          <button type="button" className="btn" onClick={() => go({ s: "map" })}>
            {t("Continuar", "Continue")}
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
          setChallenge(null);
          go({ s: "title" });
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
  const { t: tt } = useLocale();
  const fmt = useFmt();
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
        <span title={tt("Oro", "Gold")} className="g-gold">
          {fmt(run.gold)} {tt("oro", "gold")}
        </span>
        {run.drakes.length || run.baron || run.elder ? (
          <span className="g-buffs">
            {run.drakes.map((d, i) => (
              <PixelImg key={i} src={DRAKES[d].icon} alt={DRAKES[d].name} size={22} res={16} />
            ))}
            {run.baron ? <PixelImg src={MONSTERS.baron.icon} alt={MONSTERS.baron.name} size={22} res={16} /> : null}
            {run.elder ? <PixelImg src={MONSTERS.elder.icon} alt={MONSTERS.elder.name} size={22} res={16} /> : null}
          </span>
        ) : null}
        <span title={tt("Puntos", "Points")}>{fmt(score(run))} pts</span>
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
  const d = derive(c, DIFFICULTY.startLevel, [], data, { role: trainer.role });
  const { t } = useLocale();
  return (
    <div className="g-starter card">
      <ChampSprite champ={c} size={88} res={30} />
      <div className="g-starter-name bold">{c.name}</div>
      <div className="px-small muted">{c.title}</div>
      <div className="g-starter-type">
        <TypeBadge cls={c.cls} /> <span className="px-small muted">{c.magic ? t("Mágico", "Magic") : t("Físico", "Physical")}</span>
      </div>
      <Hp hp={d.hp} max={d.hp} />
      <StatLine d={d} magic={c.magic} />
      <ul className="g-moves-list">
        {movesOf(c).map((m) => (
          <li key={m.key}>
            <span className="g-key">{m.key}</span> {m.name} <span className="muted">· {moveNote(m)}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={onPick}>
        {t("¡Te elijo!", "I choose you!")}
      </button>
    </div>
  );
}

function Reward({ run, data, screen, onDone }: { run: Run; data: GameData; screen: Extract<Screen, { s: "reward" }>; onDone: (r: Run) => void }) {
  const [replacing, setReplacing] = useState<Unit | null>(null);
  const { t } = useLocale();
  const fmt = useFmt();
  const { battle, gold, levels, reward } = screen;
  const captures = captureOptions(battle).filter((u) => !run.team.some((m) => m.champ === u.champ));
  const title =
    battle.kind === "boss"
      ? t(`¡Has eliminado a ${battle.foe.name}!`, `You knocked out ${battle.foe.name}!`)
      : battle.kind === "objective"
        ? t(`¡${battle.foe.name} es tuyo!`, `${battle.foe.name} is yours!`)
        : t("¡Victoria!", "Victory!");
  return (
    <div className="g-event card">
      <h2 className="px-title g-event-title">{title}</h2>
      <p>
        {gold ? t(`+${fmt(gold)} de oro · `, `+${fmt(gold)} gold · `) : ""}
        {t(`+${levels} ${levels === 1 ? "nivel" : "niveles"} para todo el equipo`, `+${levels} ${levels === 1 ? "level" : "levels"} for the whole team`)}
      </p>
      {reward ? <p className="bold">{reward}</p> : null}
      {replacing ? (
        <>
          <p className="px-small g-switch-title">{t(`¿Quién deja su sitio a ${data.champions[replacing.champ].name}?`, `Who makes way for ${data.champions[replacing.champ].name}?`)}</p>
          <TeamBar run={run} data={data} pickLabel={t("Sustituir", "Replace")} onPick={(u) => onDone(addUnit(run, replacing, data, u.uid))} />
          <div className="g-actions-row">
            <button type="button" className="btn sm" onClick={() => setReplacing(null)}>
              {t("Volver", "Back")}
            </button>
          </div>
        </>
      ) : captures.length ? (
        <>
          <p className="px-small g-switch-title">{t(`Ficha a un campeón de ${battle.foe.name}`, `Recruit a champion from ${battle.foe.name}`)}</p>
          <div className="g-captures">
            {captures.map((u) => {
              const c = data.champions[u.champ];
              return (
                <button key={u.uid} type="button" className="g-capture card" onClick={() => (run.team.length < MAX_TEAM ? onDone(addUnit(run, u, data)) : setReplacing(u))}>
                  <ChampSprite champ={c} size={56} />
                  <span className="bold">{c.name}</span>
                  <TypeBadge cls={c.cls} />
                  <span className="g-lv">
                    {t("Nv", "Lv")} {u.level}
                  </span>
                </button>
              );
            })}
          </div>
          {run.team.length >= MAX_TEAM ? <p className="px-small muted">{t("Tu equipo está lleno: si fichas, eliges a quién sustituye.", "Your team is full: if you recruit, you pick who it replaces.")}</p> : null}
        </>
      ) : null}
      {!replacing ? (
        <div className="g-actions-row">
          <button type="button" className="btn" onClick={() => onDone(run)}>
            {captures.length ? t("No fichar a nadie", "Don't recruit anyone") : t("Continuar", "Continue")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

type Card = { url: string; blob: Blob | null };

function End({ run, data, onAgain }: { run: Run; data: GameData; onAgain: () => void }) {
  const [format, setFormat] = useState<CardFormat>("square");
  const [cards, setCards] = useState<Partial<Record<CardFormat, Card>>>({});
  const [note, setNote] = useState("");
  const { t, locale } = useLocale();
  const fmt = useFmt();
  // Enlace propio del resultado: X, WhatsApp o Telegram enseñan su tarjeta en el post.
  const [url, setUrl] = useState(() => resultUrl(run, "https://worlddex.lol", locale));
  const text = shareText(run, locale);
  const card = cards[format];

  // Se dibujan las dos tarjetas: la cuadrada para posts y la vertical para historias.
  useEffect(() => {
    let alive = true;
    setUrl(resultUrl(run, location.origin, locale));
    (async () => {
      for (const f of ["square", "story"] as CardFormat[]) {
        const canvas = await drawCard(run, data, f, locale);
        const blob = await toBlob(canvas).catch(() => null);
        if (alive) setCards((c) => ({ ...c, [f]: { url: canvas.toDataURL("image/png"), blob } }));
      }
    })().catch(() => alive && setNote(t("No se ha podido generar la imagen.", "Couldn't generate the image.")));
    return () => {
      alive = false;
    };
  }, [run, data, locale, t]);

  const fileName = (f: CardFormat) => (locale === "en" ? `road-to-the-cup${f === "story" ? "-story" : ""}.png` : `camino-a-la-copa${f === "story" ? "-historia" : ""}.png`);
  const fileOf = (f: CardFormat) => {
    const b = cards[f]?.blob;
    return b ? new File([b], fileName(f), { type: "image/png" }) : null;
  };
  /** Abre el menú de compartir del móvil con la imagen; false si el navegador no puede. */
  const shareFile = async (f: CardFormat) => {
    const file = fileOf(f);
    if (!file || !navigator.canShare?.({ files: [file] })) return false;
    try {
      await navigator.share({ files: [file], text: `${text}\n${url}` });
    } catch {
      /* compartir cancelado */
    }
    return true;
  };
  const copy = async (msg: string) => {
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setNote(msg);
    } catch {
      setNote(t("No se ha podido copiar el mensaje.", "Couldn't copy the message."));
    }
  };
  const download = (f: CardFormat) => {
    const c = cards[f];
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.url;
    a.download = fileName(f);
    a.click();
  };

  const shareMain = async () => {
    if (await shareFile(format)) return;
    if (navigator.share) {
      try {
        await navigator.share({ text, url });
      } catch {
        /* compartir cancelado */
      }
      return;
    }
    download(format);
    await copy(t("Imagen descargada y mensaje copiado: pégalo donde quieras junto a la imagen.", "Image downloaded and message copied: paste it anywhere along with the image."));
  };
  const shareStory = async (app: string) => {
    setFormat("story");
    if (await shareFile("story")) return;
    download("story");
    await copy(t(`Imagen de historia descargada y mensaje copiado: súbela a ${app} desde la app.`, `Story image downloaded and message copied: upload it to ${app} from the app.`));
  };

  const champion = run.over === "champion";
  return (
    <div className="g-end">
      <div className={`g-end-hero${champion ? " gold" : ""}`}>
        <h1 className={`screen-title g-big${champion ? " gold" : ""}`}>{resultLine(run, locale)}</h1>
        <p className="g-end-sub">{resultSub(run, locale)}</p>
        <ol className="g-track" aria-label={t("Hasta dónde llegaste", "How far you got")}>
          {stageStates(run).map((s, i) => (
            <li key={STAGES[i].name} className={s}>
              <span aria-hidden>{s === "won" ? "✓" : s === "lost" ? "✗" : "·"}</span>
              {STAGES[i].name}
            </li>
          ))}
        </ol>
      </div>
      <div className="g-end-grid">
        <div className="g-card-col">
          <div className="g-format">
            <button type="button" className="btn sm" aria-pressed={format === "square"} onClick={() => setFormat("square")}>
              Post
            </button>
            <button type="button" className="btn sm" aria-pressed={format === "story"} onClick={() => setFormat("story")}>
              {t("Historia", "Story")}
            </button>
          </div>
          <div className={`g-card-preview card ${format}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {card ? (
              <img src={card.url} alt={t("Tu tarjeta de Camino a la Copa", "Your Road to the Cup card")} />
            ) : (
              <span className="px-small muted">{note || t("Dibujando tu tarjeta…", "Drawing your card…")}</span>
            )}
          </div>
          <button type="button" className="btn" onClick={() => download(format)} disabled={!card}>
            {t("Descargar imagen", "Download image")}
          </button>
        </div>
        <div className="g-end-side g-share-box">
          <button type="button" className="btn g-share-main" onClick={shareMain} disabled={!card}>
            {t("¡Presume de resultado!", "Show off your result!")}
          </button>
          <div className="g-share">
            <a className="btn s-x" href={xIntent(run, url, locale)} target="_blank" rel="noopener noreferrer">
              X (Twitter)
            </a>
            <a className="btn s-wa" href={whatsappLink(run, url, locale)} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <a className="btn s-tg" href={telegramLink(run, url, locale)} target="_blank" rel="noopener noreferrer">
              Telegram
            </a>
            <button type="button" className="btn s-ig" onClick={() => shareStory("Instagram")} disabled={!cards.story}>
              Instagram
            </button>
            <button type="button" className="btn s-tt" onClick={() => shareStory("TikTok")} disabled={!cards.story}>
              TikTok
            </button>
            <button type="button" className="btn" onClick={() => copy(t("¡Mensaje copiado! Pégalo donde quieras.", "Message copied! Paste it anywhere."))}>
              {t("Copiar mensaje", "Copy message")}
            </button>
          </div>
          {note && card ? <p className="px-small g-note">{note}</p> : null}
        </div>
        <div className="g-end-side g-end-info">
          <div className="g-msg card">
            <div className="px-small muted">{t("Tu mensaje", "Your message")}</div>
            <p>{text}</p>
          </div>
          <div className="g-score card">
            <div className="px-small muted">{t("Puntos", "Points")}</div>
            <div className="g-score-num">{fmt(score(run))}</div>
            <ul className="px-small">
              <li>
                {t("Combates ganados", "Battles won")}: {run.wins} × 100
              </li>
              <li>
                {t("Objetivos", "Objectives")}: {run.objectives} × 300
              </li>
              <li>
                {t("Jefes", "Bosses")}: {run.bosses} × {fmt(1000)}
              </li>
              <li>
                {t("Oro sobrante", "Leftover gold")}: {fmt(Math.floor(run.gold / 10))}
              </li>
              {champion ? (
                <li>
                  {t("Campeón del mundo", "World champion")}: {fmt(5000)}
                </li>
              ) : null}
            </ul>
          </div>
          {run.daily ? (
            <p className="px-small g-mode-note">
              {t("Mañana hay reto nuevo. Pásale el enlace a un amigo: jugará tu misma partida.", "New challenge tomorrow. Send the link to a friend: they'll play your same run.")}
            </p>
          ) : null}
          <div className="g-actions-row">
            <button type="button" className="btn" onClick={onAgain}>
              {t("Jugar otra vez", "Play again")}
            </button>
          </div>
        </div>
      </div>
      <TeamBar run={run} data={data} />
    </div>
  );
}
