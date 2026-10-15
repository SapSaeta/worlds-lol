import { LiveView } from "@/components/LiveView";
import { getWorldsData } from "@/lib/lolesports";

export const revalidate = 60;

export default async function Home() {
  const data = await getWorldsData();
  return <LiveView initialData={data} />;
}
