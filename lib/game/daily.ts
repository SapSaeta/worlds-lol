// Reto del día: una partida igual para todos, como en Wordle. Cada día (hora
// de Madrid) tiene su número y su semilla, así que todos empiezan con los
// mismos entrenadores, el mismo mapa y los mismos rivales.

const FIRST_DAY = Date.UTC(2026, 9, 16); // Reto #1: 16 de octubre de 2026

/** Fecha de hoy en Madrid como YYYY-MM-DD. */
export function madridDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Número del reto de hoy (1, 2, 3…). */
export function dailyNumber(now = new Date()) {
  const [y, m, d] = madridDay(now).split("-").map(Number);
  return Math.max(1, Math.round((Date.UTC(y, m - 1, d) - FIRST_DAY) / 86400000) + 1);
}

/** Semilla de un reto: un entero fijo por número de reto. */
export function dailySeed(n: number) {
  return hash(`worlddex-reto-${n}`);
}

/** Semilla nueva para una partida libre (se comparte para que otro la repita). */
export function freshSeed() {
  return Math.floor(Math.random() * 2 ** 31) + 1;
}

/** FNV-1a de 32 bits. */
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
