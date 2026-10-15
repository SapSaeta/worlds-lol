"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_STREAM_ID, STREAMS, type Stream } from "@/config/streams";
import type { LiveStream } from "@/lib/types";

const STORAGE_KEY = "worlds-lol:stream";

/** Junta la lista fija con los canales oficiales en español que marca la API. */
function mergeStreams(live: LiveStream[]): Stream[] {
  const extra: Stream[] = [];
  for (const l of live) {
    if (l.provider !== "twitch" && l.provider !== "youtube") continue;
    if (STREAMS.some((s) => s.channel.toLowerCase() === l.channel.toLowerCase())) continue;
    if (extra.some((s) => s.channel === l.channel)) continue;
    extra.push({
      id: `api-${l.channel}`,
      label: l.channel,
      provider: l.provider,
      channel: l.channel,
      kind: "oficial",
      lang: "es",
      note: `Oficial · ${l.locale}`,
    });
  }
  return [...STREAMS.filter((s) => s.kind === "oficial"), ...extra, ...STREAMS.filter((s) => s.kind === "cooficial")];
}

type PlayerCtx = {
  streams: Stream[];
  current: Stream;
  liveChannels: Set<string>;
  choose: (id: string) => void;
  setLiveStreams: (live: LiveStream[]) => void;
  /** Hueco de la portada donde se pinta el reproductor grande (null fuera de la portada). */
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
  /** El reproductor está sonando: se arrancó en la portada y no se ha cerrado. */
  active: boolean;
  start: () => void;
  close: () => void;
  frameRef: React.RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
};

const Ctx = createContext<PlayerCtx | null>(null);

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer fuera de PlayerProvider");
  return c;
}

/**
 * Vive en el layout para que la emisión no se recargue al cambiar de pestaña:
 * en la portada se ve en grande y en el resto de páginas queda en miniatura.
 */
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [currentId, setCurrentId] = useState(DEFAULT_STREAM_ID);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const streams = useMemo(() => mergeStreams(liveStreams), [liveStreams]);
  const liveChannels = useMemo(() => new Set(liveStreams.map((l) => l.channel.toLowerCase())), [liveStreams]);
  const current = streams.find((s) => s.id === currentId) ?? streams[0];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && STREAMS.some((s) => s.id === saved)) setCurrentId(saved);
    } catch {}
    const onFs = () => setIsFullscreen(!!frameRef.current && document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const choose = useCallback((id: string) => {
    setCurrentId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }, []);

  const start = useCallback(() => setActive(true), []);
  const close = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    setActive(false);
  }, []);

  const value: PlayerCtx = {
    streams,
    current,
    liveChannels,
    choose,
    setLiveStreams,
    slot,
    setSlot,
    active,
    start,
    close,
    frameRef,
    isFullscreen,
    toggleFullscreen,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
