import type { Metadata, Viewport } from "next";
import "@fontsource/press-start-2p/400.css";
import "@fontsource/pixelify-sans/400.css";
import "@fontsource/pixelify-sans/600.css";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { TOURNAMENT } from "@/config/tournament";

export const metadata: Metadata = {
  title: `${TOURNAMENT.name} en español · Worlds LOL`,
  description: `Sigue los ${TOURNAMENT.name} de League of Legends en español: emisiones oficiales y cooficiales, clasificación en directo y un juego pokelike con los datos del torneo.`,
};

export const viewport: Viewport = {
  themeColor: "#0e0e0e",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
