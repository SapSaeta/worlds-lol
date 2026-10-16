"use client";

import { useEffect, useState } from "react";
import { StreamPlayer } from "@/components/StreamPlayer";
import { TeamsPanel } from "@/components/TeamsPanel";
import type { WorldsData } from "@/lib/types";

const REFRESH_MS = 60_000;

export function LiveView({ initialData }: { initialData: WorldsData }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.hidden) return;
      setLoading(true);
      try {
        const res = await fetch("/api/worlds", { cache: "no-store" });
        if (res.ok && alive) setData(await res.json());
      } catch {
        // Si falla, mantenemos los últimos datos buenos.
      } finally {
        if (alive) setLoading(false);
      }
    };
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="live-layout">
      <StreamPlayer liveStreams={data.liveStreams} matches={data.matches} />
      <TeamsPanel data={data} loading={loading} />
    </div>
  );
}
