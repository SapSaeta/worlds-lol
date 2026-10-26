import { getWorldsData } from "@/lib/lolesports";

export const revalidate = 60;

export async function GET() {
  const data = await getWorldsData();
  return Response.json(data, {
    headers: {
      // El CDN la guarda un minuto; el navegador siempre pregunta (y recibe un 304 si no cambió).
      "Cache-Control": "public, max-age=0, must-revalidate",
      "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
