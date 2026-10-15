// Data Dragon: datos estáticos oficiales de Riot (campeones, habilidades, objetos).

const DD = "https://ddragon.leagueoflegends.com";
const LANG = "es_ES";

export type Champion = {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[];
  info: { attack: number; defense: number; magic: number; difficulty: number };
  stats: Record<string, number>;
};

export async function getVersion(): Promise<string> {
  const res = await fetch(`${DD}/api/versions.json`, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`ddragon versions → HTTP ${res.status}`);
  const versions: string[] = await res.json();
  return versions[0];
}

export async function getChampions(version?: string): Promise<{ version: string; champions: Record<string, Champion> }> {
  const v = version ?? (await getVersion());
  const res = await fetch(`${DD}/cdn/${v}/data/${LANG}/champion.json`, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`ddragon champions → HTTP ${res.status}`);
  const json = await res.json();
  const champions: Record<string, Champion> = {};
  for (const c of Object.values<any>(json.data)) {
    champions[c.id] = { id: c.id, key: c.key, name: c.name, title: c.title, tags: c.tags, info: c.info, stats: c.stats };
  }
  return { version: v, champions };
}

export const championIcon = (version: string, id: string) => `${DD}/cdn/${version}/img/champion/${id}.png`;

/** Clases de campeón traducidas; hacen de "tipos" en la web y en el juego. */
export const CLASS_LABEL: Record<string, string> = {
  Fighter: "Luchador",
  Tank: "Tanque",
  Mage: "Mago",
  Assassin: "Asesino",
  Marksman: "Tirador",
  Support: "Soporte",
};
