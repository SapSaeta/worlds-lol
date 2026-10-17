// Tipos del juego "Camino a la Copa", compartidos entre el servidor (datos) y
// el navegador (motor y pantallas).

export type Role = "top" | "jungle" | "mid" | "bottom" | "support";
export const ROLES: Role[] = ["top", "jungle", "mid", "bottom", "support"];

/** Clases de campeón: hacen de tipos, con su tabla de ventajas. */
export type Cls = "Fighter" | "Tank" | "Mage" | "Assassin" | "Marksman" | "Support";

export type SpellKey = "Q" | "W" | "E" | "R";

/** Efectos de una habilidad, sacados de su descripción oficial. */
export type SpellFx = "stun" | "slow" | "shield" | "heal" | "drain" | "dash" | "haste" | "empower" | "buff" | "guard" | "execute" | "multi" | "evade" | "peel";
/** Tipo de daño: físico, mágico, verdadero, el principal del campeón ("auto") o ninguno. */
export type DmgType = "phys" | "magic" | "true" | "auto" | "none";

export type Spell = {
  key: SpellKey;
  name: string;
  icon: string;
  /** Enfriamiento oficial a rango 1, en segundos */
  cd: number;
  dmg: DmgType;
  fx: SpellFx[];
};

export type GChamp = {
  id: string;
  name: string;
  title: string;
  cls: Cls;
  tags: string[];
  /** Hace daño mágico (si no, físico) */
  magic: boolean;
  /** Estadísticas a nivel 1 */
  base: { hp: number; ad: number; ap: number; ar: number; mr: number; ms: number };
  icon: string;
  spells: Spell[];
};

export type StatKey = "hp" | "ad" | "ap" | "ar" | "mr" | "crit" | "as" | "ms" | "ls";
export type Stats = Partial<Record<StatKey, number>>;

export type GItem = {
  id: string;
  name: string;
  icon: string;
  gold: number;
  from: string[];
  kind: "basic" | "epic" | "legendary" | "potion";
  stats: Stats;
};

export type GPlayer = {
  id: string;
  name: string;
  role: Role;
  team: string;
  image: string;
  /** Campeones que más ha jugado, de más a menos */
  pool: string[];
};

export type GTeam = {
  code: string;
  name: string;
  image: string;
  /** Puesto en el ranking global de Riot (cuanto más bajo, más fuerte) */
  rank: number;
  region: string;
  /** Ids de sus 5 titulares, de top a support */
  players: string[];
};

export type GameData = {
  version: string;
  champions: Record<string, GChamp>;
  items: GItem[];
  players: GPlayer[];
  teams: GTeam[];
  updatedAt: string;
  warnings: string[];
};
