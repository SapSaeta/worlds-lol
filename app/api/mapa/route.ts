import { getTournament } from "@/config/tournament";
import { getTournamentMap } from "@/lib/lolesports";

export const revalidate = 60;

/** Cuadro del torneo: /api/mapa (actual) o /api/mapa?t=worlds-2025 */
export async function GET(req: Request) {
  const t = getTournament(new URL(req.url).searchParams.get("t"));
  if (!t) return Response.json({ error: "Torneo desconocido" }, { status: 404 });
  const map = await getTournamentMap(t);
  return Response.json(map, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
