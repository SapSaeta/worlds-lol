import type { NextConfig } from "next";

// Rutas de idioma. Las URL en español (sin prefijo) se sirven desde app/[lang]
// con lang=es y las de /en/… con lang=en, traduciendo sus segmentos al nombre
// interno en español (lib/i18n.ts). Van aquí y no en un proxy para que el CDN de
// Vercel las resuelva sin ejecutar una función en cada petición.

/** El visitante eligió inglés con el selector (cookie lang, ver LOCALE_COOKIE). */
const wantsEnglish = [{ type: "cookie" as const, key: "lang", value: "en" }];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static.lolesports.com" },
      { protocol: "http", hostname: "static.lolesports.com" },
      { protocol: "https", hostname: "am-a.akamaihd.net" },
    ],
  },
  async redirects() {
    return [
      // /es/… no es una URL pública: se manda a la ruta sin prefijo.
      { source: "/es", destination: "/", permanent: true },
      { source: "/es/:path*", destination: "/:path*", permanent: true },
      // Quien eligió inglés va a la misma página en inglés. La tarjeta
      // (/jugar/r/imagen) se sirve tal cual: la piden las redes, no personas.
      { source: "/", has: wantsEnglish, destination: "/en", permanent: false },
      { source: "/estadisticas/:path*", has: wantsEnglish, destination: "/en/stats/:path*", permanent: false },
      { source: "/jugar", has: wantsEnglish, destination: "/en/play", permanent: false },
      { source: "/jugar/r", has: wantsEnglish, destination: "/en/play/r", permanent: false },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/en/stats/:path*", destination: "/en/estadisticas/:path*" },
        { source: "/en/play/r/image", destination: "/en/jugar/r/imagen" },
        { source: "/en/play/:path*", destination: "/en/jugar/:path*" },
        { source: "/", destination: "/es" },
        { source: "/estadisticas/:path*", destination: "/es/estadisticas/:path*" },
        { source: "/jugar/:path*", destination: "/es/jugar/:path*" },
      ],
    };
  },
};

export default nextConfig;
