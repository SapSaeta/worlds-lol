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
      <div ref={frameRef} className="player-frame card dark">
        <div className="label px-small">
          {liveChannels.has(current.channel.toLowerCase()) ? <span className="live-dot" aria-label="En directo" /> : null}
          {current.kind === "oficial" ? "Emisión oficial" : "Cooficial"} · {current.label}
        </div>
        <div className="player-screen">
          {host ? (
            <iframe
              key={current.id}
              src={embedUrl(current, host)}
              title={`Emisión de ${current.label}`}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <div className="player-placeholder px-small">Cargando emisión…</div>
          )}
        </div>
      </div>

      <div className="player-bar card" ref={menuRef}>
        <div className="now">
          <span className="name bold">{current.label}</span>
          <span className={`badge ${current.kind}`}>{current.kind}</span>
          <span className={`badge ${current.lang}`}>{current.lang}</span>
          {current.note ? <span className="muted" style={{ whiteSpace: "nowrap" }}>{current.note}</span> : null}
        </div>

        <button className="btn" aria-expanded={menuOpen} aria-pressed={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          Cambiar emisión
        </button>
        <button className="btn dark" onClick={toggleFullscreen} aria-label="Pantalla completa">
          {isFullscreen ? "Salir" : "Pantalla completa"}
        </button>

        {menuOpen ? (
          <div className="stream-menu card" role="menu">
            {groups.map((g) => (
              <div key={g.title}>
                <h3 className="px-small">{g.title}</h3>
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
