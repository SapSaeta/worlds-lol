// Motor de "Camino a la Copa": estadísticas, combates por turnos, mapa de
// nodos, tienda, eventos y puntuación. Todo son funciones puras sobre datos
// serializables; las pantallas copian el estado, lo cambian y lo guardan.

import type { Cls, GameData, GChamp, GItem, GPlayer, GTeam, Role, Spell, SpellFx, SpellKey, Stats } from "@/lib/game/types";

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

export type Derived = { hp: number; ad: number; ap: number; ar: number; mr: number; spd: number; crit: number; as: number; ls: number };

// Cada nivel sube más el daño que la vida y mucho más que las resistencias:
// un campeón con más nivel pega bastante más fuerte.
const growOff = (level: number) => 1 + 0.11 * (level - 1);
const growHp = (level: number) => 1 + 0.08 * (level - 1);
const growRes = (level: number) => 1 + 0.04 * (level - 1);

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
  const m = boost * (mods.mult ?? 1);
  const s = itemStats(items, data);
  return {
    hp: Math.round((c.base.hp * growHp(level) * m + (s.hp ?? 0)) * (mods.role === "top" ? 1.15 : 1)),
    ad: Math.round(c.base.ad * growOff(level) * m + (s.ad ?? 0)),
    ap: Math.round((c.base.ap * growOff(level) * m + (s.ap ?? 0)) * (mods.role === "mid" ? 1.15 : 1)),
    ar: Math.round(c.base.ar * growRes(level) * m + (s.ar ?? 0)),
    mr: Math.round(c.base.mr * growRes(level) * m + (s.mr ?? 0)),
    spd: Math.round(c.base.ms + (s.ms ?? 0) + (s.as ?? 0) * 100 + (mods.role === "jungle" ? 1000 : 0)),
    crit: Math.min(1, (s.crit ?? 0) + (mods.role === "bottom" ? 0.15 : 0)),
    as: s.as ?? 0,
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

/** Q, W, E, R y el ataque básico (A). */
export type MoveKey = SpellKey | "A";

export type Move = {
  key: MoveKey;
  name: string;
  icon: string;
  /** Potencia; 0 = no hace daño */
  power: number;
  dmg: "phys" | "magic" | "true";
  hits: number;
  /** Turnos de espera después de usarlo */
  cooldown: number;
  priority: boolean;
  fx: SpellFx[];
  /** Puede ser crítico (ataques básicos y golpes potenciados) */
  crit: boolean;
};

export const FX_LABEL: Record<SpellFx, string> = {
  stun: "Aturde",
  slow: "Ralentiza",
  shield: "Escudo",
  heal: "Cura",
  drain: "Roba vida",
  dash: "Ataca primero",
  haste: "Más velocidad",
  empower: "Golpe potenciado",
  buff: "Más daño",
  guard: "Menos daño recibido",
  execute: "Remata",
  multi: "Varios golpes",
  evade: "Esquiva",
};

const DMG_LABEL = { phys: "Físico", magic: "Mágico", true: "Verdadero" } as const;

/** Texto corto de lo que hace un movimiento, para los botones y la ficha. */
export function moveNote(m: Move) {
  const parts: string[] = m.power > 0 ? [DMG_LABEL[m.dmg]] : [];
  for (const f of m.fx) if (!(f === "dash" && !m.priority)) parts.push(FX_LABEL[f]);
  if (m.hits > 1 && !m.fx.includes("multi")) parts.push(`${m.hits} golpes`);
  return parts.join(" · ") || "Golpe";
}

const UTILITY: SpellFx[] = ["shield", "heal", "guard", "buff", "haste", "evade"];

/** Convierte una habilidad oficial en un movimiento según lo que dice su descripción. */
export function spellMove(c: GChamp, s: Spell): Move {
  const ult = s.key === "R";
  const fx = [...s.fx];
  const deals = s.dmg !== "none";
  let power = 0;
  if (deals) {
    power = ult ? 125 + (s.cd >= 120 ? 10 : 0) : 40 + Math.min(24, Math.max(2, s.cd)) * 2.2;
    if (fx.includes("stun")) power *= 0.7;
    if (fx.some((f) => UTILITY.includes(f))) power *= 0.8;
    if (fx.includes("execute")) power *= 0.85;
    if (fx.includes("empower")) power *= 1.2;
  }
  let cooldown = ult ? 4 : s.cd <= 4 ? 0 : s.cd <= 9 ? 1 : s.cd <= 16 ? 2 : 3;
  if (fx.includes("stun") || !deals) cooldown = Math.max(cooldown, 2);
  const multi = fx.includes("multi");
  const dmg = s.dmg === "phys" || s.dmg === "magic" || s.dmg === "true" ? s.dmg : c.magic ? "magic" : "phys";
  return {
    key: s.key,
    name: s.name,
    icon: s.icon,
    power: Math.round(multi ? power * 0.42 : power),
    dmg,
    hits: deals && multi ? 3 : 1,
    cooldown,
    priority: fx.includes("dash") || fx.includes("haste"),
    fx,
    crit: fx.includes("empower"),
  };
}

const BASIC_POWER: Record<Cls, number> = { Marksman: 62, Fighter: 50, Assassin: 50, Tank: 40, Mage: 36, Support: 36 };

export function basicAttack(c: GChamp): Move {
  return { key: "A", name: "Ataque básico", icon: "", power: BASIC_POWER[c.cls], dmg: "phys", hits: 1, cooldown: 0, priority: false, fx: [], crit: true };
}

/** Las cuatro habilidades del campeón (Q, W, E, R) y su ataque básico. */
export function movesOf(c: GChamp): Move[] {
  if (c.tags.includes("Monster")) return monsterMoves(c);
  return [...c.spells.map((s) => spellMove(c, s)), basicAttack(c)];
}

/* ---------- Monstruos de la Grieta ---------- */

export type Drake = "fire" | "water" | "earth" | "air" | "hextech" | "chemtech";
export type MonsterId = "drake" | "herald" | "baron" | "elder";

const CDRAGON = "https://raw.communitydragon.org/16.20/game/assets/characters";

export const DRAKES: Record<Drake, { name: string; breath: string; reward: string; icon: string; color: string }> = {
  fire: {
    name: "Dragón infernal",
    breath: "Aliento infernal",
    reward: "Alma infernal: tu equipo hace un 8 % más de daño.",
    icon: `${CDRAGON}/sru_dragon_fire/hud/dragon_square_fire.png`,
    color: "#e0602a",
  },
  water: {
    name: "Dragón del océano",
    breath: "Torrente oceánico",
    reward: "Alma del océano: tu equipo se cura un 10 % más tras cada combate.",
    icon: `${CDRAGON}/sru_dragon_water/hud/dragon_square_water.png`,
    color: "#2a9ac8",
  },
  earth: {
    name: "Dragón de montaña",
    breath: "Avalancha",
    reward: "Alma de montaña: tu equipo recibe un 7 % menos de daño.",
    icon: `${CDRAGON}/sru_dragon_earth/hud/dragon_square_earth.png`,
    color: "#a0703a",
  },
  air: {
    name: "Dragón de las nubes",
    breath: "Ráfaga de nubes",
    reward: "Alma de las nubes: tu equipo es un 12 % más rápido y actúa antes.",
    icon: `${CDRAGON}/sru_dragon_air/hud/dragon_air_square.png`,
    color: "#9ab8d8",
  },
  hextech: {
    name: "Dragón hextech",
    breath: "Descarga hextech",
    reward: "Alma hextech: +6 % de probabilidad de crítico para tu equipo.",
    icon: `${CDRAGON}/sru_dragon_hextech/hud/icons2d/dragon_square_hextech.png`,
    color: "#3ac8c0",
  },
  chemtech: {
    name: "Dragón quimtech",
    breath: "Niebla quimtech",
    reward: "Alma quimtech: escudos y curaciones un 15 % más fuertes.",
    icon: `${CDRAGON}/sru_dragon_chemtech/hud/icons2d/dragon_square_chemtech.png`,
    color: "#7ac83a",
  },
};

export const MONSTERS: Record<MonsterId, { name: string; hp: number; reward: string; icon: string }> = {
  drake: { name: "Dragón", hp: 1.9, reward: "", icon: DRAKES.fire.icon },
  herald: { name: "Heraldo de la Grieta", hp: 1.6, reward: "Ojo del Heraldo: 400 de oro.", icon: `${CDRAGON}/sru_riftherald/hud/sruriftherald_square.png` },
  baron: { name: "Barón Nashor", hp: 2.6, reward: "Mano del Barón: +30 % de daño hasta vencer al jefe de esta fase.", icon: `${CDRAGON}/sru_baron/hud/baron_square.png` },
  elder: {
    name: "Dragón ancestral",
    hp: 2.8,
    reward: "Ejecución del ancestral: rematas a los rivales que bajen del 15 % de vida, hasta vencer al jefe de esta fase.",
    icon: `${CDRAGON}/sru_dragon_elder/hud/dragon_square_elder.png`,
  },
};

export const monsterName = (id: MonsterId, drake?: Drake) => (id === "drake" && drake ? DRAKES[drake].name : MONSTERS[id].name);
export const monsterIcon = (id: MonsterId, drake?: Drake) => (id === "drake" && drake ? DRAKES[drake].icon : MONSTERS[id].icon);
export const monsterReward = (id: MonsterId, drake?: Drake) => (id === "drake" && drake ? DRAKES[drake].reward : MONSTERS[id].reward);

const mv = (key: MoveKey, name: string, power: number, dmg: Move["dmg"], extra: Partial<Move> = {}): Move => ({
  key,
  name,
  icon: "",
  power,
  dmg,
  hits: 1,
  cooldown: 0,
  priority: false,
  fx: [],
  crit: false,
  ...extra,
});

function monsterMoves(c: GChamp): Move[] {
  const [, id, el] = c.id.split("-") as [string, MonsterId, Drake | undefined];
  if (id === "baron")
    return [mv("Q", "Ácido corrosivo", 85, "magic"), mv("W", "Tentáculos del Vacío", 55, "magic", { fx: ["stun"], cooldown: 3 }), mv("E", "Golpe del Barón", 70, "phys")];
  if (id === "herald") return [mv("Q", "Embestida", 70, "phys", { fx: ["stun"], cooldown: 3 }), mv("W", "Mirada del Heraldo", 60, "magic"), mv("E", "Zarpazo", 55, "phys")];
  if (id === "elder") return [mv("Q", "Aliento ancestral", 85, "true"), mv("W", "Zarpazo", 65, "phys"), mv("E", "Rugido", 35, "magic", { fx: ["slow"], cooldown: 2 })];
  const d = DRAKES[el ?? "fire"];
  const special: Record<Drake, Move> = {
    fire: mv("Q", d.breath, 85, "magic"),
    water: mv("Q", d.breath, 70, "magic", { fx: ["drain"] }),
    earth: mv("Q", d.breath, 70, "phys", { fx: ["stun"], cooldown: 3 }),
    air: mv("Q", d.breath, 70, "magic", { fx: ["haste"], priority: true }),
    hextech: mv("Q", d.breath, 60, "magic", { fx: ["multi"], hits: 2 }),
    chemtech: mv("Q", d.breath, 65, "magic", { fx: ["slow"], cooldown: 1 }),
  };
  return [special[el ?? "fire"], mv("W", "Zarpazo", 60, "phys"), mv("E", "Aleteo", 40, "magic", { fx: ["slow"], cooldown: 2 })];
}

export function monsterChamp(id: MonsterId, stage: number, drake?: Drake): GChamp {
  const m = MONSTERS[id];
  const spell = (key: SpellKey, name: string): Spell => ({ key, name, icon: "", cd: 10, dmg: "magic", fx: [] });
  return {
    id: `monster-${id}${drake ? `-${drake}` : ""}`,
    name: monsterName(id, drake),
    title: "Objetivo de la Grieta",
    cls: "Tank",
    tags: ["Monster"],
    magic: true,
    base: { hp: Math.round(620 * m.hp), ad: 62, ap: 60, ar: 32 + stage * 4, mr: 32 + stage * 4, ms: id === "drake" && drake === "air" ? 400 : 300 },
    icon: `monster:${monsterIcon(id, drake)}`,
    spells: [spell("Q", "Aliento"), spell("W", "Zarpazo"), spell("E", "Aleteo"), spell("R", "Furia")],
  };
}

/* ---------- Mapa ---------- */

export type NodeKind = "fight" | "shop" | "event" | "fountain" | "objective" | "boss";
export type MapNode = { kind: NodeKind; next: number[]; monster?: MonsterId; drake?: Drake; done?: boolean };
export type StageMap = { name: string; city: string; rows: MapNode[][]; /** Equipo jefe de la fase */ boss: string };

export const STAGES = [
  { name: "Play-In", city: "Los Ángeles" },
  { name: "Fase suiza", city: "Allen" },
  { name: "Cuartos", city: "Allen" },
  { name: "Semis", city: "Allen" },
  { name: "Final", city: "Nueva York" },
];

export const stageLevel = (stage: number) => [3, 6, 9, 12, 15][stage] ?? 15;

const DRAKE_LIST = Object.keys(DRAKES) as Drake[];

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
    if (kind === "objective") {
      const x = rand();
      node.monster = stage >= 3 && x < 0.3 ? "elder" : stage >= 2 && x < 0.6 ? "baron" : stage < 2 && x < 0.3 ? "herald" : "drake";
      if (node.monster === "drake") node.drake = pick(DRAKE_LIST);
    }
    nodes.push(node);
  }
  return nodes;
}

/** Mapa de una fase: 4 filas de 2-3 caminos y el jefe al final. */
export function makeStage(stage: number, boss: string): StageMap {
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
  return { ...STAGES[stage], rows, boss };
}

/** Jefes de cada fase: equipos reales, de más débil (Play-In) a más fuerte (final) por ranking. */
function pickBosses(data: GameData, own: string): string[] {
  const teams = data.teams.filter((t) => t.code !== own && t.players.length >= 3);
  const n = teams.length;
  const bands = [
    [0.7, 1],
    [0.45, 0.7],
    [0.25, 0.45],
    [0.1, 0.25],
    [0, 0.1],
  ];
  const used = new Set<string>();
  return bands.map(([lo, hi]) => {
    const slice = teams.slice(Math.floor(lo * n), Math.max(Math.floor(lo * n) + 1, Math.ceil(hi * n))).filter((t) => !used.has(t.code));
    const t = pick(slice.length ? slice : teams.filter((x) => !used.has(x.code)).length ? teams.filter((x) => !used.has(x.code)) : teams);
    used.add(t.code);
    return t.code;
  });
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
  drakes: Drake[];
  baron: boolean;
  elder: boolean;
  /** Último resultado, para la tarjeta final */
  over?: "champion" | "eliminated";
  log: string[];
};

export function newRun(trainer: GPlayer, starter: string, data: GameData): Run {
  const bosses = pickBosses(data, trainer.team);
  return {
    trainer,
    team: [newUnit(starter, stageLevel(0) + 1, data, trainer.role)],
    gold: 500,
    stage: 0,
    row: -1,
    col: 0,
    maps: STAGES.map((_, i) => makeStage(i, bosses[i])),
    wins: 0,
    objectives: 0,
    bosses: 0,
    drakes: [],
    baron: false,
    elder: false,
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

/** Ventajas del equipo por dragones, Barón y Ancestral. */
export function teamBonus(run: Run) {
  const n = (d: Drake) => run.drakes.filter((x) => x === d).length;
  return {
    dmg: (1 + 0.08 * n("fire")) * (run.baron ? 1.3 : 1),
    taken: Math.max(0.6, 1 - 0.07 * n("earth")),
    spd: 1 + 0.12 * n("air"),
    crit: 0.06 * n("hextech"),
    support: (run.trainer.role === "support" ? 1.5 : 1) * (1 + 0.15 * n("chemtech")),
    heal: (run.trainer.role === "support" ? 0.45 : 0.3) + 0.1 * n("water"),
    elder: run.elder,
  };
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
  /** Lo bien que elige sus jugadas (0 = al azar, 1 = la mejor) */
  skill: number;
};

export function rivalTrainer(run: Run, data: GameData): Side {
  const pool = data.players.filter((p) => p.team !== run.trainer.team && p.pool.length);
  const p = pick(pool);
  const n = [1, 2, 2, 3, 3][run.stage] ?? 3;
  const champs = shuffle(p.pool.slice(0, 6)).slice(0, n);
  // Más fuerte cuanto más cerca del jefe.
  const lvl = stageLevel(run.stage) + Math.max(0, run.row - 1);
  return {
    name: p.name,
    team: p.team,
    image: p.image,
    units: champs.map((c) => newUnit(c, Math.max(1, lvl), data)),
    mult: 1 + 0.05 * run.stage,
    skill: 0.55,
  };
}

const BOSS_SIZE = [3, 4, 4, 5, 5];

/** Jefe de la fase: el equipo real que le tocó a esta fase al empezar la partida. */
export function bossTeam(run: Run, data: GameData): Side & { teamData: GTeam } {
  const code = run.maps[run.stage].boss;
  const team = data.teams.find((t) => t.code === code) ?? pick(data.teams.filter((t) => t.code !== run.trainer.team));
  const players = team.players.map((id) => data.players.find((p) => p.id === id)).filter((p): p is GPlayer => !!p && p.pool.length > 0);
  return {
    name: team.name,
    team: team.code,
    image: team.image,
    teamData: team,
    units: shuffle(players)
      .slice(0, BOSS_SIZE[run.stage] ?? 5)
      .map((p) => newUnit(pick(p.pool.slice(0, 3)), Math.min(MAX_LEVEL, stageLevel(run.stage) + 3), data)),
    mult: 1 + 0.07 * run.stage,
    skill: 0.85,
  };
}

export function monsterSide(id: MonsterId, run: Run, data: GameData, drake?: Drake): Side {
  const c = monsterChamp(id, run.stage, drake);
  const unit: Unit = { uid: uid(), champ: c.id, level: Math.min(MAX_LEVEL, stageLevel(run.stage) + 2), hp: 0, items: [], boost: 1 };
  unit.hp = derive(c, unit.level, [], data).hp;
  return { name: c.name, units: [unit], champs: { [c.id]: c }, mult: 1 + 0.05 * run.stage, skill: 0.7 };
}

/* ---------- Combate ---------- */

/** Efectos que duran unos turnos. */
export type Status = { stun: number; slow: number; haste: number; buff: number; guard: number; evade: number; immune: number };
const noStatus = (): Status => ({ stun: 0, slow: 0, haste: 0, buff: 0, guard: 0, evade: 0, immune: 0 });

export type Fighter = {
  unit: Unit;
  champ: GChamp;
  max: Derived;
  hp: number;
  shield: number;
  /** Turnos que le quedan a cada movimiento para estar listo */
  cd: Partial<Record<MoveKey, number>>;
  st: Status;
};

/** Un paso del turno, con la vida de los dos campeones en ese momento, para animarlo. */
export type BEvent = {
  text: string;
  kind: "intro" | "move" | "hit" | "miss" | "heal" | "shield" | "status" | "ko" | "switch" | "end";
  /** Lado que actúa o recibe (0 = tú, 1 = rival) */
  side?: 0 | 1;
  amount?: number;
  crit?: boolean;
  eff?: number;
  snap: { a: number; b: number; ha: number; hb: number; sa: number; sb: number };
};

export type Battle = {
  kind: "fight" | "boss" | "objective";
  monster?: MonsterId;
  drake?: Drake;
  foe: Side;
  mine: Fighter[];
  theirs: Fighter[];
  a: number;
  b: number;
  turn: number;
  /** Lo que ha pasado en el último turno */
  log: BEvent[];
  /** Tu campeón activo ha caído y toca elegir otro */
  mustSwitch: boolean;
  result?: "win" | "lose";
  bonus: ReturnType<typeof teamBonus>;
};

function fighter(u: Unit, c: GChamp, data: GameData, mods: Mods): Fighter {
  const max = derive(c, u.level, u.items, data, mods, u.boost);
  return { unit: u, champ: c, max, hp: Math.min(u.hp, max.hp), shield: 0, cd: {}, st: noStatus() };
}

function say(b: Battle, text: string, kind: BEvent["kind"] = "status", extra: Partial<BEvent> = {}) {
  const A = b.mine[b.a];
  const B = b.theirs[b.b];
  b.log.push({ text, kind, ...extra, snap: { a: b.a, b: b.b, ha: A.hp, hb: B.hp, sa: A.shield, sb: B.shield } });
}

export function startBattle(run: Run, data: GameData, kind: Battle["kind"], foe: Side, monster?: MonsterId, drake?: Drake): Battle {
  const mine = run.team.map((u) => fighter(u, data.champions[u.champ], data, { role: run.trainer.role }));
  const theirs = foe.units.map((u) => {
    const c = foe.champs?.[u.champ] ?? data.champions[u.champ];
    const f = fighter(u, c, data, { mult: foe.mult });
    f.hp = f.max.hp;
    return f;
  });
  const a = Math.max(0, mine.findIndex((f) => f.hp > 0));
  const b: Battle = { kind, monster, drake, foe, mine, theirs, a, b: 0, turn: 0, log: [], mustSwitch: false, bonus: teamBonus(run) };
  say(b, kind === "boss" ? `¡${foe.name} te reta! Es el jefe de ${STAGES[run.stage].name}.` : kind === "objective" ? `¡Aparece el ${foe.name}!` : `¡${foe.name} (${foe.team}) quiere combatir!`, "intro");
  say(b, kind === "objective" ? `¡Adelante, ${mine[a].champ.name}!` : `${foe.name} saca a ${theirs[0].champ.name}. ¡Adelante, ${mine[a].champ.name}!`, "intro");
  return b;
}

export type Action = { type: "move"; key: MoveKey } | { type: "switch"; to: number };

const isMonster = (f: Fighter) => f.champ.tags.includes("Monster");
const nameOf = (f: Fighter, side: 0 | 1) => (side === 0 || isMonster(f) ? f.champ.name : `${f.champ.name} rival`);

/** Velocidad real: ralentizado, acelerado y alma de las nubes. */
function speed(f: Fighter, side: 0 | 1, b: Battle) {
  return f.max.spd * (f.st.slow ? 0.6 : 1) * (f.st.haste ? 1.4 : 1) * (side === 0 ? b.bonus.spd : 1);
}

function statFor(f: Fighter, m: Move) {
  return m.dmg === "magic" ? f.max.ap : m.dmg === "phys" ? f.max.ad : Math.max(f.max.ad, f.max.ap);
}

/** Daño de un golpe sin azar ni crítico, para estimar y para el golpe real. */
function rawDamage(b: Battle, side: 0 | 1, att: Fighter, def: Fighter, m: Move) {
  const res = m.dmg === "true" ? 0 : m.dmg === "magic" ? def.max.mr : def.max.ar;
  const tm = typeMult(isMonster(att) ? "Monster" : att.champ.cls, isMonster(def) ? "Monster" : def.champ.cls);
  const lvl = Math.min(1.6, Math.max(0.65, 1 + 0.05 * (att.unit.level - def.unit.level)));
  const power = m.key === "A" ? m.power * (1 + att.max.as) : m.power;
  const exec = m.fx.includes("execute") ? 1 + (1 - def.hp / def.max.hp) : 1;
  const mine = side === 0 ? b.bonus.dmg : 1;
  const taken = side === 1 ? b.bonus.taken : 1;
  const d = (power / 100) * statFor(att, m) * DMG_K * (100 / (100 + Math.max(0, res))) * tm * lvl * exec * mine * taken * (att.st.buff ? 1.3 : 1) * (def.st.guard ? 0.6 : 1);
  return { d, tm };
}

const DMG_K = 4;

/** Daño aproximado de un movimiento contra el rival actual (para los botones). */
export function estimate(b: Battle, side: 0 | 1, m: Move) {
  const att = side === 0 ? b.mine[b.a] : b.theirs[b.b];
  const def = side === 0 ? b.theirs[b.b] : b.mine[b.a];
  if (m.power <= 0) return { dmg: 0, tm: 1 };
  const { d, tm } = rawDamage(b, side, att, def, m);
  return { dmg: Math.round(d * 0.95 * m.hits), tm };
}

function heal(f: Fighter, amount: number) {
  const before = f.hp;
  f.hp = Math.min(f.max.hp, f.hp + Math.round(amount));
  return f.hp - before;
}

function useMove(b: Battle, side: 0 | 1, move: Move) {
  const me = side === 0 ? b.mine[b.a] : b.theirs[b.b];
  const foe = side === 0 ? b.theirs[b.b] : b.mine[b.a];
  const other = side === 0 ? 1 : 0;
  const who = nameOf(me, side);
  const them = nameOf(foe, other);
  const supp = side === 0 ? b.bonus.support : 1;
  say(b, `${who} usa ${move.name}${/[!?.…]$/.test(move.name) ? "" : "."}`, "move", { side });
  if (move.cooldown) me.cd[move.key] = move.cooldown + 1;

  // Efectos sobre sí mismo
  const solo = move.power <= 0;
  if (move.fx.includes("shield")) {
    me.shield += Math.round(me.max.hp * (solo ? 0.25 : 0.15) * supp);
    say(b, `${who} se cubre con un escudo.`, "shield", { side });
  }
  if (move.fx.includes("heal")) {
    const h = heal(me, me.max.hp * (solo ? 0.28 : 0.15) * supp);
    say(b, h ? `${who} recupera ${h} de vida.` : `${who} ya tenía la vida al máximo.`, "heal", { side, amount: h });
  }
  if (move.fx.includes("guard")) {
    me.st.guard = 2;
    say(b, `${who} se protege: recibirá menos daño.`, "status", { side });
  }
  if (move.fx.includes("buff")) {
    me.st.buff = 3;
    say(b, `${who} se potencia: hará más daño unos turnos.`, "status", { side });
  }
  if (move.fx.includes("haste") && solo) {
    me.st.haste = 3;
    say(b, `${who} gana velocidad.`, "status", { side });
  }
  if (move.fx.includes("evade")) {
    me.st.evade = 2;
    say(b, `${who} se prepara para esquivar el siguiente golpe.`, "status", { side });
  }
  if (move.power <= 0) return;

  if (foe.st.evade) {
    foe.st.evade = 0;
    say(b, `¡${them} lo esquiva!`, "miss", { side: other });
    return;
  }
  let total = 0;
  for (let i = 0; i < move.hits && foe.hp > 0; i++) {
    const { d, tm } = rawDamage(b, side, me, foe, move);
    const critChance = move.crit ? me.max.crit + (side === 0 ? b.bonus.crit : 0) + (move.fx.includes("empower") ? 0.1 : 0) : 0;
    const crit = rand() < critChance;
    const dmg = Math.max(1, Math.round(d * (crit ? 1.75 : 1) * (0.9 + rand() * 0.1)));
    const absorbed = Math.min(foe.shield, dmg);
    foe.shield -= absorbed;
    foe.hp = Math.max(0, foe.hp - (dmg - absorbed));
    total += dmg - absorbed;
    const drain = Math.round((dmg - absorbed) * ((move.fx.includes("drain") ? 0.3 : 0) + me.max.ls) * supp);
    if (drain) heal(me, drain);
    const tags = [crit ? "¡Crítico!" : "", i === 0 && tm > 1 ? "¡Es muy eficaz!" : i === 0 && tm < 1 ? "No es muy eficaz…" : ""].filter(Boolean).join(" ");
    say(b, `${dmg - absorbed} de daño${absorbed ? ` (${absorbed} al escudo)` : ""}.${tags ? ` ${tags}` : ""}${drain ? ` Roba ${drain} de vida.` : ""}`, "hit", {
      side: other,
      amount: dmg - absorbed,
      crit,
      eff: tm,
    });
  }
  // Ejecución del ancestral
  if (side === 0 && b.bonus.elder && foe.hp > 0 && foe.hp < foe.max.hp * 0.15) {
    foe.hp = 0;
    say(b, `¡La ejecución del ancestral remata a ${them}!`, "hit", { side: other });
  }
  if (foe.hp <= 0) {
    say(b, `¡${them} cae!`, "ko", { side: other });
    return;
  }
  if (move.fx.includes("stun")) {
    if (isMonster(foe) || foe.st.immune) say(b, `${them} resiste el control.`, "status", { side: other });
    else {
      foe.st.stun = 1;
      say(b, `¡${them} queda aturdido!`, "status", { side: other });
    }
  }
  if (move.fx.includes("slow")) {
    foe.st.slow = 2;
    say(b, `${them} queda ralentizado.`, "status", { side: other });
  }
  if (move.fx.includes("haste") && !solo) me.st.haste = 2;
  if (total && move.fx.includes("multi") && move.hits > 1) say(b, `¡${move.hits} golpes, ${total} de daño en total!`, "status", { side: other });
}

/** Movimientos disponibles ahora (sin enfriamiento). */
export function readyMoves(f: Fighter): Move[] {
  return movesOf(f.champ).filter((m) => !f.cd[m.key]);
}

/**
 * Elige jugada: rematar si puede; si no, valora el daño frente a la vida que le
 * queda al rival, el control, las curas y escudos cuando hacen falta.
 * skill 1 = elige casi siempre lo mejor; 0 = mucho más al azar.
 */
export function chooseMove(b: Battle, side: 0 | 1, skill = 0.8): Move {
  const me = side === 0 ? b.mine[b.a] : b.theirs[b.b];
  const foe = side === 0 ? b.theirs[b.b] : b.mine[b.a];
  const moves = readyMoves(me);
  const life = me.hp / me.max.hp;
  const scored = moves.map((m) => {
    const { dmg } = estimate(b, side, m);
    const left = foe.hp + foe.shield;
    let v = Math.min(1, dmg / Math.max(1, left)) + (dmg >= left ? 1 + (m.priority ? 0.5 : 0) : 0);
    if (m.fx.includes("stun") && !foe.st.immune && !foe.st.stun && !isMonster(foe)) v += 0.35;
    if (m.fx.includes("slow") && !foe.st.slow) v += 0.08;
    if (m.fx.includes("heal")) v += life < 0.5 ? (1 - life) * 0.9 : 0.02;
    if (m.fx.includes("shield")) v += !me.shield && life < 0.8 ? 0.3 : 0.02;
    if (m.fx.includes("guard")) v += !me.st.guard && life < 0.7 ? 0.3 : 0.02;
    if (m.fx.includes("buff")) v += !me.st.buff && life > 0.4 ? 0.3 : 0;
    if (m.fx.includes("haste") && m.power <= 0) v += !me.st.haste ? 0.12 : 0;
    if (m.fx.includes("evade")) v += !me.st.evade && life < 0.6 ? 0.25 : 0.02;
    if (m.priority && life < 0.35) v += 0.1;
    return { m, v: v * (1 - (1 - skill) * 0.6 * rand()) };
  });
  return scored.sort((x, y) => y.v - x.v)[0]?.m ?? basicAttack(me.champ);
}

const alive = (fs: Fighter[]) => fs.some((f) => f.hp > 0);

function act(b: Battle, side: 0 | 1, m: Move) {
  const me = side === 0 ? b.mine[b.a] : b.theirs[b.b];
  if (me.hp <= 0) return;
  if (me.st.stun) {
    me.st.stun = 0;
    me.st.immune = 2;
    say(b, `${nameOf(me, side)} está aturdido y no puede moverse.`, "status", { side });
    return;
  }
  useMove(b, side, m);
}

/** Resuelve un turno completo con tu acción y la del rival. */
export function playTurn(prev: Battle, action: Action): Battle {
  const b: Battle = structuredClone(prev);
  b.log = [];
  b.turn++;

  if (b.mustSwitch) {
    if (action.type !== "switch") return prev;
    b.a = action.to;
    b.mustSwitch = false;
    say(b, `¡Adelante, ${b.mine[b.a].champ.name}!`, "switch", { side: 0 });
    return b;
  }

  const foeMove = chooseMove(b, 1, b.foe.skill);
  if (action.type === "switch") {
    const out = b.mine[b.a];
    out.shield = 0;
    out.st = noStatus();
    b.a = action.to;
    say(b, `Cambias a ${b.mine[b.a].champ.name}.`, "switch", { side: 0 });
    act(b, 1, foeMove);
  } else {
    const me = b.mine[b.a];
    const myMove = movesOf(me.champ).find((m) => m.key === action.key && !me.cd[m.key]) ?? basicAttack(me.champ);
    const foe = b.theirs[b.b];
    const meFirst =
      myMove.priority !== foeMove.priority ? myMove.priority : speed(me, 0, b) !== speed(foe, 1, b) ? speed(me, 0, b) > speed(foe, 1, b) : rand() < 0.5;
    if (meFirst) {
      act(b, 0, myMove);
      act(b, 1, foeMove);
    } else {
      act(b, 1, foeMove);
      act(b, 0, myMove);
    }
  }
  // Fin del turno: enfriamientos y efectos que se acaban.
  for (const f of [...b.mine, ...b.theirs]) {
    for (const k of Object.keys(f.cd) as MoveKey[]) if (f.cd[k]) f.cd[k]!--;
    for (const k of ["slow", "haste", "buff", "guard", "evade", "immune"] as const) if (f.st[k]) f.st[k]--;
  }

  if (b.theirs[b.b].hp <= 0) {
    const next = b.theirs.findIndex((f) => f.hp > 0);
    if (next < 0) {
      b.result = "win";
      say(b, b.kind === "objective" ? `¡Has asegurado el ${b.foe.name}!` : `¡Has ganado a ${b.foe.name}!`, "end");
    } else {
      b.b = next;
      say(b, `${b.foe.name} saca a ${b.theirs[next].champ.name}.`, "switch", { side: 1 });
    }
  }
  if (!b.result && b.mine[b.a].hp <= 0) {
    if (!alive(b.mine)) {
      b.result = "lose";
      say(b, "No te quedan campeones en pie…", "end");
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
    // Una sola vida: perder un combate es quedar eliminado.
    r.over = "eliminated";
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
    if (b.monster === "drake" && b.drake) r.drakes.push(b.drake);
    if (b.monster === "herald") gold = 400;
    if (b.monster === "baron") r.baron = true;
    if (b.monster === "elder") r.elder = true;
    reward = b.monster ? monsterReward(b.monster, b.drake) : undefined;
  }
  r.gold += gold;
  const heal = teamBonus(r).heal;
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

/** Tras vencer al jefe: siguiente fase, equipo curado; el Barón y el Ancestral se acaban. */
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
  r.elder = false;
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
