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
        // Sin "no-store": así el navegador no pide saltarse la caché del CDN.
        const res = await fetch("/api/worlds");
        if (res.ok && alive) setData(await res.json());
      } catch {
        // Si falla, mantenemos los últimos datos buenos.
      } finally {
        if (alive) setLoading(false);
      }
    };
    // La página puede venir de la caché con unos minutos: si es así, se refresca ya.
    if (Date.now() - Date.parse(initialData.updatedAt) > REFRESH_MS) void tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [initialData.updatedAt]);

  return (
    <div className="live-layout">
      <StreamPlayer liveStreams={data.liveStreams} matches={data.matches} />
      <TeamsPanel data={data} loading={loading} />
    </div>
  );
}
