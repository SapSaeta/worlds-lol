"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_STREAM_ID, STREAMS, type Stream } from "@/config/streams";
import { useLocale } from "@/components/LocaleProvider";
import type { Locale } from "@/lib/i18n";
import type { LiveStream } from "@/lib/types";

/** Cada idioma recuerda su propia emisión. */
const storageKey = (l: Locale) => (l === "en" ? "worlds-lol:stream:en" : "worlds-lol:stream");

/**
 * Lista de emisiones del idioma: primero sus oficiales (más las que marca la
 * API en directo) y sus cooficiales. En español el oficial en inglés va con los
 * oficiales; en inglés, los oficiales en español quedan al final.
 */
function mergeStreams(live: LiveStream[], locale: Locale): Stream[] {
  const extra: Stream[] = [];
  for (const l of live) {
    if (l.provider !== "twitch" && l.provider !== "youtube") continue;
    if (!l.locale.startsWith(locale)) continue;
    if (STREAMS.some((s) => s.channel.toLowerCase() === l.channel.toLowerCase())) continue;
    if (extra.some((s) => s.channel === l.channel)) continue;
    extra.push({
      id: `api-${l.channel}`,
      label: l.channel,
      provider: l.provider,
      channel: l.channel,
      kind: "oficial",
      lang: locale,
      note: `Oficial · ${l.locale}`,
      noteEn: `Official · ${l.locale}`,
    });
  }
  const of = (kind: Stream["kind"], lang: Locale) => STREAMS.filter((s) => s.kind === kind && s.lang === lang);
  if (locale === "en") return [...of("oficial", "en"), ...extra, ...of("cooficial", "en"), ...of("oficial", "es")];
  return [...of("oficial", "es"), ...of("oficial", "en"), ...extra, ...of("cooficial", "es")];
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
  const { locale } = useLocale();
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [currentId, setCurrentId] = useState<string>(DEFAULT_STREAM_ID[locale]);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  const streams = useMemo(() => mergeStreams(liveStreams, locale), [liveStreams, locale]);
  const liveChannels = useMemo(() => new Set(liveStreams.map((l) => l.channel.toLowerCase())), [liveStreams]);
  const current = streams.find((s) => s.id === currentId) ?? streams[0];

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey(locale));
      if (saved && STREAMS.some((s) => s.id === saved)) setCurrentId(saved);
    } catch {}
    const onFs = () => setIsFullscreen(!!frameRef.current && document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, [locale]);

  const choose = useCallback(
    (id: string) => {
      setCurrentId(id);
      try {
        localStorage.setItem(storageKey(locale), id);
      } catch {}
    },
    [locale],
  );

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
