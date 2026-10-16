import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import "../globals.css";
import { AuthorBadge } from "@/components/AuthorBadge";
import { LocaleProvider } from "@/components/LocaleProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { PlayerDock } from "@/components/player/PlayerDock";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { TOURNAMENT } from "@/config/tournament";
import { LOCALES, alternates, isLocale, tr } from "@/lib/i18n";

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const l = isLocale(lang) ? lang : "es";
  return {
    metadataBase: new URL("https://worlddex.lol"),
    title: tr(l, `${TOURNAMENT.name} en español · Worlds LOL`, `${TOURNAMENT.name} live · Worlddex`),
    description: tr(
      l,
      `Sigue los ${TOURNAMENT.name} de League of Legends en español: emisiones oficiales y cooficiales, clasificación en directo y un juego pokelike con los datos del torneo.`,
      `Follow League of Legends ${TOURNAMENT.name}: official English broadcasts, live standings and a pokelike game built on the tournament data.`,
    ),
    alternates: alternates(l, "/"),
  };
}

export const viewport: Viewport = {
  themeColor: "#081429",
  colorScheme: "light",
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <html lang={lang}>
      <body>
        <LocaleProvider locale={lang}>
          <PlayerProvider>
            <SiteHeader />
            <main>{children}</main>
            <PlayerDock />
          </PlayerProvider>
          <footer className="site-footer">
            <AuthorBadge locale={lang} />
            {lang === "en" ? (
              <>
                <p>
                  worlddex.lol was created under Riot Games&apos; &quot;Legal Jibber Jabber&quot; policy using assets owned by Riot Games. Riot Games does not endorse or
                  sponsor this project.
                </p>
                <p>Non-profit fan site. Data and broadcasts from lolesports.com.</p>
              </>
            ) : (
              <>
                <p>
                  worlddex.lol se ha creado bajo la política «Legal Jibber Jabber» de Riot Games usando recursos propiedad de Riot Games. Riot Games no respalda ni
                  patrocina este proyecto.
                </p>
                <p>Web de fans sin ánimo de lucro. Datos y emisiones de lolesports.com.</p>
              </>
            )}
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
