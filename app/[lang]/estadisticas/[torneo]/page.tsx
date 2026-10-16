import { notFound } from "next/navigation";
import { Worlddex } from "@/components/Worlddex";
import { TOURNAMENTS, getTournament, stagesFor, worlddexLinks } from "@/config/tournament";
import { getStats, localizeStats } from "@/lib/gamestats";
import { alternates, isLocale } from "@/lib/i18n";
import { getTournamentMap, getWorldsData } from "@/lib/lolesports";

// Ediciones archivadas: sus partidas ya no cambian, se regeneran una vez al día.
export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return TOURNAMENTS.slice(1).map((t) => ({ torneo: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/estadisticas/[torneo]">) {
  const { lang, torneo } = await params;
  const t = getTournament(torneo);
  return { title: `Worlddex ${t?.name ?? ""} · Worlds LOL`, alternates: alternates(isLocale(lang) ? lang : "es", `/estadisticas/${torneo}`) };
}

export default async function Archivo({ params }: PageProps<"/[lang]/estadisticas/[torneo]">) {
  const { lang, torneo } = await params;
  const l = isLocale(lang) ? lang : "es";
  const t = getTournament(torneo);
  if (!t) notFound();
  const [stats, data, map] = await Promise.all([getStats(t).then((s) => localizeStats(s, l)), getWorldsData(t), getTournamentMap(t)]);
  const ongoing = Date.parse(t.end) > Date.now();
  return <Worlddex stats={stats} teams={data.source === "demo" ? [] : data.teams} ongoing={ongoing} tournaments={worlddexLinks(l)} map={map} stages={stagesFor(t, l)} />;
}
