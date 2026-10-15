import { notFound } from "next/navigation";
import { Worlddex } from "@/components/Worlddex";
import { TOURNAMENTS, getTournament, worlddexLinks } from "@/config/tournament";
import { getStats } from "@/lib/gamestats";
import { getTournamentMap, getWorldsData } from "@/lib/lolesports";

// Ediciones archivadas: sus partidas ya no cambian, se regeneran una vez al día.
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return TOURNAMENTS.slice(1).map((t) => ({ torneo: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ torneo: string }> }) {
  const t = getTournament((await params).torneo);
  return { title: `Worlddex ${t?.name ?? ""} · Worlds LOL` };
}

export default async function Archivo({ params }: { params: Promise<{ torneo: string }> }) {
  const t = getTournament((await params).torneo);
  if (!t) notFound();
  const [stats, data, map] = await Promise.all([getStats(t), getWorldsData(t), getTournamentMap(t)]);
  const ongoing = Date.parse(t.end) > Date.now();
  return <Worlddex stats={stats} teams={data.source === "demo" ? [] : data.teams} ongoing={ongoing} tournaments={worlddexLinks()} map={map} stages={t.stages ?? []} />;
}
