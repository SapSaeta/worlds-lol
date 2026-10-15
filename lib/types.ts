export type MatchState = "unstarted" | "inProgress" | "completed";

export type MatchTeam = {
  code: string;
  name: string;
  image: string;
  gameWins: number;
  outcome: "win" | "loss" | null;
};

export type Match = {
  id: string;
  startTime: string;
  state: MatchState;
  blockName: string;
  bestOf: number;
  teams: [MatchTeam, MatchTeam];
};

export type Player = {
  name: string;
  realName: string;
  role: string;
  image: string;
};

export type Team = {
  code: string;
  name: string;
  image: string;
  region: string | null;
  wins: number;
  losses: number;
  gameWins: number;
  gameLosses: number;
  /** Resultados de series, del más antiguo al más reciente */
  form: ("W" | "L")[];
  players: Player[];
};

export type LiveStream = {
  provider: string;
  channel: string;
  locale: string;
};

export type WorldsData = {
  tournament: { name: string; tagline: string };
  updatedAt: string;
  source: "lolesports" | "demo";
  error?: string;
  teams: Team[];
  matches: Match[];
  liveStreams: LiveStream[];
  /** Fallos parciales de la API (no impiden mostrar datos) */
  warnings?: string[];
};
