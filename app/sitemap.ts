import type { MetadataRoute } from "next";
import { TOURNAMENTS } from "@/config/tournament";
import { localePath } from "@/lib/i18n";

const BASE = "https://worlddex.lol";

// Cada página en los dos idiomas, enlazadas entre sí para los buscadores.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/estadisticas", ...TOURNAMENTS.slice(1).map((t) => `/estadisticas/${t.slug}`), "/jugar"];
  return paths.flatMap((p) =>
    (["es", "en"] as const).map((l) => ({
      url: `${BASE}${localePath(l, p)}`,
      alternates: { languages: { es: `${BASE}${localePath("es", p)}`, en: `${BASE}${localePath("en", p)}` } },
    })),
  );
}
