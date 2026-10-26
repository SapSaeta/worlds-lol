import { LiveView } from "@/components/LiveView";
import { getWorldsData } from "@/lib/lolesports";

// La página se regenera cada 5 min; el cliente trae lo último de /api/worlds al abrirse.
export const revalidate = 300;

export default async function Home() {
  const data = await getWorldsData(undefined, 300);
  return <LiveView initialData={data} />;
}
