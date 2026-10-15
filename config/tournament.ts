// Configuración del torneo que sigue la web. Para reutilizarla con la LEC,
// el MSI u otro campeonato basta con cambiar este objeto (o añadir otro).

export type TournamentConfig = {
  /** Identificador interno corto */
  slug: string;
  /** Nombre que se muestra en la web */
  name: string;
  /** Subtítulo corto (sedes, fechas...) */
  tagline: string;
  /** leagueId en la API de lolesports */
  leagueId: string;
  /** Fecha de inicio y fin (ISO) para filtrar el calendario */
  start: string;
  end: string;
};

export const TOURNAMENT: TournamentConfig = {
  slug: "worlds-2026",
  name: "Worlds 2026",
  tagline: "Los Ángeles · Allen · Nueva York",
  leagueId: "98767975604431411",
  start: "2026-10-01T00:00:00Z",
  end: "2026-11-20T00:00:00Z",
};
