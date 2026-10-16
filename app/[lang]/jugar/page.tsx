import type { Metadata } from "next";
import { Game } from "@/components/game/Game";
import { getGameData } from "@/lib/game/data";
import type { GameData } from "@/lib/game/types";
import { alternates, isLocale, tr, type Locale } from "@/lib/i18n";

// Los pools salen de las últimas series de cada equipo: con rehacerlos cada
// pocas horas basta.
export const revalidate = 21600;

const lang = async (params: PageProps<"/[lang]/jugar">["params"]): Promise<Locale> => {
  const { lang } = await params;
  return isLocale(lang) ? lang : "es";
};

export async function generateMetadata({ params }: PageProps<"/[lang]/jugar">): Promise<Metadata> {
  const l = await lang(params);
  return {
    title: tr(l, "Camino a la Copa · Worlddex", "Road to the Cup · Worlddex"),
    description: tr(
      l,
      "Roguelike de los Worlds 2026: elige a un jugador pro como entrenador, ficha campeones y llega a la final.",
      "A Worlds 2026 roguelike: pick a pro player as your trainer, recruit champions and make it to the final.",
    ),
    alternates: alternates(l, "/jugar"),
  };
}

export default async function Jugar({ params }: PageProps<"/[lang]/jugar">) {
  const l = await lang(params);
  const data: GameData = await getGameData(undefined, l).catch((err) => ({
    version: "",
    champions: {},
    items: [],
    players: [],
    teams: [],
    updatedAt: new Date().toISOString(),
    warnings: [String(err)],
  }));
  return (
    <div className="page">
      <Game data={data} />
    </div>
  );
}
