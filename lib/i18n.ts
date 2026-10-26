// Idiomas de la web. El español va sin prefijo (worlddex.lol/jugar) y el inglés
// cuelga de /en con rutas propias (worlddex.lol/en/play). Por dentro las
// páginas viven en app/[lang]/… con los nombres en español; next.config.ts traduce
// las URL públicas a esas rutas.

export type Locale = "es" | "en";
export const LOCALES: Locale[] = ["es", "en"];
export const DEFAULT_LOCALE: Locale = "es";
export const LOCALE_COOKIE = "lang";

export const isLocale = (v: unknown): v is Locale => v === "es" || v === "en";

/** Texto en el idioma pedido. */
export const tr = (l: Locale, es: string, en: string) => (l === "en" ? en : es);

/** Locale de Intl (fechas y números). */
export const intlLocale = (l: Locale) => (l === "en" ? "en-US" : "es-ES");

/** Segmentos de ruta en inglés para cada segmento interno en español. */
const EN_SEGMENT: Record<string, string> = { estadisticas: "stats", jugar: "play", imagen: "image" };
const ES_SEGMENT = Object.fromEntries(Object.entries(EN_SEGMENT).map(([es, en]) => [en, es]));

const mapSegments = (path: string, dict: Record<string, string>) =>
  path
    .split("/")
    .map((s) => dict[s] ?? s)
    .join("/");

/**
 * URL pública de una ruta interna en el idioma dado.
 * localePath("en", "/jugar/r?x=1") → "/en/play/r?x=1"; en español no cambia.
 */
export function localePath(l: Locale, path: string): string {
  if (l === "es") return path;
  const [p, q] = splitQuery(path);
  const mapped = mapSegments(p, EN_SEGMENT);
  return `/en${mapped === "/" ? "" : mapped}${q}`;
}

/** Ruta interna (en español, sin prefijo) de una URL pública en inglés: "/en/play" → "/jugar". */
export function internalPath(enPath: string): string {
  const rest = enPath.replace(/^\/en(?=\/|$)/, "") || "/";
  return mapSegments(rest, ES_SEGMENT);
}

/** La misma página en el otro idioma, a partir de la ruta pública actual. */
export function switchPath(path: string, to: Locale): string {
  const internal = /^\/en(\/|$)/.test(path) ? internalPath(path) : path;
  return localePath(to, internal);
}

function splitQuery(path: string): [string, string] {
  const i = path.search(/[?#]/);
  return i < 0 ? [path, ""] : [path.slice(0, i), path.slice(i)];
}

/** Número con separador de miles: 7.023 en español, 7,023 en inglés. */
export const fmtNum = (l: Locale, n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, l === "en" ? "," : ".");

/** Enlaces alternativos de una página para los buscadores (hreflang). */
export function alternates(l: Locale, path: string) {
  return {
    canonical: localePath(l, path),
    languages: { es: localePath("es", path), en: localePath("en", path), "x-default": localePath("es", path) },
  };
}
