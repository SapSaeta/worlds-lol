import type { Metadata, Viewport } from "next";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/vt323/400.css";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { PlayerDock } from "@/components/player/PlayerDock";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { TOURNAMENT } from "@/config/tournament";

export const metadata: Metadata = {
  title: `${TOURNAMENT.name} en español · Worlds LOL`,
  description: `Sigue los ${TOURNAMENT.name} de League of Legends en español: emisiones oficiales y cooficiales, clasificación en directo y un juego pokelike con los datos del torneo.`,
};

export const viewport: Viewport = {
  themeColor: "#081429",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <PlayerProvider>
          <SiteHeader />
          <main>{children}</main>
          <PlayerDock />
        </PlayerProvider>
        <footer className="site-footer">
          <p>
            worlddex.lol se ha creado bajo la política «Legal Jibber Jabber» de Riot Games usando recursos propiedad de Riot Games. Riot Games no respalda ni
            patrocina este proyecto.
          </p>
          <p>Web de fans sin ánimo de lucro. Datos y emisiones de lolesports.com.</p>
        </footer>
      </body>
    </html>
  );
}
