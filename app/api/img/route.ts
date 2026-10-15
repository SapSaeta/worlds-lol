// Proxy de imágenes de Data Dragon, lolesports y CommunityDragon para poder dibujarlas en un
// canvas (la tarjeta del juego) sin que el navegador lo bloquee por CORS.

const ALLOWED = ["ddragon.leagueoflegends.com", "static.lolesports.com", "raw.communitydragon.org"];

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("u") ?? "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return new Response("URL no válida", { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED.includes(url.hostname)) return new Response("Origen no permitido", { status: 403 });
  const res = await fetch(url, { cache: "force-cache" });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/")) return new Response("No disponible", { status: 502 });
  return new Response(res.body, {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=604800, s-maxage=604800, immutable" },
  });
}
