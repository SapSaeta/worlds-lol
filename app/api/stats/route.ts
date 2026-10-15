import { getTournament } from "@/config/tournament";
import { getStats } from "@/lib/gamestats";

// Estadísticas por jugador y campeón de un torneo (?t=worlds-2025). Las usará también el juego.
export const maxDuration = 60;

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("t");
  const t = getTournament(slug);
  if (!t) return Response.json({ error: `Torneo desconocido: ${slug}` }, { status: 404 });
  const stats = await getStats(t);
  const ttl = Date.parse(t.end) < Date.now() ? 86400 : 300;
  return Response.json(stats, {
    headers: { "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}` },
  });
}
