// Torneos que sigue la web. El primero es el actual; los demás quedan como
// archivo (por ejemplo para consultar la Worlddex de ediciones pasadas).
// Para reutilizar la web con la LEC, el MSI u otro campeonato basta con añadir
// una entrada con su leagueId y tournamentId de lolesports.

import { localePath, type Locale } from "@/lib/i18n";

/** Fase del torneo tal como la nombra la API de lolesports (slug del stage). */
export type StageInfo = {
  slug: "play_ins" | "swiss" | "knockouts";
  name: string;
  /** Ciudad, para el mapa de ruta */
  city: string;
  /** Recinto o recintos */
  venue: string;
  /** Formato en una frase */
  format: string;
  /** Los mismos textos en inglés (lo que no esté se queda como en español) */
  en?: Partial<Pick<StageInfo, "name" | "city" | "venue" | "format">>;
};

export type TournamentConfig = {
  /** Identificador en la URL */
  slug: string;
  /** Nombre que se muestra en la web */
  name: string;
  /** Subtítulo corto (sedes, fechas...) */
  tagline: string;
  /** leagueId en la API de lolesports */
  leagueId: string;
  /** tournamentId en la API de lolesports */
  tournamentId: string;
  /** Ventana de fechas (ISO) para filtrar el calendario */
  start: string;
  end: string;
  /**
   * Slugs de lolesports de los equipos clasificados. Hace falta mientras la
   * clasificación oficial tenga huecos por definir (TBD): así salen todos en la
   * Worlddex y en la tabla aunque aún no tengan partidos.
   */
  teams?: string[];
  /** Sedes y formato de cada fase, para el mapa del torneo */
  stages?: StageInfo[];
};

export const TOURNAMENTS: TournamentConfig[] = [
  {
    slug: "worlds-2026",
    name: "Worlds 2026",
    tagline: "Los Ángeles · Allen · Nueva York",
    leagueId: "98767975604431411",
    tournamentId: "115660540725177488",
    start: "2026-10-14T00:00:00Z",
    end: "2026-11-16T00:00:00Z",
    teams: [
      // LCK
      "geng", "hanwha-life-esports", "t1", "dwg-kia",
      // LPL
      "anyones-legend", "bilibili-gaming", "top-esports", "invictus-gaming",
      // LEC
      "g2-esports", "mad-lions", "karmine-corp",
      // LCS
      "team-liquid", "lyon-gaming", "cloud9",
      // LCP
      "team-secret-whales", "ctbc-flying-oyster", "saigon-buffalo-esports",
      // CBLOL
      "los", "furia",
    ],
    stages: [
      {
        slug: "play_ins",
        name: "Play-In",
        city: "Los Ángeles",
        venue: "Riot Games Arena",
        format: "4 equipos en doble eliminación al mejor de 5. Solo el campeón pasa a la fase suiza.",
        en: { city: "Los Angeles", format: "4 teams, double elimination, best of 5. Only the winner advances to the Swiss stage." },
      },
      {
        slug: "swiss",
        name: "Fase suiza",
        city: "Allen (Texas)",
        venue: "Credit Union of Texas Event Center",
        format: "16 equipos. Con 3 victorias pasas y con 3 derrotas te vas. Al mejor de 1, y al mejor de 3 cuando hay plaza o eliminación en juego.",
        en: {
          name: "Swiss stage",
          format: "16 teams. 3 wins and you advance, 3 losses and you're out. Best of 1, and best of 3 when advancement or elimination is on the line.",
        },
      },
      {
        slug: "knockouts",
        name: "Eliminatorias",
        city: "Allen · Nueva York",
        venue: "Cuartos y semis en Allen, final en el Barclays Center de Brooklyn",
        format: "8 equipos en eliminación directa al mejor de 5. Los 3-0 se cruzan con los 3-2 y los 3-1 se sortean entre sí.",
        en: {
          name: "Knockouts",
          city: "Allen · New York",
          venue: "Quarters and semis in Allen, final at Barclays Center in Brooklyn",
          format: "8 teams, single elimination, best of 5. 3-0 teams face 3-2 teams and the 3-1 teams are drawn against each other.",
        },
      },
    ],
  },
  {
    slug: "worlds-2025",
    name: "Worlds 2025",
    tagline: "Pekín · Shanghái · Chengdú",
    leagueId: "98767975604431411",
    tournamentId: "113475452383887518",
    start: "2025-10-13T00:00:00Z",
    end: "2025-11-10T00:00:00Z",
    stages: [
      {
        slug: "play_ins",
        name: "Play-In",
        city: "Pekín",
        venue: "Beijing Smart Esports Center",
        format: "Un único cruce al mejor de 5 entre los cuartos de la LCK y la LPL.",
        en: { city: "Beijing", format: "A single best-of-5 between the 4th seeds of the LCK and the LPL." },
      },
      {
        slug: "swiss",
        name: "Fase suiza",
        city: "Pekín",
        venue: "Beijing Smart Esports Center",
        format: "16 equipos. Con 3 victorias pasas y con 3 derrotas te vas.",
        en: { name: "Swiss stage", city: "Beijing", format: "16 teams. 3 wins and you advance, 3 losses and you're out." },
      },
      {
        slug: "knockouts",
        name: "Eliminatorias",
        city: "Shanghái · Chengdú",
        venue: "Cuartos y semis en el Mercedes-Benz Arena, final en Chengdú",
        format: "8 equipos en eliminación directa al mejor de 5.",
        en: { name: "Knockouts", city: "Shanghai · Chengdu", venue: "Quarters and semis at Mercedes-Benz Arena, final in Chengdu", format: "8 teams, single elimination, best of 5." },
      },
    ],
  },
];

export const TOURNAMENT = TOURNAMENTS[0];

export function getTournament(slug?: string | null): TournamentConfig | undefined {
  return slug ? TOURNAMENTS.find((t) => t.slug === slug) : TOURNAMENT;
}

/** Enlaces a la Worlddex de cada torneo: el actual en /estadisticas y el resto archivados. */
export const worlddexLinks = (l: Locale = "es") =>
  TOURNAMENTS.map((t, i) => ({ slug: t.slug, name: t.name, href: localePath(l, i === 0 ? "/estadisticas" : `/estadisticas/${t.slug}`) }));

/** Sedes y formato de las fases en el idioma pedido. */
export const stagesFor = (t: TournamentConfig, l: Locale): StageInfo[] => (t.stages ?? []).map((s) => (l === "en" ? { ...s, ...s.en } : s));
