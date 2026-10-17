// Motor de "Camino a la Copa": estadísticas, combates por turnos, mapa de
// nodos, tienda, eventos y puntuación. Todo son funciones puras sobre datos
// serializables; las pantallas copian el estado, lo cambian y lo guardan.

import type { Cls, GameData, GChamp, GItem, GPlayer, GTeam, Role, Spell, SpellFx, SpellKey, Stats } from "@/lib/game/types";
import type { Locale } from "@/lib/i18n";

/* ---------- Idioma ---------- */

// Los textos del juego (registro del combate, eventos, tienda) salen en el
// idioma de la página. Solo se cambia en el navegador: en el servidor se queda
// en español para no mezclar peticiones.
let LOC: Locale = "es";

export function setGameLocale(l: Locale) {
  LOC = l;
}

const T = (es: string, en: string) => (LOC === "en" ? en : es);

/** Tabla de textos que devuelve la versión del idioma actual al leerla. */
function localized<K extends string>(es: Record<K, string>, en: Record<K, string>): Record<K, string> {
  return new Proxy(es, { get: (_, k) => (LOC === "en" ? en : es)[k as K] });
}

/* ---------- Azar ---------- */

// Por defecto, Math.random. Con semilla (reto del día o reto de un amigo) el
// azar se repite: misma semilla y mismas decisiones, misma partida.
let rng: () => number = Math.random;

/** mulberry32: generador pequeño y reproducible a partir de un entero. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fija la semilla del azar del juego; sin semilla vuelve a Math.random. */
export function seedRandom(seed?: number) {
  rng = seed === undefined ? Math.random : mulberry32(seed);
}

export const rand = () => rng();
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

export const CLS_LABEL: Record<Cls, string> = localized(
  { Fighter: "Luchador", Tank: "Tanque", Mage: "Mago", Assassin: "Asesino", Marksman: "Tirador", Support: "Soporte" },
  { Fighter: "Fighter", Tank: "Tank", Mage: "Mage", Assassin: "Assassin", Marksman: "Marksman", Support: "Support" },
);

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

export const ROLE_LABEL: Record<Role, string> = localized(
  { top: "Top", jungle: "Jungla", mid: "Mid", bottom: "ADC", support: "Support" },
  { top: "Top", jungle: "Jungle", mid: "Mid", bottom: "ADC", support: "Support" },
);
export const ROLE_PERK: Record<Role, string> = localized(
  {
    top: "Tus campeones tienen un 15 % más de vida.",
    jungle: "Tus campeones actúan primero.",
    mid: "Tus campeones hacen un 15 % más de daño mágico.",
    bottom: "Tus campeones tienen un 15 % más de crítico.",
    support: "Escudos y curaciones un 50 % más fuertes, y curas al equipo tras cada combate.",
  },
  {
    top: "Your champions have 15% more health.",
    jungle: "Your champions act first.",
    mid: "Your champions deal 15% more magic damage.",
    bottom: "Your champions have 15% more crit chance.",
    support: "Shields and heals 50% stronger, and your team heals after every battle.",
  },
);

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

/** Q, W, E, R, el ataque básico (A) y "Proteger" (P, solo en 2v2). */
export type MoveKey = SpellKey | "A" | "P";

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
  /** Golpea a todos los rivales en el campo (2v2) */
  area?: boolean;
};

export const FX_LABEL: Record<SpellFx, string> = localized(
  {
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
    peel: "Protege al compañero",
  },
  {
    stun: "Stuns",
    slow: "Slows",
    shield: "Shield",
    heal: "Heals",
    drain: "Life steal",
    dash: "Strikes first",
    haste: "More speed",
    empower: "Empowered hit",
    buff: "More damage",
    guard: "Less damage taken",
    execute: "Executes",
    multi: "Multi-hit",
    evade: "Dodges",
    peel: "Covers your partner",
  },
);

const DMG_LABEL = localized({ phys: "Físico", magic: "Mágico", true: "Verdadero" }, { phys: "Physical", magic: "Magic", true: "True" });

/** Texto corto de lo que hace un movimiento, para los botones y la ficha. */
export function moveNote(m: Move) {
  const parts: string[] = m.power > 0 ? [DMG_LABEL[m.dmg]] : [];
  for (const f of m.fx) if (!(f === "dash" && !m.priority)) parts.push(FX_LABEL[f]);
  if (m.hits > 1 && !m.fx.includes("multi")) parts.push(T(`${m.hits} golpes`, `${m.hits} hits`));
  return parts.join(" · ") || T("Golpe", "Hit");
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
  return { key: "A", name: T("Ataque básico", "Basic attack"), icon: "", power: BASIC_POWER[c.cls], dmg: "phys", hits: 1, cooldown: 0, priority: false, fx: [], crit: true };
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
    get name() {
      return T("Dragón infernal", "Infernal Drake");
    },
    get breath() {
      return T("Aliento infernal", "Infernal Breath");
    },
    get reward() {
      return T("Alma infernal: tu equipo hace un 8 % más de daño.", "Infernal Soul: your team deals 8% more damage.");
    },
    icon: `${CDRAGON}/sru_dragon_fire/hud/dragon_square_fire.png`,
    color: "#e0602a",
  },
  water: {
    get name() {
      return T("Dragón del océano", "Ocean Drake");
    },
    get breath() {
      return T("Torrente oceánico", "Ocean Torrent");
    },
    get reward() {
      return T("Alma del océano: tu equipo se cura un 10 % más tras cada combate.", "Ocean Soul: your team heals 10% more after every battle.");
    },
    icon: `${CDRAGON}/sru_dragon_water/hud/dragon_square_water.png`,
    color: "#2a9ac8",
  },
  earth: {
    get name() {
      return T("Dragón de montaña", "Mountain Drake");
    },
    get breath() {
      return T("Avalancha", "Avalanche");
    },
    get reward() {
      return T("Alma de montaña: tu equipo recibe un 7 % menos de daño.", "Mountain Soul: your team takes 7% less damage.");
    },
    icon: `${CDRAGON}/sru_dragon_earth/hud/dragon_square_earth.png`,
    color: "#a0703a",
  },
  air: {
    get name() {
      return T("Dragón de las nubes", "Cloud Drake");
    },
    get breath() {
      return T("Ráfaga de nubes", "Cloud Gust");
    },
    get reward() {
      return T("Alma de las nubes: tu equipo es un 12 % más rápido y actúa antes.", "Cloud Soul: your team is 12% faster and acts sooner.");
    },
    icon: `${CDRAGON}/sru_dragon_air/hud/dragon_air_square.png`,
    color: "#9ab8d8",
  },
  hextech: {
    get name() {
      return T("Dragón hextech", "Hextech Drake");
    },
    get breath() {
      return T("Descarga hextech", "Hextech Discharge");
    },
    get reward() {
      return T("Alma hextech: +6 % de probabilidad de crítico para tu equipo.", "Hextech Soul: +6% crit chance for your team.");
    },
    icon: `${CDRAGON}/sru_dragon_hextech/hud/icons2d/dragon_square_hextech.png`,
    color: "#3ac8c0",
  },
  chemtech: {
    get name() {
      return T("Dragón quimtech", "Chemtech Drake");
    },
    get breath() {
      return T("Niebla quimtech", "Chemtech Fog");
    },
    get reward() {
      return T("Alma quimtech: escudos y curaciones un 15 % más fuertes.", "Chemtech Soul: shields and heals 15% stronger.");
    },
    icon: `${CDRAGON}/sru_dragon_chemtech/hud/icons2d/dragon_square_chemtech.png`,
    color: "#7ac83a",
  },
};

export const MONSTERS: Record<MonsterId, { name: string; hp: number; reward: string; icon: string }> = {
  drake: {
    get name() {
      return T("Dragón", "Drake");
    },
    hp: 1.9,
    reward: "",
    icon: DRAKES.fire.icon,
  },
  herald: {
    get name() {
      return T("Heraldo de la Grieta", "Rift Herald");
    },
    hp: 1.6,
    get reward() {
      return T("Ojo del Heraldo: 400 de oro.", "Eye of the Herald: 400 gold.");
    },
    icon: `${CDRAGON}/sru_riftherald/hud/sruriftherald_square.png`,
  },
  baron: {
    get name() {
      return T("Barón Nashor", "Baron Nashor");
    },
    hp: 2.6,
    get reward() {
      return T("Mano del Barón: +30 % de daño hasta vencer al jefe de esta fase.", "Hand of Baron: +30% damage until you beat this stage's boss.");
    },
    icon: `${CDRAGON}/sru_baron/hud/baron_square.png`,
  },
  elder: {
    get name() {
      return T("Dragón ancestral", "Elder Dragon");
    },
    hp: 2.8,
    get reward() {
      return T(
        "Ejecución del ancestral: rematas a los rivales que bajen del 15 % de vida, hasta vencer al jefe de esta fase.",
        "Elder's execute: you finish off enemies below 15% health until you beat this stage's boss.",
      );
    },
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
    return [
      mv("Q", T("Ácido corrosivo", "Corrosive Acid"), 85, "magic", { area: true }),
      mv("W", T("Tentáculos del Vacío", "Void Tentacles"), 55, "magic", { fx: ["stun"], cooldown: 3 }),
      mv("E", T("Golpe del Barón", "Baron Slam"), 70, "phys"),
    ];
  const claw = T("Zarpazo", "Claw");
  if (id === "herald") return [mv("Q", T("Embestida", "Charge"), 70, "phys", { fx: ["stun"], cooldown: 3 }), mv("W", T("Mirada del Heraldo", "Herald's Gaze"), 60, "magic", { area: true }), mv("E", claw, 55, "phys")];
  if (id === "elder") return [mv("Q", T("Aliento ancestral", "Elder Breath"), 85, "true", { area: true }), mv("W", claw, 65, "phys"), mv("E", T("Rugido", "Roar"), 35, "magic", { fx: ["slow"], cooldown: 2 })];
  const d = DRAKES[el ?? "fire"];
  const special: Record<Drake, Move> = {
    fire: mv("Q", d.breath, 85, "magic", { area: true }),
    water: mv("Q", d.breath, 70, "magic", { fx: ["drain"], area: true }),
    earth: mv("Q", d.breath, 70, "phys", { fx: ["stun"], cooldown: 3 }),
    air: mv("Q", d.breath, 70, "magic", { fx: ["haste"], priority: true }),
    hextech: mv("Q", d.breath, 60, "magic", { fx: ["multi"], hits: 2, area: true }),
    chemtech: mv("Q", d.breath, 65, "magic", { fx: ["slow"], cooldown: 1, area: true }),
  };
  return [special[el ?? "fire"], mv("W", claw, 60, "phys"), mv("E", T("Aleteo", "Wing Gust"), 40, "magic", { fx: ["slow"], cooldown: 2 })];
}

export function monsterChamp(id: MonsterId, stage: number, drake?: Drake): GChamp {
  const m = MONSTERS[id];
  const spell = (key: SpellKey, name: string): Spell => ({ key, name, icon: "", cd: 10, dmg: "magic", fx: [] });
  return {
    id: `monster-${id}${drake ? `-${drake}` : ""}`,
    name: monsterName(id, drake),
    title: T("Objetivo de la Grieta", "Rift objective"),
    cls: "Tank",
    tags: ["Monster"],
    magic: true,
    base: { hp: Math.round(620 * m.hp), ad: 62, ap: 60, ar: 32 + stage * 4, mr: 32 + stage * 4, ms: id === "drake" && drake === "air" ? 400 : 300 },
    icon: `monster:${monsterIcon(id, drake)}`,
    spells: [spell("Q", T("Aliento", "Breath")), spell("W", T("Zarpazo", "Claw")), spell("E", T("Aleteo", "Wing Gust")), spell("R", T("Furia", "Fury"))],
  };
}

/* ---------- Mapa ---------- */

export type NodeKind = "fight" | "shop" | "event" | "fountain" | "objective" | "boss";
export type MapNode = { kind: NodeKind; next: number[]; monster?: MonsterId; drake?: Drake; done?: boolean };
export type StageMap = { name: string; city: string; rows: MapNode[][]; /** Equipo jefe de la fase */ boss: string };

const stage = (es: [string, string], en: [string, string]) => ({
  get name() {
    return T(es[0], en[0]);
  },
  get city() {
    return T(es[1], en[1]);
  },
});

export const STAGES = [
  stage(["Play-In", "Los Ángeles"], ["Play-In", "Los Angeles"]),
  stage(["Fase suiza", "Allen"], ["Swiss stage", "Allen"]),
  stage(["Cuartos", "Allen"], ["Quarters", "Allen"]),
  stage(["Semis", "Allen"], ["Semis", "Allen"]),
  stage(["Final", "Nueva York"], ["Final", "New York"]),
];

/**
 * Dificultad por fase. Con una sola vida, el Play-In se pasa casi siempre y
 * cada fase aprieta más: niveles, tamaño y fuerza de rivales y jefes.
 */
// Ajustado con 900 partidas simuladas con datos reales y un jugador que elige
// bien: pasa el Play-In un 80 %, llega a la final un 16 % y gana un 5 %.
export const DIFFICULTY = {
  startLevel: 5,
  stageLevel: [2, 6, 10, 13, 15],
  rivalSize: [1, 2, 2, 3, 3],
  rivalMult: [1, 1.06, 1.12, 1.16, 1.2],
  bossSize: [3, 4, 4, 5, 5],
  bossLevel: [1, 3, 3, 3, 3],
  bossMult: [1, 1.1, 1.25, 1.34, 1.28],
  monsterLevel: 2,
  dmgK: 4,
  /** 2v2 de línea inferior: campeones de más en los rivales y vida de los monstruos */
  duo: { rivalExtra: 1, bossExtra: 0, monsterHp: 1.7 },
};

export const stageLevel = (stage: number) => DIFFICULTY.stageLevel[stage] ?? DIFFICULTY.stageLevel.at(-1)!;

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
  return { name: STAGES[stage].name, city: STAGES[stage].city, rows, boss };
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
  /** Pareja de línea (support si eres ADC y al revés): con ella se juega 2v2 */
  partner?: GPlayer;
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
  /** Quién te eliminó, para el mensaje final */
  killer?: string;
  log: string[];
  /** Semilla de la partida, para que otros jueguen la misma */
  seed?: number;
  /** Número del reto del día, si lo es */
  daily?: number;
};

/** ADC y support juegan en pareja (2v2); el resto, 1v1. */
export const isDuoRole = (r: Role) => r === "bottom" || r === "support";
export const isDuo = (run: Run) => !!run.partner;

/** Compañero de línea inferior de un jugador: el support de su equipo si es ADC, y al revés. */
export function laneMate(p: GPlayer, data: GameData): GPlayer | undefined {
  if (!isDuoRole(p.role)) return undefined;
  const want: Role = p.role === "bottom" ? "support" : "bottom";
  const starters = data.teams.find((t) => t.code === p.team)?.players ?? [];
  const mates = data.players.filter((x) => x.team === p.team && x.role === want && x.pool.some((c) => data.champions[c]));
  return mates.find((x) => starters.includes(x.id)) ?? mates[0];
}

/** Campeones de la pool de un jugador con datos, para elegir al empezar. */
export const poolChoices = (p: GPlayer, data: GameData, n = 3) => p.pool.filter((c) => data.champions[c]).slice(0, n);

export function newRun(trainer: GPlayer, starter: string, data: GameData, seed?: number, daily?: number, mateChamp?: string): Run {
  const bosses = pickBosses(data, trainer.team);
  const partner = mateChamp ? laneMate(trainer, data) : undefined;
  return {
    trainer,
    partner,
    team: [starter, ...(partner && mateChamp ? [mateChamp] : [])].map((c) => newUnit(c, DIFFICULTY.startLevel, data, trainer.role)),
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
    seed,
    daily,
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
  /** Pareja de línea del rival en 2v2 (su nombre ya va en name) */
  mate?: string;
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
  const duo = isDuo(run);
  const pool = data.players.filter((p) => p.team !== run.trainer.team && p.pool.length);
  // En 2v2, otra pareja de línea inferior.
  const bots = duo ? pool.filter((p) => p.role === "bottom" && laneMate(p, data)) : [];
  const p = pick(bots.length ? bots : pool);
  const mate = duo ? laneMate(p, data) : undefined;
  const n = (DIFFICULTY.rivalSize[run.stage] ?? 3) + (duo ? DIFFICULTY.duo.rivalExtra : 0);
  let champs = shuffle(p.pool.slice(0, 6)).slice(0, n);
  if (mate) {
    // Alternan los de cada uno: el primero de cada pool sale al campo.
    const a = shuffle(p.pool.filter((c) => data.champions[c]).slice(0, 6));
    const s = shuffle(mate.pool.filter((c) => data.champions[c] && !a.includes(c)).slice(0, 6));
    champs = Array.from({ length: Math.max(a.length, s.length) }, (_, i) => [a[i], s[i]])
      .flat()
      .filter((c): c is string => !!c)
      .slice(0, n);
  }
  // Más fuerte cuanto más cerca del jefe.
  const lvl = stageLevel(run.stage) + Math.max(0, run.row - 1);
  return {
    name: mate ? `${p.name} & ${mate.name}` : p.name,
    mate: mate?.name,
    team: p.team,
    image: p.image,
    units: champs.map((c) => newUnit(c, Math.max(1, lvl), data)),
    mult: DIFFICULTY.rivalMult[run.stage] ?? 1,
    skill: 0.55,
  };
}

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
      .slice(0, (DIFFICULTY.bossSize[run.stage] ?? 5) + (isDuo(run) ? DIFFICULTY.duo.bossExtra : 0))
      .map((p) => newUnit(pick(p.pool.slice(0, 3)), Math.min(MAX_LEVEL, stageLevel(run.stage) + (DIFFICULTY.bossLevel[run.stage] ?? 3)), data)),
    mult: DIFFICULTY.bossMult[run.stage] ?? 1,
    skill: 0.85,
  };
}

export function monsterSide(id: MonsterId, run: Run, data: GameData, drake?: Drake): Side {
  const c = monsterChamp(id, run.stage, drake);
  // En 2v2 se enfrenta a dos campeones a la vez: más vida.
  if (isDuo(run)) c.base.hp = Math.round(c.base.hp * DIFFICULTY.duo.monsterHp);
  const unit: Unit = { uid: uid(), champ: c.id, level: Math.min(MAX_LEVEL, stageLevel(run.stage) + DIFFICULTY.monsterLevel), hp: 0, items: [], boost: 1 };
  unit.hp = derive(c, unit.level, [], data).hp;
  return { name: c.name, units: [unit], champs: { [c.id]: c }, mult: DIFFICULTY.rivalMult[run.stage] ?? 1, skill: 0.7 };
}

/* ---------- Combate ---------- */

/** Efectos que duran unos turnos. */
export type Status = { stun: number; slow: number; haste: number; buff: number; guard: number; evade: number; immune: number; peel: number };
const noStatus = (): Status => ({ stun: 0, slow: 0, haste: 0, buff: 0, guard: 0, evade: 0, immune: 0, peel: 0 });

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

/** Foto del campo en un paso del turno: quién está en cada hueco, vida y escudo de todos. */
export type Snap = { on: [number[], number[]]; hp: [number[], number[]]; sh: [number[], number[]] };

/** Un paso del turno, con la vida de todos los campeones en ese momento, para animarlo. */
export type BEvent = {
  text: string;
  kind: "intro" | "move" | "hit" | "miss" | "heal" | "shield" | "status" | "ko" | "switch" | "end";
  /** Lado que actúa o recibe (0 = tú, 1 = rival) */
  side?: 0 | 1;
  /** Campeón de ese lado (índice en su equipo) */
  who?: number;
  amount?: number;
  crit?: boolean;
  eff?: number;
  snap: Snap;
};

export type Battle = {
  kind: "fight" | "boss" | "objective";
  monster?: MonsterId;
  drake?: Drake;
  foe: Side;
  mine: Fighter[];
  theirs: Fighter[];
  /** Campeones en el campo de cada lado (índice en su equipo; -1 = hueco vacío). Uno en 1v1, dos en 2v2. */
  on: [number[], number[]];
  /** Línea inferior: 2v2 con tu pareja de línea */
  duo: boolean;
  turn: number;
  /** Lo que ha pasado en el último turno */
  log: BEvent[];
  /** Ha caído un campeón tuyo y toca sacar otro del banquillo */
  mustSwitch: boolean;
  result?: "win" | "lose";
  bonus: ReturnType<typeof teamBonus>;
};

function fighter(u: Unit, c: GChamp, data: GameData, mods: Mods): Fighter {
  const max = derive(c, u.level, u.items, data, mods, u.boost);
  return { unit: u, champ: c, max, hp: Math.min(u.hp, max.hp), shield: 0, cd: {}, st: noStatus() };
}

export const sideOf = (b: Battle, side: 0 | 1) => (side === 0 ? b.mine : b.theirs);

/** Índices de los campeones en pie que están en el campo. */
export function fieldAlive(b: Battle, side: 0 | 1): number[] {
  const fs = sideOf(b, side);
  return b.on[side].filter((i) => i >= 0 && fs[i].hp > 0);
}

/** Campeones en pie en el banquillo, que pueden entrar. */
export function bench(b: Battle, side: 0 | 1): number[] {
  return sideOf(b, side)
    .map((f, i) => (f.hp > 0 && !b.on[side].includes(i) ? i : -1))
    .filter((i) => i >= 0);
}

function say(b: Battle, text: string, kind: BEvent["kind"] = "status", extra: Partial<BEvent> = {}) {
  b.log.push({
    text,
    kind,
    ...extra,
    snap: { on: [[...b.on[0]], [...b.on[1]]], hp: [b.mine.map((f) => f.hp), b.theirs.map((f) => f.hp)], sh: [b.mine.map((f) => f.shield), b.theirs.map((f) => f.shield)] },
  });
}

const and = (xs: string[]) => xs.join(T(" y ", " and "));

export function startBattle(run: Run, data: GameData, kind: Battle["kind"], foe: Side, monster?: MonsterId, drake?: Drake): Battle {
  const mine = run.team.map((u) => fighter(u, data.champions[u.champ], data, { role: run.trainer.role }));
  const theirs = foe.units.map((u) => {
    const c = foe.champs?.[u.champ] ?? data.champions[u.champ];
    const f = fighter(u, c, data, { mult: foe.mult });
    f.hp = f.max.hp;
    return f;
  });
  const duo = isDuo(run);
  const slots = duo ? 2 : 1;
  const first = (fs: Fighter[]) => {
    const out = fs.map((f, i) => (f.hp > 0 ? i : -1)).filter((i) => i >= 0).slice(0, slots);
    while (out.length < slots) out.push(-1);
    return out;
  };
  const on: [number[], number[]] = [first(mine), first(theirs)];
  if (on[0][0] < 0) on[0][0] = 0;
  const b: Battle = { kind, monster, drake, foe, mine, theirs, on, duo, turn: 0, log: [], mustSwitch: false, bonus: teamBonus(run) };
  const pair = !!foe.mate;
  say(
    b,
    kind === "boss"
      ? T(`¡${foe.name} te reta! Es el jefe de ${STAGES[run.stage].name}.`, `${foe.name} challenges you! They're the ${STAGES[run.stage].name} boss.`)
      : kind === "objective"
        ? T(`¡Aparece el ${foe.name}!`, `The ${foe.name} appears!`)
        : T(`¡${foe.name} (${foe.team}) ${pair ? "quieren" : "quiere"} combatir!`, `${foe.name} (${foe.team}) ${pair ? "want" : "wants"} to battle!`),
    "intro",
  );
  const go = and(fieldAlive(b, 0).map((i) => mine[i].champ.name));
  const out = and(fieldAlive(b, 1).map((i) => theirs[i].champ.name));
  say(b, kind === "objective" ? T(`¡Adelante, ${go}!`, `Go, ${go}!`) : T(`${foe.name} ${pair ? "sacan" : "saca"} a ${out}. ¡Adelante, ${go}!`, `${foe.name} ${pair ? "send" : "sends"} out ${out}. Go, ${go}!`), "intro");
  return b;
}

/**
 * Orden para un campeón: un movimiento (con el hueco al que apunta: rival si
 * hace daño, aliado si es de apoyo) o un cambio por uno del banquillo.
 */
export type Order = { type: "move"; key: MoveKey; target?: number } | { type: "switch"; to: number };
/** En 1v1, una orden; en 2v2, una por hueco tuyo en el campo. */
export type Action = Order | { type: "duo"; orders: Order[] };

const isMonster = (f: Fighter) => f.champ.tags.includes("Monster");
const nameOf = (f: Fighter, side: 0 | 1) => (side === 0 || isMonster(f) ? f.champ.name : T(`${f.champ.name} rival`, `Enemy ${f.champ.name}`));

/** "Proteger": en 2v2 te pones delante y recibes los golpes dirigidos a tu compañero este turno. */
export function peelMove(): Move {
  return { key: "P", name: T("Proteger", "Peel"), icon: "", power: 0, dmg: "phys", hits: 1, cooldown: 1, priority: true, fx: ["peel"], crit: false };
}

/** Movimientos del campeón en este combate: en 2v2 se suma "Proteger". */
export function battleMoves(b: Battle, f: Fighter): Move[] {
  const ms = movesOf(f.champ);
  return b.duo && !isMonster(f) ? [...ms, peelMove()] : ms;
}

const ALLY_FX: SpellFx[] = ["shield", "heal", "buff", "haste", "guard"];
/** Movimiento de apoyo sin daño: en 2v2 se lanza sobre el aliado que elijas. */
export const allyMove = (m: Move) => m.power <= 0 && m.fx.some((f) => ALLY_FX.includes(f));

/** Velocidad real: ralentizado, acelerado y alma de las nubes. */
function speed(f: Fighter, side: 0 | 1, b: Battle) {
  return f.max.spd * (f.st.slow ? 0.6 : 1) * (f.st.haste ? 1.4 : 1) * (side === 0 ? b.bonus.spd : 1);
}

function statFor(f: Fighter, m: Move) {
  return m.dmg === "magic" ? f.max.ap : m.dmg === "phys" ? f.max.ad : Math.max(f.max.ad, f.max.ap);
}

/** En 2v2 los golpes en área reparten: cada objetivo recibe menos. */
const SPREAD = 0.75;
/** El que protege a su compañero recibe el golpe algo amortiguado. */
const PEEL_TAKEN = 0.75;

/** Daño de un golpe sin azar ni crítico, para estimar y para el golpe real. */
function rawDamage(b: Battle, side: 0 | 1, att: Fighter, def: Fighter, m: Move) {
  const res = m.dmg === "true" ? 0 : m.dmg === "magic" ? def.max.mr : def.max.ar;
  const tm = typeMult(isMonster(att) ? "Monster" : att.champ.cls, isMonster(def) ? "Monster" : def.champ.cls);
  const lvl = Math.min(1.6, Math.max(0.65, 1 + 0.05 * (att.unit.level - def.unit.level)));
  const power = m.key === "A" ? m.power * (1 + att.max.as) : m.power;
  const exec = m.fx.includes("execute") ? 1 + (1 - def.hp / def.max.hp) : 1;
  const mine = side === 0 ? b.bonus.dmg : 1;
  const taken = side === 1 ? b.bonus.taken : 1;
  const d = (power / 100) * statFor(att, m) * DIFFICULTY.dmgK * (100 / (100 + Math.max(0, res))) * tm * lvl * exec * mine * taken * (att.st.buff ? 1.3 : 1) * (def.st.guard ? 0.6 : 1);
  return { d, tm };
}

/** Daño aproximado de un movimiento de un campeón contra el que ocupa un hueco rival (para los botones). */
export function estimate(b: Battle, side: 0 | 1, i: number, m: Move, slot = 0) {
  const other = side === 0 ? 1 : 0;
  const att = sideOf(b, side)[i];
  const def = sideOf(b, other)[b.on[other][slot] ?? -1] ?? sideOf(b, other)[fieldAlive(b, other)[0]];
  if (m.power <= 0 || !att || !def) return { dmg: 0, tm: 1 };
  const { d, tm } = rawDamage(b, side, att, def, m);
  const spread = m.area && fieldAlive(b, other).length > 1 ? SPREAD : 1;
  return { dmg: Math.round(d * 0.95 * m.hits * spread), tm };
}

function heal(f: Fighter, amount: number) {
  const before = f.hp;
  f.hp = Math.min(f.max.hp, f.hp + Math.round(amount));
  return f.hp - before;
}

/** Un golpe de un movimiento sobre un campeón rival. */
function strike(b: Battle, side: 0 | 1, me: Fighter, t: number, move: Move, mult: number) {
  const other = side === 0 ? 1 : 0;
  const foe = sideOf(b, other)[t];
  const them = nameOf(foe, other);
  const supp = side === 0 ? b.bonus.support : 1;
  if (foe.st.evade) {
    foe.st.evade = 0;
    say(b, T(`¡${them} lo esquiva!`, `${them} dodged it!`), "miss", { side: other, who: t });
    return;
  }
  let total = 0;
  for (let i = 0; i < move.hits && foe.hp > 0; i++) {
    const { d, tm } = rawDamage(b, side, me, foe, move);
    const critChance = move.crit ? me.max.crit + (side === 0 ? b.bonus.crit : 0) + (move.fx.includes("empower") ? 0.1 : 0) : 0;
    const crit = rand() < critChance;
    const dmg = Math.max(1, Math.round(d * mult * (crit ? 1.75 : 1) * (0.9 + rand() * 0.1)));
    const absorbed = Math.min(foe.shield, dmg);
    foe.shield -= absorbed;
    foe.hp = Math.max(0, foe.hp - (dmg - absorbed));
    total += dmg - absorbed;
    const drain = Math.round((dmg - absorbed) * ((move.fx.includes("drain") ? 0.3 : 0) + me.max.ls) * supp);
    if (drain) heal(me, drain);
    const tags = [
      crit ? T("¡Crítico!", "Critical hit!") : "",
      i === 0 && tm > 1 ? T("¡Es muy eficaz!", "It's super effective!") : i === 0 && tm < 1 ? T("No es muy eficaz…", "It's not very effective…") : "",
    ]
      .filter(Boolean)
      .join(" ");
    const hit = dmg - absorbed;
    // En 2v2 se dice a quién se golpea.
    const to = b.duo ? T(`${them}: `, `${them}: `) : "";
    const line = T(
      `${to}${hit} de daño${absorbed ? ` (${absorbed} al escudo)` : ""}.${tags ? ` ${tags}` : ""}${drain ? ` Roba ${drain} de vida.` : ""}`,
      `${to}${hit} damage${absorbed ? ` (${absorbed} to the shield)` : ""}.${tags ? ` ${tags}` : ""}${drain ? ` Steals ${drain} health.` : ""}`,
    );
    say(b, line, "hit", { side: other, who: t, amount: hit, crit, eff: tm });
  }
  // Ejecución del ancestral
  if (side === 0 && b.bonus.elder && foe.hp > 0 && foe.hp < foe.max.hp * 0.15) {
    foe.hp = 0;
    say(b, T(`¡La ejecución del ancestral remata a ${them}!`, `The Elder's execute finishes off ${them}!`), "hit", { side: other, who: t });
  }
  if (foe.hp <= 0) {
    say(b, T(`¡${them} cae!`, `${them} fainted!`), "ko", { side: other, who: t });
    return;
  }
  if (move.fx.includes("stun")) {
    if (isMonster(foe) || foe.st.immune) say(b, T(`${them} resiste el control.`, `${them} resists the crowd control.`), "status", { side: other, who: t });
    else {
      foe.st.stun = 1;
      say(b, T(`¡${them} queda aturdido!`, `${them} is stunned!`), "status", { side: other, who: t });
    }
  }
  if (move.fx.includes("slow")) {
    foe.st.slow = 2;
    say(b, T(`${them} queda ralentizado.`, `${them} is slowed.`), "status", { side: other, who: t });
  }
  if (total && move.fx.includes("multi") && move.hits > 1) say(b, T(`¡${move.hits} golpes, ${total} de daño en total!`, `Hit ${move.hits} times, ${total} damage in total!`), "status", { side: other, who: t });
}

function useMove(b: Battle, side: 0 | 1, i: number, move: Move, slot?: number) {
  const team = sideOf(b, side);
  const me = team[i];
  const other = side === 0 ? 1 : 0;
  const who = nameOf(me, side);
  const supp = side === 0 ? b.bonus.support : 1;
  const end = /[!?.…]$/.test(move.name) ? "" : T(".", "!");
  say(b, T(`${who} usa ${move.name}${end}`, `${who} used ${move.name}${end}`), "move", { side, who: i });
  if (move.cooldown) me.cd[move.key] = move.cooldown + 1;

  if (move.fx.includes("peel")) {
    me.st.peel = 1;
    say(b, T(`${who} se pone delante de su compañero.`, `${who} steps in front of their partner.`), "shield", { side, who: i });
    return;
  }

  // Efectos de apoyo: sobre sí mismo o, en 2v2, sobre el aliado elegido.
  const solo = move.power <= 0;
  let ai = i;
  if (b.duo && allyMove(move) && slot !== undefined) {
    const k = b.on[side][slot];
    if (k !== undefined && k >= 0 && team[k].hp > 0) ai = k;
  }
  const ally = team[ai];
  const an = nameOf(ally, side);
  const self = ai === i;
  if (move.fx.includes("shield")) {
    ally.shield += Math.round(ally.max.hp * (solo ? 0.25 : 0.15) * supp);
    say(b, self ? T(`${who} se cubre con un escudo.`, `${who} shields up.`) : T(`${who} protege a ${an} con un escudo.`, `${who} shields ${an}.`), "shield", { side, who: ai });
  }
  if (move.fx.includes("heal")) {
    const h = heal(ally, ally.max.hp * (solo ? 0.28 : 0.15) * supp);
    say(
      b,
      h
        ? self
          ? T(`${who} recupera ${h} de vida.`, `${who} restores ${h} health.`)
          : T(`${who} cura ${h} de vida a ${an}.`, `${who} heals ${an} for ${h}.`)
        : T(`${an} ya tenía la vida al máximo.`, `${an} was already at full health.`),
      "heal",
      { side, who: ai, amount: h },
    );
  }
  if (move.fx.includes("guard")) {
    ally.st.guard = 2;
    say(b, T(`${an} se protege: recibirá menos daño.`, `${an} braces: it will take less damage.`), "status", { side, who: ai });
  }
  if (move.fx.includes("buff")) {
    ally.st.buff = 3;
    say(b, T(`${an} se potencia: hará más daño unos turnos.`, `${an} powers up: more damage for a few turns.`), "status", { side, who: ai });
  }
  if (move.fx.includes("haste") && solo) {
    ally.st.haste = 3;
    say(b, T(`${an} gana velocidad.`, `${an} speeds up.`), "status", { side, who: ai });
  }
  if (move.fx.includes("evade")) {
    me.st.evade = 2;
    say(b, T(`${who} se prepara para esquivar el siguiente golpe.`, `${who} gets ready to dodge the next hit.`), "status", { side, who: i });
  }
  if (solo) return;

  const foes = sideOf(b, other);
  const alive = fieldAlive(b, other);
  if (!alive.length) return;
  if (move.area && alive.length > 1) {
    for (const t of alive) strike(b, side, me, t, move, SPREAD);
  } else {
    // Si el objetivo ya no está, el golpe va al otro rival.
    let t = slot !== undefined && alive.includes(b.on[other][slot]) ? b.on[other][slot] : alive[0];
    let mult = 1;
    const guard = alive.find((k) => k !== t && foes[k].st.peel);
    if (guard !== undefined) {
      t = guard;
      mult = PEEL_TAKEN;
      say(b, T(`¡${nameOf(foes[t], other)} se interpone y recibe el golpe!`, `${nameOf(foes[t], other)} jumps in and takes the hit!`), "status", { side: other, who: t });
    }
    strike(b, side, me, t, move, mult);
  }
  if (move.fx.includes("haste")) me.st.haste = 2;
}

/** Movimientos disponibles ahora (sin enfriamiento). */
export function readyMoves(b: Battle, f: Fighter): Move[] {
  return battleMoves(b, f).filter((m) => !f.cd[m.key]);
}

/** Lo que vale un efecto de apoyo según cómo está quien lo recibe. */
function supportValue(m: Move, f: Fighter) {
  const life = f.hp / f.max.hp;
  let v = 0;
  if (m.fx.includes("heal")) v += life < 0.5 ? (1 - life) * 0.9 : 0.02;
  if (m.fx.includes("shield")) v += !f.shield && life < 0.8 ? 0.3 : 0.02;
  if (m.fx.includes("guard")) v += !f.st.guard && life < 0.7 ? 0.3 : 0.02;
  if (m.fx.includes("buff")) v += !f.st.buff && life > 0.4 ? 0.3 + Math.min(0.15, f.max.ad / 2000) : 0;
  if (m.fx.includes("haste") && m.power <= 0) v += !f.st.haste ? 0.12 : 0;
  return v;
}

/**
 * Elige la orden de un campeón: rematar si puede; si no, valora el daño frente
 * a la vida que le queda a cada rival, el control, y las curas, escudos y
 * "Proteger" cuando el compañero los necesita.
 * skill 1 = elige casi siempre lo mejor; 0 = mucho más al azar.
 */
export function chooseOrder(b: Battle, side: 0 | 1, i: number, skill = 0.8): Order {
  const team = sideOf(b, side);
  const me = team[i];
  const other = side === 0 ? 1 : 0;
  const foes = sideOf(b, other);
  const life = me.hp / me.max.hp;
  const mySlot = b.on[side].indexOf(i);
  const mates = b.on[side].map((k, s) => ({ k, s })).filter(({ k }) => k >= 0 && k !== i && team[k].hp > 0);
  const targets = b.on[other].map((k, s) => ({ k, s })).filter(({ k }) => k >= 0 && foes[k].hp > 0);
  const opts: { o: Order; v: number }[] = [];
  for (const m of readyMoves(b, me)) {
    if (m.fx.includes("peel")) {
      const mate = mates[0];
      if (!mate) continue;
      const ml = team[mate.k].hp / team[mate.k].max.hp;
      opts.push({ o: { type: "move", key: m.key }, v: ml < 0.45 && life > 0.5 && !me.cd.P ? 0.45 : 0 });
      continue;
    }
    if (m.power <= 0) {
      // Apoyo: sobre sí mismo o sobre el compañero que más lo necesite.
      const on = b.duo && allyMove(m) ? [{ k: i, s: mySlot }, ...mates] : [{ k: i, s: mySlot }];
      for (const { k, s } of on) opts.push({ o: { type: "move", key: m.key, target: s }, v: supportValue(m, team[k]) + (m.fx.includes("evade") && !me.st.evade && life < 0.6 ? 0.25 : 0) });
      continue;
    }
    for (const { k, s } of m.area ? targets.slice(0, 1) : targets) {
      const foe = foes[k];
      const hitAll = m.area ? targets : [{ k, s }];
      let v = 0;
      for (const h of hitAll) {
        const f = foes[h.k];
        const { dmg } = estimate(b, side, i, m, h.s);
        const left = f.hp + f.shield;
        v += Math.min(1, dmg / Math.max(1, left)) + (dmg >= left ? 1 + (m.priority ? 0.5 : 0) : 0);
      }
      if (m.fx.includes("stun") && !foe.st.immune && !foe.st.stun && !isMonster(foe)) v += 0.35;
      if (m.fx.includes("slow") && !foe.st.slow) v += 0.08;
      v += supportValue(m, me);
      if (m.fx.includes("evade")) v += !me.st.evade && life < 0.6 ? 0.25 : 0.02;
      if (m.priority && life < 0.35) v += 0.1;
      opts.push({ o: { type: "move", key: m.key, target: s }, v });
    }
  }
  const scored = opts.map((x) => ({ ...x, v: x.v * (1 - (1 - skill) * 0.6 * rand()) }));
  return scored.sort((x, y) => y.v - x.v)[0]?.o ?? { type: "move", key: "A", target: targets[0]?.s };
}

const alive = (fs: Fighter[]) => fs.some((f) => f.hp > 0);

function act(b: Battle, side: 0 | 1, i: number, m: Move, slot?: number) {
  const me = sideOf(b, side)[i];
  if (me.hp <= 0 || !b.on[side].includes(i)) return;
  if (me.st.stun) {
    me.st.stun = 0;
    me.st.immune = 2;
    say(b, T(`${nameOf(me, side)} está aturdido y no puede moverse.`, `${nameOf(me, side)} is stunned and can't move.`), "status", { side, who: i });
    return;
  }
  if (m.power > 0 && !fieldAlive(b, side === 0 ? 1 : 0).length) return;
  useMove(b, side, i, m, slot);
}

/** Resuelve un turno completo con tus órdenes y las del rival. */
export function playTurn(prev: Battle, action: Action): Battle {
  const b: Battle = structuredClone(prev);
  b.log = [];
  b.turn++;
  const orders = action.type === "duo" ? action.orders : [action];

  // Toca rellenar un hueco: entra el campeón elegido sin gastar turno.
  if (b.mustSwitch) {
    const o = orders.find((x) => x.type === "switch");
    if (!o || o.type !== "switch" || !bench(b, 0).includes(o.to)) return prev;
    const slot = b.on[0].findIndex((k) => k < 0 || b.mine[k].hp <= 0);
    b.on[0][slot < 0 ? 0 : slot] = o.to;
    say(b, T(`¡Adelante, ${b.mine[o.to].champ.name}!`, `Go, ${b.mine[o.to].champ.name}!`), "switch", { side: 0, who: o.to });
    b.mustSwitch = b.on[0].some((k) => k < 0 || b.mine[k].hp <= 0) && bench(b, 0).length > 0;
    return b;
  }

  type Plan = { side: 0 | 1; i: number; m: Move; slot?: number; r: number };
  const plans: Plan[] = [];
  const foeOrders = fieldAlive(b, 1).map((i) => ({ i, o: chooseOrder(b, 1, i, b.foe.skill) }));

  // Primero, los cambios.
  const entering = new Set<number>();
  b.on[0].forEach((i, s) => {
    const o = orders[s];
    if (i < 0 || b.mine[i].hp <= 0 || !o) return;
    if (o.type === "switch") {
      if (!bench(b, 0).includes(o.to) || entering.has(o.to)) return;
      entering.add(o.to);
      const out = b.mine[i];
      out.shield = 0;
      out.st = noStatus();
      b.on[0][s] = o.to;
      say(b, T(`Retiras a ${out.champ.name} y sacas a ${b.mine[o.to].champ.name}.`, `You pull back ${out.champ.name} and send out ${b.mine[o.to].champ.name}.`), "switch", { side: 0, who: o.to });
      return;
    }
    const me = b.mine[i];
    const m = battleMoves(b, me).find((x) => x.key === o.key && !me.cd[x.key]) ?? basicAttack(me.champ);
    plans.push({ side: 0, i, m, slot: o.target, r: rand() });
  });
  for (const { i, o } of foeOrders) {
    if (o.type !== "move") continue;
    const f = b.theirs[i];
    const m = battleMoves(b, f).find((x) => x.key === o.key) ?? basicAttack(f.champ);
    plans.push({ side: 1, i, m, slot: o.target, r: rand() });
  }

  // Luego, los movimientos: prioridad y después velocidad.
  const spd = (p: Plan) => speed(sideOf(b, p.side)[p.i], p.side, b);
  plans.sort((x, y) => Number(y.m.priority) - Number(x.m.priority) || spd(y) - spd(x) || x.r - y.r);
  for (const p of plans) act(b, p.side, p.i, p.m, p.slot);

  // Fin del turno: enfriamientos y efectos que se acaban.
  for (const f of [...b.mine, ...b.theirs]) {
    for (const k of Object.keys(f.cd) as MoveKey[]) if (f.cd[k]) f.cd[k]!--;
    for (const k of ["slow", "haste", "buff", "guard", "evade", "immune", "peel"] as const) if (f.st[k]) f.st[k]--;
  }

  // El rival saca a los siguientes.
  if (!alive(b.theirs)) {
    b.result = "win";
    say(b, b.kind === "objective" ? T(`¡Has asegurado el ${b.foe.name}!`, `You secured the ${b.foe.name}!`) : T(`¡Has ganado a ${b.foe.name}!`, `You beat ${b.foe.name}!`), "end");
  } else {
    const out: string[] = [];
    b.on[1].forEach((k, s) => {
      if (k >= 0 && b.theirs[k].hp > 0) return;
      const next = bench(b, 1)[0];
      b.on[1][s] = next ?? -1;
      if (next !== undefined) out.push(b.theirs[next].champ.name);
    });
    if (out.length) {
      const pair = !!b.foe.mate;
      say(b, T(`${b.foe.name} ${pair ? "sacan" : "saca"} a ${and(out)}.`, `${b.foe.name} ${pair ? "send" : "sends"} out ${and(out)}.`), "switch", { side: 1, who: b.on[1].find((k) => k >= 0) });
    }
  }
  if (!b.result) {
    if (!alive(b.mine)) {
      b.result = "lose";
      say(b, T("No te quedan campeones en pie…", "You have no champions left standing…"), "end");
    } else {
      b.on[0] = b.on[0].map((k) => (k >= 0 && b.mine[k].hp > 0 ? k : -1));
      b.mustSwitch = b.on[0].some((k) => k < 0) && bench(b, 0).length > 0;
    }
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
    r.killer = b.kind === "fight" && b.foe.team ? `${b.foe.name} (${b.foe.team})` : b.foe.name;
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
  const fresh: Unit = { ...u, uid: uid(), items: [], boost: 1 };
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
    return { run: r, text: T(`${c.name} se toma la ${item.name} y recupera vida.`, `${c.name} drinks the ${item.name} and recovers health.`) };
  }
  const { items, made } = combine([...u.items, item.id], data);
  if (items.length > MAX_ITEMS) return null;
  r.gold -= item.gold;
  u.items = items;
  const after = unitStats(u, data, r.trainer.role).hp;
  if (u.hp > 0) u.hp = Math.min(after, u.hp + Math.max(0, after - before));
  const text = made.length
    ? T(`¡${c.name} combina sus componentes en ${made.at(-1)!.name}!`, `${c.name} combines their components into ${made.at(-1)!.name}!`)
    : T(`${c.name} se equipa ${item.name}.`, `${c.name} equips ${item.name}.`);
  return { run: r, text };
}

/* ---------- Eventos ---------- */

export type GameEvent = { title: string; text: string; choice?: { yes: string; no: string } ; apply: (r: Run, data: GameData) => string };

export function randomEvent(run: Run, data: GameData): GameEvent {
  const events: GameEvent[] = [
    {
      title: T("Firma de autógrafos", "Autograph signing"),
      text: T("Los fans te esperan a la salida del hotel. Te dan 250 de oro por las fotos.", "Fans are waiting outside the hotel. They give you 250 gold for the photos."),
      apply: (r) => {
        r.gold += 250;
        return T("+250 de oro.", "+250 gold.");
      },
    },
    {
      title: T("Scrim contra la academia", "Scrim vs. the academy"),
      text: T("Una scrim larga de práctica. Un campeón al azar sube de nivel.", "A long practice scrim. A random champion levels up."),
      apply: (r, d) => {
        const u = pick(r.team);
        u.level = Math.min(MAX_LEVEL, u.level + 1);
        return T(`${d.champions[u.champ].name} sube a nivel ${u.level}.`, `${d.champions[u.champ].name} grows to level ${u.level}.`);
      },
    },
    {
      title: T("Regalo de un patrocinador", "Sponsor gift"),
      text: T("Un patrocinador te manda material. Uno de tus campeones recibe un componente.", "A sponsor sends you gear. One of your champions gets a component."),
      apply: (r, d) => {
        const free = r.team.filter((u) => u.items.length < MAX_ITEMS);
        if (!free.length) {
          r.gold += 300;
          return T("Nadie tiene hueco: te lo dan en oro (+300).", "Nobody has room: you get gold instead (+300).");
        }
        const u = pick(free);
        const it = pick(d.items.filter((i) => i.kind === "basic"));
        u.items = combine([...u.items, it.id], d).items;
        return T(`${d.champions[u.champ].name} recibe ${it.name}.`, `${d.champions[u.champ].name} receives ${it.name}.`);
      },
    },
    {
      title: "Jet lag",
      text: T("El viaje pasa factura: todo el equipo pierde un 20 % de vida.", "The trip takes its toll: your whole team loses 20% health."),
      apply: (r, d) => {
        for (const u of r.team) if (u.hp > 0) u.hp = Math.max(1, Math.round(u.hp - unitStats(u, d, r.trainer.role).hp * 0.2));
        return T("El equipo llega cansado.", "The team arrives tired.");
      },
    },
    {
      title: T("Parche nuevo", "New patch"),
      text: T("Riot saca un parche a mitad del torneo y uno de tus campeones sale reforzado.", "Riot ships a patch mid-tournament and one of your champions gets buffed."),
      apply: (r, d) => {
        const u = pick(r.team);
        u.boost = Math.round(u.boost * 1.1 * 100) / 100;
        return T(`${d.champions[u.champ].name} mejora un 10 % sus estadísticas.`, `${d.champions[u.champ].name} gets 10% better stats.`);
      },
    },
    {
      title: T("Sesión de fisio", "Physio session"),
      text: T("Un buen masaje antes del partido. Todo el equipo recupera la mitad de su vida.", "A good massage before the match. Your whole team recovers half its health."),
      apply: (r, d) => {
        for (const u of r.team) {
          const max = unitStats(u, d, r.trainer.role).hp;
          u.hp = Math.min(max, u.hp + Math.round(max * 0.5));
        }
        return T("El equipo se recupera.", "The team recovers.");
      },
    },
  ];
  const pool = run.trainer.pool.filter((c) => data.champions[c] && !run.team.some((u) => u.champ === c));
  if (pool.length && run.team.length) {
    events.push({
      title: T("Cambio de última hora", "Last-minute swap"),
      text: T(
        `${run.trainer.name} quiere probar algo nuevo de su pool. ¿Cambias a uno de tus campeones por otro al azar de su pool, al mismo nivel?`,
        `${run.trainer.name} wants to try something new from their pool. Swap one of your champions for a random one from their pool, at the same level?`,
      ),
      choice: { yes: T("Cambiar", "Swap"), no: T("Mejor no", "No thanks") },
      apply: (r, d) => {
        const u = pick(r.team);
        const c = pick(pool);
        const old = d.champions[u.champ].name;
        u.champ = c;
        u.items = [];
        u.hp = unitStats(u, d, r.trainer.role).hp;
        return T(`${old} deja su sitio a ${d.champions[c].name}.`, `${old} makes way for ${d.champions[c].name}.`);
      },
    });
  }
  return pick(events);
}
