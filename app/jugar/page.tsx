import { Game } from "@/components/game/Game";
import { getGameData } from "@/lib/game/data";
import type { GameData } from "@/lib/game/types";

// Los pools salen de las últimas series de cada equipo: con rehacerlos cada
// pocas horas basta.
export const revalidate = 21600;

export const metadata = {
  title: "Camino a la Copa · Worlddex",
  description: "Roguelike de los Worlds 2026: elige a un jugador pro como entrenador, ficha campeones y llega a la final.",
};

export default async function Jugar() {
  const data: GameData = await getGameData().catch((err) => ({
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
