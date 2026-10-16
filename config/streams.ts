// Lista de emisiones disponibles en el reproductor.
// Para añadir o quitar un canal solo hay que editar este fichero.
// En español se ven los canales con lang "es" (más el oficial en inglés) y en
// la versión inglesa los de lang "en" (más los oficiales en español al final).
// Además, la web añade sola los canales oficiales en español o inglés que la
// API de lolesports marque como en directo.

export type StreamProvider = "twitch" | "youtube";

export type Stream = {
  id: string;
  label: string;
  provider: StreamProvider;
  /** Canal de Twitch, o id de vídeo/canal de YouTube */
  channel: string;
  kind: "oficial" | "cooficial";
  lang: "es" | "en";
  /** Breve descripción para el menú */
  note?: string;
  /** La misma descripción en inglés */
  noteEn?: string;
};

export const STREAMS: Stream[] = [
  {
    id: "lvp",
    label: "LVP",
    provider: "twitch",
    channel: "lvpes",
    kind: "oficial",
    lang: "es",
    note: "Oficial España",
    noteEn: "Official Spanish (Spain)",
  },
  {
    id: "latam",
    label: "LoL Esports LATAM",
    provider: "twitch",
    channel: "lolesportsla",
    kind: "oficial",
    lang: "es",
    note: "Oficial Latinoamérica",
    noteEn: "Official Spanish (Latin America)",
  },
  {
    id: "riot",
    label: "Riot Games",
    provider: "twitch",
    channel: "riotgames",
    kind: "oficial",
    lang: "en",
    note: "Oficial en inglés",
    noteEn: "Official English broadcast",
  },
  { id: "ibai", label: "Ibai", provider: "twitch", channel: "ibai", kind: "cooficial", lang: "es" },
  { id: "jordilmk", label: "Jordi LMK", provider: "twitch", channel: "jordilmk", kind: "cooficial", lang: "es" },
  { id: "toad", label: "Toad", provider: "twitch", channel: "toadamarillo", kind: "cooficial", lang: "es" },
  { id: "cabra", label: "Cabramaravilla", provider: "twitch", channel: "cabramaravilla", kind: "cooficial", lang: "es" },
  { id: "jimrising", label: "JimRising", provider: "twitch", channel: "jimrsng", kind: "cooficial", lang: "es" },
  { id: "teshtv", label: "TeshTV", provider: "twitch", channel: "teshrak", kind: "cooficial", lang: "es" },
  { id: "send0o", label: "Send0o", provider: "twitch", channel: "send0o", kind: "cooficial", lang: "es" },
  { id: "lastpick", label: "Lastpick", provider: "twitch", channel: "lastpickcl", kind: "cooficial", lang: "es" },
  { id: "jonni", label: "Jonni", provider: "twitch", channel: "jonnijuro", kind: "cooficial", lang: "es" },
  { id: "nickdaboom", label: "Nickdaboom", provider: "twitch", channel: "nickdaboom", kind: "cooficial", lang: "es" },
  { id: "mfreak", label: "mfreak00", provider: "twitch", channel: "mfreak00", kind: "cooficial", lang: "es" },
  { id: "caedrel", label: "Caedrel", provider: "twitch", channel: "caedrel", kind: "cooficial", lang: "en" },
  { id: "mercy", label: "Mercy Plays", provider: "twitch", channel: "mercyplaystw", kind: "cooficial", lang: "es" },
];

export const DEFAULT_STREAM_ID = { es: "lvp", en: "riot" } as const;
