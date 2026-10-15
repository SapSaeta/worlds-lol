// Motor de "Camino a la Copa": estadísticas, combates por turnos, mapa de
// nodos, tienda, eventos y puntuación. Todo son funciones puras sobre datos
// serializables; las pantallas copian el estado, lo cambian y lo guardan.

import type { Cls, GameData, GChamp, GItem, GPlayer, GTeam, Role, SpellKey, Stats } from "@/lib/game/types";

/* ---------- Azar ---------- */

export const rand = () => Math.random();
export const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];
export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const uid = () => Math.random().toString(36).slice(2, 9);

/* ---------- Tipos y ventajas ---------- */

export const CLS_LABEL: Record<Cls, string> = {
  Fighter: "Luchador",
  Tank: "Tanque",
  Mage: "Mago",
  Assassin: "Asesino",
  Marksman: "Tirador",
  Support: "Soporte",
};

/** Cada clase pega x1,3 a dos clases y recibe x1,3 de otras dos. */
export const STRONG: Record<Cls, Cls[]> = {
  Assassin: ["Marksman", "Mage"],
  Tank: ["Assassin", "Fighter"],
  Marksman: ["Tank", "Fighter"],
  Mage: ["Tank", "Support"],
  Fighter: ["Mage", "Support"],
  Support: ["Assassin", "Marksman"],
};

export function typeMult(att: Cls | "Monster", def: Cls | "Monster") {
  if (att === "Monster" || def === "Monster") return 1;
  if (STRONG[att].includes(def)) return 1.3;
  if (STRONG[def].includes(att)) return 0.77;
  return 1;
}

/* ---------- Entrenador ---------- */

export const ROLE_LABEL: Record<Role, string> = { top: "Top", jungle: "Jungla", mid: "Mid", bottom: "ADC", support: "Support" };
export const ROLE_PERK: Record<Role, string> = {
  top: "Tus campeones tienen un 15 % más de vida.",
  jungle: "Tus campeones actúan primero.",
  mid: "Tus campeones hacen un 15 % más de daño mágico.",
  bottom: "Tus campeones tienen un 15 % más de crítico.",
  support: "Escudos y curaciones un 50 % más fuertes, y curas al equipo tras cada combate.",
};

/* ---------- Unidades y estadísticas ---------- */

export const MAX_TEAM = 5;
export const MAX_ITEMS = 3;
export const MAX_LEVEL = 18;
/** Como en la fase suiza: a la tercera derrota, eliminado. */
export const LIVES = 3;

export type Unit = {
  uid: string;
  champ: string;
  level: number;
  /** Vida actual; 0 = fuera de combate */
  hp: number;
  items: string[];
  /** Mejora permanente de eventos (multiplica todo) */
  boost: number;
};

export type Derived = { hp: number; ad: number; ap: number; ar: number; mr: number; spd: number; crit: number; ls: number };

const growth = (level: number) => 1 + 0.09 * (level - 1);

export function itemStats(items: string[], data: GameData): Stats {
  const out: Stats = {};
  for (const id of items) {
    const it = data.items.find((i) => i.id === id);
    for (const [k, v] of Object.entries(it?.stats ?? {})) out[k as keyof Stats] = (out[k as keyof Stats] ?? 0) + (v ?? 0);
  }
  return out;
}

export type Mods = { role?: Role; mult?: number };

export function derive(c: GChamp, level: number, items: string[], data: GameData, mods: Mods = {}, boost = 1): Derived {
  const g = growth(level) * boost * (mods.mult ?? 1);
  const s = itemStats(items, data);
  const hpBonus = mods.role === "top" ? 1.15 : 1;
  return {
    hp: Math.round((c.base.hp * g + (s.hp ?? 0)) * hpBonus),
    ad: Math.round(c.base.ad * g + (s.ad ?? 0)),
    ap: Math.round((c.base.ap * g + (s.ap ?? 0)) * (mods.role === "mid" ? 1.15 : 1)),
    ar: Math.round(c.base.ar * g + (s.ar ?? 0)),
    mr: Math.round(c.base.mr * g + (s.mr ?? 0)),
    spd: Math.round(c.base.ms + (s.ms ?? 0) + (s.as ?? 0) * 100 + (mods.role === "jungle" ? 1000 : 0)),
    crit: Math.min(1, (s.crit ?? 0) + (mods.role === "bottom" ? 0.15 : 0)),
    ls: s.ls ?? 0,
  };
}

export function newUnit(champ: string, level: number, data: GameData, role?: Role): Unit {
  const c = data.champions[champ];
  return { uid: uid(), champ, level, hp: derive(c, level, [], data, { role }).hp, items: [], boost: 1 };
}

export function unitStats(u: Unit, data: GameData, role?: Role) {
  return derive(data.champions[u.champ], u.level, u.items, data, { role }, u.boost);
}

/* ---------- Habilidades ---------- */

export type Move = {
  key: SpellKey;
  name: string;
  icon: string;
  power: number;
  /** Texto corto del efecto */
  note: string;
  priority?: boolean;
  hits?: number;
  heal?: number;
  shield?: number;
  drain?: number;
  critBonus?: number;
  cooldown?: number;
};

/** Las cuatro habilidades del campeón: nombre e icono oficiales y efecto según su clase. */
export function movesOf(c: GChamp): Move[] {
  const sp = Object.fromEntries(c.spells.map((s) => [s.key, s]));
  const base = (key: SpellKey) => ({ key, name: sp[key]?.name ?? key, icon: sp[key]?.icon ?? "" });
  const W: Record<Cls, Partial<Move>> = {
    Fighter: { power: 50, drain: 0.6, note: "Roba vida" },
    Tank: { power: 20, shield: 0.25, note: "Escudo" },
    Mage: { power: 75, note: "Golpe mágico fuerte" },
    Assassin: { power: 50, critBonus: 0.4, note: "Más crítico" },
    Marksman: { power: 35, hits: 2, note: "Golpea dos veces" },
    Support: { power: 0, heal: 0.3, note: "Cura" },
  };
  const R: Partial<Move> = c.cls === "Support" ? { power: 70, heal: 0.35, note: "Definitiva: daña y cura" } : { power: 120, note: "Definitiva" };
  return [
    { ...base("Q"), power: 60, note: "Golpe" },
    { ...base("W"), power: 0, note: "", ...W[c.cls] },
    { ...base("E"), power: 45, priority: true, note: "Ataca primero" },
    { ...base("R"), power: 0, note: "", ...R, cooldown: 3 },
  ];
}

/* ---------- Monstruos de la Grieta ---------- */

export type MonsterId = "dragon" | "herald" | "baron";
export const MONSTERS: Record<MonsterId, { name: string; hp: number; power: number; reward: string }> = {
  dragon: { name: "Dragón", hp: 1.7, power: 70, reward: "Alma de dragón: +8 % de daño para todo el equipo hasta el final." },
  herald: { name: "Heraldo de la Grieta", hp: 1.4, power: 60, reward: "Ojo del Heraldo: 400 de oro." },
  baron: { name: "Barón Nashor", hp: 2.4, power: 85, reward: "Mano del Barón: +30 % de daño hasta vencer al jefe de esta fase." },
};

export function monsterChamp(id: MonsterId, stage: number): GChamp {
  const m = MONSTERS[id];
  return {
    id: `monster-${id}`,
    name: m.name,
    title: "Objetivo de la Grieta",
    cls: "Tank",
    tags: ["Monster"],
    magic: true,
    base: { hp: Math.round(620 * m.hp), ad: 60, ap: 58, ar: 32 + stage * 4, mr: 32 + stage * 4, ms: 300 },
    icon: `monster:${id}`,
    spells: [
      { key: "Q", name: id === "baron" ? "Ácido corrosivo" : id === "herald" ? "Embestida" : "Aliento de fuego", icon: `monster:${id}` },
      { key: "W", name: "Zarpazo", icon: `monster:${id}` },
      { key: "E", name: "Rugido", icon: `monster:${id}` },
      { key: "R", name: "Furia", icon: `monster:${id}` },
    ],
  };
}

/* ---------- Mapa ---------- */

export type NodeKind = "fight" | "shop" | "event" | "fountain" | "objective" | "boss";
export type MapNode = { kind: NodeKind; next: number[]; monster?: MonsterId; done?: boolean };
export type StageMap = { name: string; city: string; rows: MapNode[][] };

export const STAGES = [
  { name: "Play-In", city: "Los Ángeles" },
  { name: "Fase suiza", city: "Allen" },
  { name: "Cuartos", city: "Allen" },
  { name: "Semis", city: "Allen" },
  { name: "Final", city: "Nueva York" },
];

export const stageLevel = (stage: number) => [4, 7, 10, 13, 16][stage] ?? 16;

function rowKinds(stage: number, row: number, width: number): MapNode[] {
  const nodes: MapNode[] = [];
  for (let i = 0; i < width; i++) {
    const r = rand();
    let kind: NodeKind = "fight";
    if (row === 0) kind = r < 0.8 ? "fight" : "event";
    else if (r < 0.42) kind = "fight";
    else if (r < 0.6) kind = "shop";
    else if (r < 0.76) kind = "event";
    else if (r < 0.86) kind = "fountain";
    else kind = "objective";
    const node: MapNode = { kind, next: [] };
    if (kind === "objective") node.monster = stage >= 2 && rand() < 0.45 ? "baron" : rand() < 0.65 ? "dragon" : "herald";
    nodes.push(node);
  }
  return nodes;
}

/** Mapa de una fase: 4 filas de 2-3 caminos y el jefe al final. */
export function makeStage(stage: number): StageMap {
  const rows: MapNode[][] = [];
  for (let r = 0; r < 4; r++) rows.push(rowKinds(stage, r, r === 0 ? 2 + Math.round(rand()) : 2 + Math.round(rand() * 1.2)));
  // Al menos una tienda y un combate por fase, fuera de la primera fila.
  if (!rows.slice(1).some((row) => row.some((n) => n.kind === "shop"))) rows[2][0] = { kind: "shop", next: [] };
  if (!rows.slice(1).some((row) => row.some((n) => n.kind === "fight"))) rows[1][rows[1].length - 1] = { kind: "fight", next: [] };
  rows.push([{ kind: "boss", next: [] }]);
  for (let r = 0; r < rows.length - 1; r++) {
    const a = rows[r];
    const b = rows[r + 1];
    const pos = (i: number, n: number) => (n === 1 ? 0.5 : i / (n - 1));
    a.forEach((node, i) => {
      const near = b.map((_, j) => j).sort((x, y) => Math.abs(pos(x, b.length) - pos(i, a.length)) - Math.abs(pos(y, b.length) - pos(i, a.length)));
      node.next = [near[0]];
      if (near[1] !== undefined && Math.abs(pos(near[1], b.length) - pos(i, a.length)) <= 0.51 && rand() < 0.6) node.next.push(near[1]);
    });
    b.forEach((_, j) => {
      if (!a.some((n) => n.next.includes(j))) {
        const from = a.map((_, i) => i).sort((x, y) => Math.abs(pos(x, a.length) - pos(j, b.length)) - Math.abs(pos(y, a.length) - pos(j, b.length)))[0];
        a[from].next.push(j);
      }
    });
    a.forEach((n) => n.next.sort((x, y) => x - y));
  }
  return { ...STAGES[stage], rows };
}

/* ---------- Partida ---------- */

export type Run = {
  trainer: GPlayer;
  team: Unit[];
  gold: number;
  stage: number;
  /** Fila actual dentro de la fase (-1 = aún no has elegido camino) */
  row: number;
  col: number;
  maps: StageMap[];
  wins: number;
  objectives: number;
  bosses: number;
  dragons: number;
  baron: boolean;
  /** Derrotas que aún puedes permitirte */
  lives: number;
  /** Último resultado, para la tarjeta final */
  over?: "champion" | "eliminated";
  log: string[];
};

export function newRun(trainer: GPlayer, starter: string, data: GameData): Run {
  return {
    trainer,
    team: [newUnit(starter, stageLevel(0), data, trainer.role)],
    gold: 500,
    stage: 0,
    row: -1,
    col: 0,
    maps: STAGES.map((_, i) => makeStage(i)),
    wins: 0,
    objectives: 0,
    bosses: 0,
    dragons: 0,
    baron: false,
    lives: LIVES,
    log: [],
  };
}

/** Nodos a los que se puede ir desde la posición actual. */
export function reachable(run: Run): number[] {
  const rows = run.maps[run.stage].rows;
  if (run.row < 0) return rows[0].map((_, i) => i);
  return rows[run.row][run.col]?.next ?? [];
}

export function score(run: Run) {
  return run.wins * 100 + run.objectives * 300 + run.bosses * 1000 + Math.floor(run.gold / 10) + (run.over === "champion" ? 5000 : 0);
}

/** Tres entrenadores al azar, de equipos distintos. */
export function trainerOptions(data: GameData, n = 3): GPlayer[] {
  const out: GPlayer[] = [];
  for (const p of shuffle(data.players.filter((p) => p.pool.length >= 3))) {
    if (out.some((o) => o.team === p.team)) continue;
    out.push(p);
    if (out.length === n) break;
  }
  return out;
}

/* ---------- Rivales ---------- */

export type Side = {
  name: string;
  /** Equipo (código) o monstruo */
  team?: string;
  image?: string;
  units: Unit[];
  champs?: Record<string, GChamp>;
  mult: number;
};

export function rivalTrainer(run: Run, data: GameData): Side {
  const pool = data.players.filter((p) => p.team !== run.trainer.team && p.pool.length);
  const p = pick(pool);
  const n = [1, 2, 2, 3, 3][run.stage] ?? 3;
  const champs = shuffle(p.pool.slice(0, 6)).slice(0, n);
  // Más fuerte cuanto más cerca del jefe.
  const lvl = stageLevel(run.stage) - 1 + Math.max(0, run.row - 1);
  return {
    name: p.name,
    team: p.team,
    image: p.image,
    units: champs.map((c) => newUnit(c, Math.max(1, lvl), data)),
    mult: 1 + 0.06 * run.stage,
  };
}

const BOSS_SIZE = [3, 3, 4, 5, 5];

/** Jefe de la fase: un equipo real, más fuerte cuanto más avanzas. */
export function bossTeam(run: Run, data: GameData): Side & { teamData: GTeam } {
  const teams = data.teams.filter((t) => t.code !== run.trainer.team && t.players.length >= 3);
  const n = teams.length;
  // De más débil (Play-In) a más fuerte (final), por ranking global.
  const bands = [
    [0.75, 1],
    [0.5, 0.75],
    [0.3, 0.5],
    [0.1, 0.3],
    [0, 0.1],
  ][run.stage];
  const slice = teams.slice(Math.floor(bands[0] * n), Math.max(Math.floor(bands[0] * n) + 1, Math.ceil(bands[1] * n)));
  const team = pick(slice.length ? slice : teams);
  const players = team.players.map((id) => data.players.find((p) => p.id === id)).filter((p): p is GPlayer => !!p && p.pool.length > 0);
  return {
    name: team.name,
    team: team.code,
    image: team.image,
    teamData: team,
    units: shuffle(players)
      .slice(0, BOSS_SIZE[run.stage] ?? 5)
      .map((p) => newUnit(pick(p.pool.slice(0, 3)), stageLevel(run.stage) + 1, data)),
    mult: 1 + 0.06 * run.stage,
  };
}

export function monsterSide(id: MonsterId, run: Run, data: GameData): Side {
  const c = monsterChamp(id, run.stage);
  const unit: Unit = { uid: uid(), champ: c.id, level: stageLevel(run.stage) + 1, hp: 0, items: [], boost: 1 };
  const champs = { [c.id]: c };
  unit.hp = derive(c, unit.level, [], data).hp;
  return { name: MONSTERS[id].name, units: [unit], champs, mult: 1 + 0.06 * run.stage };
}

/* ---------- Combate ---------- */

export type Fighter = {
  unit: Unit;
  champ: GChamp;
  max: Derived;
  hp: number;
  shield: number;
  cdR: number;
};

export type Battle = {
  kind: "fight" | "boss" | "objective";
  monster?: MonsterId;
  foe: Side;
  mine: Fighter[];
  theirs: Fighter[];
  a: number;
  b: number;
  turn: number;
  /** Texto del último turno */
  lines: string[];
  /** Tu campeón activo ha caído y toca elegir otro */
  mustSwitch: boolean;
  result?: "win" | "lose";
};

function fighter(u: Unit, c: GChamp, data: GameData, mods: Mods): Fighter {
  const max = derive(c, u.level, u.items, data, mods, u.boost);
  return { unit: u, champ: c, max, hp: Math.min(u.hp, max.hp), shield: 0, cdR: 0 };
}

export function startBattle(run: Run, data: GameData, kind: Battle["kind"], foe: Side, monster?: MonsterId): Battle {
  const mine = run.team.map((u) => fighter(u, data.champions[u.champ], data, { role: run.trainer.role }));
  const theirs = foe.units.map((u) => {
    const c = foe.champs?.[u.champ] ?? data.champions[u.champ];
    const f = fighter(u, c, data, { mult: foe.mult });
    f.hp = f.max.hp;
    return f;
  });
  const a = Math.max(0, mine.findIndex((f) => f.hp > 0));
  const intro = kind === "boss" ? `¡${foe.name} te reta! Es el jefe de ${STAGES[run.stage].name}.` : kind === "objective" ? `¡Aparece ${foe.name}!` : `¡${foe.name} (${foe.team}) quiere combatir!`;
  return { kind, monster, foe, mine, theirs, a, b: 0, turn: 0, lines: [intro, `${foe.name} saca a ${theirs[0].champ.name}. ¡Adelante, ${mine[a].champ.name}!`], mustSwitch: false };
}

export type Action = { type: "move"; key: SpellKey } | { type: "switch"; to: number };

function teamDamageMult(run: Run) {
  return (1 + 0.08 * run.dragons) * (run.baron ? 1.3 : 1);
}

function enemyMoves(f: Fighter): Move[] {
  if (f.champ.tags.includes("Monster")) {
    const m = MONSTERS[f.champ.id.replace("monster-", "") as MonsterId];
    return [
      { key: "Q", name: f.champ.spells[0].name, icon: "", power: m.power, note: "" },
      { key: "W", name: "Zarpazo", icon: "", power: Math.round(m.power * 0.8), note: "" },
    ];
  }
  return movesOf(f.champ);
}

function damage(att: Fighter, def: Fighter, power: number, extraCrit = 0, mult = 1) {
  const stat = att.champ.magic ? att.max.ap : att.max.ad;
  const res = att.champ.magic ? def.max.mr : def.max.ar;
  const tm = typeMult(att.champ.tags.includes("Monster") ? "Monster" : att.champ.cls, def.champ.tags.includes("Monster") ? "Monster" : def.champ.cls);
  const crit = rand() < att.max.crit + extraCrit;
  const d = (power / 100) * stat * 7 * (100 / (100 + Math.max(0, res))) * tm * (crit ? 1.75 : 1) * (0.9 + rand() * 0.1) * mult;
  return { d: Math.max(1, Math.round(d)), tm, crit };
}

function hit(def: Fighter, d: number) {
  const absorbed = Math.min(def.shield, d);
  def.shield -= absorbed;
  def.hp = Math.max(0, def.hp - (d - absorbed));
  return d - absorbed;
}

function useMove(b: Battle, side: 0 | 1, move: Move, run: Run) {
  const me = side === 0 ? b.mine[b.a] : b.theirs[b.b];
  const foe = side === 0 ? b.theirs[b.b] : b.mine[b.a];
  const who = side === 0 ? me.champ.name : `${me.champ.name} rival`;
  const supp = side === 0 && run.trainer.role === "support" ? 1.5 : 1;
  const mult = side === 0 ? teamDamageMult(run) : 1;
  b.lines.push(`${who} usa ${move.name}${/[!?.…]$/.test(move.name) ? "" : "."}`);
  if (move.key === "R") me.cdR = (move.cooldown ?? 3) + 1;
  if (move.shield) {
    me.shield += Math.round(me.max.hp * move.shield * supp);
    b.lines.push(`${who} se cubre con un escudo.`);
  }
  if (move.heal) {
    const h = Math.round(me.max.hp * move.heal * supp);
    me.hp = Math.min(me.max.hp, me.hp + h);
    b.lines.push(`${who} recupera ${h} de vida.`);
  }
  if (move.power > 0) {
    for (let i = 0; i < (move.hits ?? 1) && foe.hp > 0; i++) {
      const { d, tm, crit } = damage(me, foe, move.power, move.critBonus ?? 0, mult);
      const done = hit(foe, d);
      const lifesteal = Math.round(done * ((move.drain ?? 0) + me.max.ls));
      if (lifesteal) me.hp = Math.min(me.max.hp, me.hp + lifesteal);
      const tags = [crit ? "¡Crítico!" : "", tm > 1 ? "¡Es muy eficaz!" : tm < 1 ? "No es muy eficaz…" : ""].filter(Boolean).join(" ");
      b.lines.push(`${done} de daño.${tags ? ` ${tags}` : ""}${lifesteal ? ` Roba ${lifesteal} de vida.` : ""}`);
    }
    if (foe.hp <= 0) b.lines.push(`¡${side === 0 ? `${foe.champ.name} rival` : foe.champ.name} cae!`);
  }
}

/** Elección del rival: definitiva si puede rematar o va mal, cura si lo necesita y si no, el golpe que más duele. */
function enemyChoice(b: Battle): Move {
  const me = b.theirs[b.b];
  const foe = b.mine[b.a];
  const moves = enemyMoves(me).filter((m) => m.key !== "R" || me.cdR === 0);
  const r = moves.find((m) => m.key === "R");
  if (r && (me.hp < me.max.hp * 0.5 || rand() < 0.35)) return r;
  const heal = moves.find((m) => m.heal);
  if (heal && me.hp < me.max.hp * 0.45) return heal;
  const shield = moves.find((m) => m.shield);
  if (shield && me.shield === 0 && me.hp < me.max.hp * 0.7 && rand() < 0.6) return shield;
  const scored = moves.filter((m) => m.power > 0).map((m) => ({ m, v: m.power * (m.hits ?? 1) * typeMult(me.champ.cls, foe.champ.cls) * (0.85 + rand() * 0.3) }));
  return scored.sort((x, y) => y.v - x.v)[0]?.m ?? moves[0];
}

const alive = (fs: Fighter[]) => fs.some((f) => f.hp > 0);

/** Resuelve un turno completo con tu acción y la del rival. */
export function playTurn(prev: Battle, action: Action, run: Run): Battle {
  const b: Battle = structuredClone(prev);
  b.lines = [];
  b.turn++;

  if (b.mustSwitch) {
    if (action.type !== "switch") return prev;
    b.a = action.to;
    b.mustSwitch = false;
    b.lines.push(`¡Adelante, ${b.mine[b.a].champ.name}!`);
    return b;
  }

  const foeMove = enemyChoice(b);
  if (action.type === "switch") {
    b.mine[b.a].shield = 0;
    b.a = action.to;
    b.lines.push(`Cambias a ${b.mine[b.a].champ.name}.`);
    useMove(b, 1, foeMove, run);
  } else {
    const myMove = movesOf(b.mine[b.a].champ).find((m) => m.key === action.key)!;
    const meFirst =
      Number(!!myMove.priority) !== Number(!!foeMove.priority)
        ? !!myMove.priority
        : b.mine[b.a].max.spd !== b.theirs[b.b].max.spd
          ? b.mine[b.a].max.spd > b.theirs[b.b].max.spd
          : rand() < 0.5;
    const order: [0 | 1, Move][] = meFirst
      ? [
          [0, myMove],
          [1, foeMove],
        ]
      : [
          [1, foeMove],
          [0, myMove],
        ];
    for (const [side, m] of order) {
      const actor = side === 0 ? b.mine[b.a] : b.theirs[b.b];
      if (actor.hp <= 0) continue;
      useMove(b, side, m, run);
    }
  }
  for (const f of [b.mine[b.a], b.theirs[b.b]]) if (f.cdR > 0) f.cdR--;

  if (b.theirs[b.b].hp <= 0) {
    const next = b.theirs.findIndex((f) => f.hp > 0);
    if (next < 0) {
      b.result = "win";
      b.lines.push(b.kind === "objective" ? `¡Has asegurado ${b.foe.name}!` : `¡Has ganado a ${b.foe.name}!`);
    } else {
      b.b = next;
      b.lines.push(`${b.foe.name} saca a ${b.theirs[next].champ.name}.`);
    }
  }
  if (!b.result && b.mine[b.a].hp <= 0) {
    if (!alive(b.mine)) {
      b.result = "lose";
      b.lines.push("No te quedan campeones en pie…");
    } else b.mustSwitch = true;
  }
  return b;
}

/** Vuelca el resultado del combate al equipo: vida, niveles, oro y avance. */
export function finishBattle(run: Run, b: Battle, data: GameData): { run: Run; gold: number; levels: number; reward?: string } {
  const r: Run = structuredClone(run);
  for (const f of b.mine) {
    const u = r.team.find((x) => x.uid === f.unit.uid);
    if (u) u.hp = f.hp;
  }
  if (b.result !== "win") {
    r.lives--;
    if (r.lives <= 0) {
      r.over = "eliminated";
      return { run: r, gold: 0, levels: 0 };
    }
    if (b.kind === "boss") {
      // Contra el jefe se puede repetir: vuelves a la casilla anterior con el equipo curado.
      const rows = r.maps[r.stage].rows;
      rows[r.row][r.col].done = false;
      r.row--;
      r.col = Math.max(0, rows[r.row].findIndex((n) => n.done));
      healAll(r, data);
    } else for (const u of r.team) u.hp = Math.round(unitStats(u, data, r.trainer.role).hp * 0.4);
    return { run: r, gold: 0, levels: 0 };
  }
  let gold = 0;
  let levels = 1;
  let reward: string | undefined;
  if (b.kind === "fight") {
    r.wins++;
    gold = 350 + 75 * r.stage;
  } else if (b.kind === "boss") {
    r.bosses++;
    r.wins++;
    gold = 700 + 150 * r.stage;
    levels = 2;
  } else {
    r.objectives++;
    levels = 1;
    if (b.monster === "dragon") r.dragons++;
    if (b.monster === "herald") gold = 400;
    if (b.monster === "baron") r.baron = true;
    reward = b.monster ? MONSTERS[b.monster].reward : undefined;
  }
  r.gold += gold;
  const heal = r.trainer.role === "support" ? 0.45 : 0.3;
  for (const u of r.team) {
    u.level = Math.min(MAX_LEVEL, u.level + levels);
    const max = unitStats(u, data, r.trainer.role).hp;
    // Los caídos vuelven con algo de vida; los demás se curan un poco.
    u.hp = u.hp <= 0 ? Math.round(max * 0.35) : Math.min(max, Math.round(u.hp + max * heal));
  }
  return { run: r, gold, levels, reward };
}

export function healAll(run: Run, data: GameData) {
  for (const u of run.team) u.hp = unitStats(u, data, run.trainer.role).hp;
}

/** Tras vencer al jefe: siguiente fase, equipo curado y el Barón se acaba. */
export function nextStage(run: Run, data: GameData): Run {
  const r: Run = structuredClone(run);
  if (r.stage >= STAGES.length - 1) {
    r.over = "champion";
    return r;
  }
  r.stage++;
  r.row = -1;
  r.col = 0;
  r.baron = false;
  healAll(r, data);
  return r;
}

/* ---------- Capturar ---------- */

export function captureOptions(b: Battle): Unit[] {
  if (b.kind === "objective") return [];
  return b.theirs.map((f) => f.unit);
}

export function addUnit(run: Run, u: Unit, data: GameData, replace?: string): Run {
  const r: Run = structuredClone(run);
  const fresh: Unit = { ...u, uid: uid(), items: [], boost: 1, level: Math.max(1, u.level - 1) };
  fresh.hp = unitStats(fresh, data, r.trainer.role).hp;
  if (replace) r.team = r.team.map((x) => (x.uid === replace ? fresh : x));
  else if (r.team.length < MAX_TEAM) r.team.push(fresh);
  return r;
}

/* ---------- Tienda ---------- */

export function shopStock(data: GameData, stage: number): GItem[] {
  const by = (k: GItem["kind"]) => data.items.filter((i) => i.kind === k);
  const legend = by("legendary").filter((i) => i.gold >= 2200);
  const out = [...shuffle(by("basic")).slice(0, 3), ...shuffle(by("epic")).slice(0, stage >= 1 ? 2 : 1), ...shuffle(legend).slice(0, stage >= 2 ? 2 : 1), ...by("potion").slice(0, 1)];
  return out;
}

/** Junta componentes en el objeto que forman, todas las veces que se pueda. */
export function combine(items: string[], data: GameData): { items: string[]; made: GItem[] } {
  let cur = [...items];
  const made: GItem[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    for (const it of data.items) {
      if (!it.from.length || it.kind === "basic") continue;
      const left = [...cur];
      const ok = it.from.every((c) => {
        const i = left.indexOf(c);
        if (i < 0) return false;
        left.splice(i, 1);
        return true;
      });
      if (ok) {
        cur = [...left, it.id];
        made.push(it);
        changed = true;
        break;
      }
    }
  }
  return { items: cur, made };
}

export function buy(run: Run, item: GItem, unitId: string, data: GameData): { run: Run; text: string } | null {
  if (run.gold < item.gold) return null;
  const r: Run = structuredClone(run);
  const u = r.team.find((x) => x.uid === unitId);
  if (!u) return null;
  const c = data.champions[u.champ];
  const before = unitStats(u, data, r.trainer.role).hp;
  if (item.kind === "potion") {
    if (u.hp <= 0) return null;
    r.gold -= item.gold;
    u.hp = Math.min(before, u.hp + Math.round(before * 0.5));
    return { run: r, text: `${c.name} se toma la ${item.name} y recupera vida.` };
  }
  const { items, made } = combine([...u.items, item.id], data);
  if (items.length > MAX_ITEMS) return null;
  r.gold -= item.gold;
  u.items = items;
  const after = unitStats(u, data, r.trainer.role).hp;
  if (u.hp > 0) u.hp = Math.min(after, u.hp + Math.max(0, after - before));
  const text = made.length ? `¡${c.name} combina sus componentes en ${made.at(-1)!.name}!` : `${c.name} se equipa ${item.name}.`;
  return { run: r, text };
}

/* ---------- Eventos ---------- */

export type GameEvent = { title: string; text: string; choice?: { yes: string; no: string } ; apply: (r: Run, data: GameData) => string };

export function randomEvent(run: Run, data: GameData): GameEvent {
  const events: GameEvent[] = [
    {
      title: "Firma de autógrafos",
      text: "Los fans te esperan a la salida del hotel. Te dan 250 de oro por las fotos.",
      apply: (r) => {
        r.gold += 250;
        return "+250 de oro.";
      },
    },
    {
      title: "Scrim contra la academia",
      text: "Una scrim larga de práctica. Un campeón al azar sube de nivel.",
      apply: (r, d) => {
        const u = pick(r.team);
        u.level = Math.min(MAX_LEVEL, u.level + 1);
        return `${d.champions[u.champ].name} sube a nivel ${u.level}.`;
      },
    },
    {
      title: "Regalo de un patrocinador",
      text: "Un patrocinador te manda material. Uno de tus campeones recibe un componente.",
      apply: (r, d) => {
        const free = r.team.filter((u) => u.items.length < MAX_ITEMS);
        if (!free.length) {
          r.gold += 300;
          return "Nadie tiene hueco: te lo dan en oro (+300).";
        }
        const u = pick(free);
        const it = pick(d.items.filter((i) => i.kind === "basic"));
        u.items = combine([...u.items, it.id], d).items;
        return `${d.champions[u.champ].name} recibe ${it.name}.`;
      },
    },
    {
      title: "Jet lag",
      text: "El viaje pasa factura: todo el equipo pierde un 20 % de vida.",
      apply: (r, d) => {
        for (const u of r.team) if (u.hp > 0) u.hp = Math.max(1, Math.round(u.hp - unitStats(u, d, r.trainer.role).hp * 0.2));
        return "El equipo llega cansado.";
      },
    },
    {
      title: "Parche nuevo",
      text: "Riot saca un parche a mitad del torneo y uno de tus campeones sale reforzado.",
      apply: (r, d) => {
        const u = pick(r.team);
        u.boost = Math.round(u.boost * 1.1 * 100) / 100;
        return `${d.champions[u.champ].name} mejora un 10 % sus estadísticas.`;
      },
    },
    {
      title: "Sesión de fisio",
      text: "Un buen masaje antes del partido. Todo el equipo recupera la mitad de su vida.",
      apply: (r, d) => {
        for (const u of r.team) {
          const max = unitStats(u, d, r.trainer.role).hp;
          u.hp = Math.min(max, u.hp + Math.round(max * 0.5));
        }
        return "El equipo se recupera.";
      },
    },
  ];
  const pool = run.trainer.pool.filter((c) => data.champions[c] && !run.team.some((u) => u.champ === c));
  if (pool.length && run.team.length) {
    events.push({
      title: "Cambio de última hora",
      text: `${run.trainer.name} quiere probar algo nuevo de su pool. ¿Cambias a uno de tus campeones por otro al azar de su pool, al mismo nivel?`,
      choice: { yes: "Cambiar", no: "Mejor no" },
      apply: (r, d) => {
        const u = pick(r.team);
        const c = pick(pool);
        const old = d.champions[u.champ].name;
        u.champ = c;
        u.items = [];
        u.hp = unitStats(u, d, r.trainer.role).hp;
        return `${old} deja su sitio a ${d.champions[c].name}.`;
      },
    });
  }
  return pick(events);
}
