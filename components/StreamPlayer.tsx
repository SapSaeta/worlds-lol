"use client";

import { useEffect, useRef, useState } from "react";
import type { Stream } from "@/config/streams";
import { usePlayer } from "@/components/player/PlayerProvider";
import type { LiveStream } from "@/lib/types";

/**
 * Columna del reproductor en la portada. El iframe no está aquí sino en
 * PlayerDock (layout), que se coloca encima de este hueco; así sigue sonando
 * en miniatura al cambiar de pestaña.
 */
export function StreamPlayer({ liveStreams }: { liveStreams: LiveStream[] }) {
  const { streams, current, liveChannels, choose, setLiveStreams, setSlot, isFullscreen, toggleFullscreen } = usePlayer();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => setLiveStreams(liveStreams), [liveStreams, setLiveStreams]);

  useEffect(() => {
    if (!menuOpen) return;
    listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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

  function pick(id: string) {
    choose(id);
    setMenuOpen(false);
  }

  const groups: { title: string; items: Stream[] }[] = [
    { title: "Oficiales", items: streams.filter((s) => s.kind === "oficial") },
    { title: "Cooficiales en español", items: streams.filter((s) => s.kind === "cooficial") },
  ];

  return (
    <div className="player-col">
      {/* Hueco con la misma forma que el reproductor; PlayerDock se pinta encima. */}
      <div ref={setSlot} className="player-frame player-slot card dark" aria-hidden="true">
        <div className="label px-small">&nbsp;</div>
        <div className="player-screen" />
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
          <div ref={listRef} className="stream-menu card" role="menu">
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
                    onClick={() => pick(s.id)}
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
