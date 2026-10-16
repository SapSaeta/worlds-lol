import type { Metadata } from "next";
import { Worlddex } from "@/components/Worlddex";
import { TOURNAMENT, stagesFor, worlddexLinks } from "@/config/tournament";
import { getStats, localizeStats } from "@/lib/gamestats";
import { alternates, isLocale, tr, type Locale } from "@/lib/i18n";
import { getTournamentMap, getWorldsData } from "@/lib/lolesports";

export const revalidate = 300;

const lang = async (params: PageProps<"/[lang]/estadisticas">["params"]): Promise<Locale> => {
  const { lang } = await params;
  return isLocale(lang) ? lang : "es";
};

export async function generateMetadata({ params }: PageProps<"/[lang]/estadisticas">): Promise<Metadata> {
  const l = await lang(params);
  return {
    title: "Worlddex · Worlds LOL",
    description: tr(
      l,
      `Equipos, jugadores y campeones más jugados de los ${TOURNAMENT.name}, con el cuadro del torneo.`,
      `${TOURNAMENT.name} teams, players and most picked champions, plus the tournament bracket.`,
    ),
    alternates: alternates(l, "/estadisticas"),
  };
}

export default async function Estadisticas({ params }: PageProps<"/[lang]/estadisticas">) {
  const l = await lang(params);
  const [stats, data, map] = await Promise.all([getStats(TOURNAMENT).then((s) => localizeStats(s, l)), getWorldsData(TOURNAMENT), getTournamentMap(TOURNAMENT)]);
  return <Worlddex stats={stats} teams={data.source === "demo" ? [] : data.teams} ongoing tournaments={worlddexLinks(l)} map={map} stages={stagesFor(TOURNAMENT, l)} />;
}
