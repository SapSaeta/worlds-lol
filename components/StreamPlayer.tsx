"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_STREAM_ID, STREAMS, type Stream } from "@/config/streams";
import type { LiveStream } from "@/lib/types";

const STORAGE_KEY = "worlds-lol:stream";

function embedUrl(s: Stream, host: string) {
  if (s.provider === "youtube") return `https://www.youtube.com/embed/${s.channel}?autoplay=1`;
  return `https://player.twitch.tv/?channel=${encodeURIComponent(s.channel)}&parent=${host}&autoplay=true`;
}

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

export function StreamPlayer({ liveStreams }: { liveStreams: LiveStream[] }) {
  const streams = useMemo(() => mergeStreams(liveStreams), [liveStreams]);
  const liveChannels = useMemo(() => new Set(liveStreams.map((l) => l.channel.toLowerCase())), [liveStreams]);

  const [host, setHost] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState(DEFAULT_STREAM_ID);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHost(window.location.hostname);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && STREAMS.some((s) => s.id === saved)) setCurrentId(saved);
    } catch {}
    const onFs = () => setIsFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menuOpen]);

  const current = streams.find((s) => s.id === currentId) ?? streams[0];

  function choose(id: string) {
    setCurrentId(id);
    setMenuOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }

  function toggleFullscreen() {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  }

  const groups: { title: string; items: Stream[] }[] = [
    { title: "Oficiales", items: streams.filter((s) => s.kind === "oficial") },
    { title: "Cooficiales en español", items: streams.filter((s) => s.kind === "cooficial") },
  ];

  return (
    <div className="player-col">
      <div ref={frameRef} className="player-frame pixel-box gold">
        {host ? (
          <iframe
            key={current.id}
            src={embedUrl(current, host)}
            title={`Emisión de ${current.label}`}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="player-placeholder px-title muted">Cargando emisión…</div>
        )}
      </div>

      <div className="player-bar pixel-box" ref={menuRef} style={{ position: "relative" }}>
        <div className="now">
          {liveChannels.has(current.channel.toLowerCase()) ? <span className="live-dot" aria-label="En directo" /> : null}
          <span className="px-title" style={{ whiteSpace: "nowrap" }}>
            {current.label}
          </span>
          <span className={`badge ${current.kind}`}>{current.kind}</span>
          <span className={`badge ${current.lang}`}>{current.lang}</span>
          {current.note ? <span className="muted">{current.note}</span> : null}
        </div>

        <button className="px-btn gold" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          Emisión {menuOpen ? "▴" : "▾"}
        </button>
        <button className="px-btn" onClick={toggleFullscreen} aria-label="Pantalla completa">
          {isFullscreen ? "Salir" : "⛶ Completa"}
        </button>

        {menuOpen ? (
          <div className="stream-menu pixel-box" role="menu">
            {groups.map((g) => (
              <div key={g.title}>
                <h3 className="px-small muted">{g.title}</h3>
                {g.items.map((s) => (
                  <button
                    key={s.id}
                    role="menuitemradio"
                    aria-checked={s.id === current.id}
                    aria-pressed={s.id === current.id}
                    className="stream-option cursor"
                    onClick={() => choose(s.id)}
                  >
                    <span className="name">{s.label}</span>
                    {liveChannels.has(s.channel.toLowerCase()) ? <span className="badge live">En vivo</span> : null}
                    <span className={`badge ${s.lang}`}>{s.lang}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
