import { getWorldsData } from "@/lib/lolesports";

export const revalidate = 60;

export async function GET() {
  const data = await getWorldsData();
  return Response.json(data, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
