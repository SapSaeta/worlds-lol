import { Worlddex } from "@/components/Worlddex";
import { TOURNAMENT, worlddexLinks } from "@/config/tournament";
import { getStats } from "@/lib/gamestats";
import { getTournamentMap, getWorldsData } from "@/lib/lolesports";

export const revalidate = 300;

export const metadata = { title: "Worlddex · Worlds LOL" };

export default async function Estadisticas() {
  const [stats, data, map] = await Promise.all([getStats(TOURNAMENT), getWorldsData(TOURNAMENT), getTournamentMap(TOURNAMENT)]);
  return <Worlddex stats={stats} teams={data.source === "demo" ? [] : data.teams} ongoing tournaments={worlddexLinks()} map={map} stages={TOURNAMENT.stages ?? []} />;
}
