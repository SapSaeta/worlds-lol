// Torneos que sigue la web. El primero es el actual; los demás quedan como
// archivo (por ejemplo para consultar la Worlddex de ediciones pasadas).
// Para reutilizar la web con la LEC, el MSI u otro campeonato basta con añadir
// una entrada con su leagueId y tournamentId de lolesports.

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
  },
  {
    slug: "worlds-2025",
    name: "Worlds 2025",
    tagline: "Pekín · Shanghái · Chengdú",
    leagueId: "98767975604431411",
    tournamentId: "113475452383887518",
    start: "2025-10-13T00:00:00Z",
    end: "2025-11-10T00:00:00Z",
  },
];

export const TOURNAMENT = TOURNAMENTS[0];

export function getTournament(slug?: string | null): TournamentConfig | undefined {
  return slug ? TOURNAMENTS.find((t) => t.slug === slug) : TOURNAMENT;
}

/** Enlaces a la Worlddex de cada torneo: el actual en /estadisticas y el resto archivados. */
export const worlddexLinks = () =>
  TOURNAMENTS.map((t, i) => ({ slug: t.slug, name: t.name, href: i === 0 ? "/estadisticas" : `/estadisticas/${t.slug}` }));
