"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
import type { Stream } from "@/config/streams";
import { useLocale } from "@/components/LocaleProvider";
import { usePlayer } from "@/components/player/PlayerProvider";

function embedUrl(s: Stream, host: string) {
  if (s.provider === "youtube") return `https://www.youtube.com/embed/${s.channel}?autoplay=1`;
  return `https://player.twitch.tv/?channel=${encodeURIComponent(s.channel)}&parent=${host}&autoplay=true`;
}

type Box = { top: number; left: number; width: number; height: number };

/** Sigue la posición del hueco de la portada para pintar encima el reproductor grande. */
function useSlotBox(slot: HTMLElement | null) {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    if (!slot) {
      setBox(null);
      return;
    }
    const measure = () => {
      const r = slot.getBoundingClientRect();
      setBox({ top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [slot]);
  return box;
}

/**
 * El único iframe de la web. Siempre es el mismo elemento: solo cambia de
 * sitio y tamaño con CSS, así la emisión no se corta al navegar.
 */
export function PlayerDock() {
  const { current, liveChannels, slot, active, start, close, frameRef, isFullscreen, toggleFullscreen } = usePlayer();
  const { t, href } = useLocale();
  const [host, setHost] = useState<string | null>(null);
  const box = useSlotBox(slot);

  useEffect(() => setHost(window.location.hostname), []);

  // Entrar en la portada (o volver a ella) arranca la emisión.
  useEffect(() => {
    if (slot) start();
  }, [slot, start]);

  if (!active) return null;

  const docked = !!slot;

  const live = liveChannels.has(current.channel.toLowerCase());
  return (
    <div
      ref={frameRef}
      className={`player-frame player-dock card dark ${docked ? "docked" : "mini"}`}
      style={
        docked
          ? box
            ? { top: box.top, left: box.left, width: box.width, height: box.height }
            : { visibility: "hidden" }
          : undefined
      }
    >
      <div className="label px-small">
        {live ? <span className="live-dot" aria-label={t("En directo", "Live")} /> : null}
        <span className="dock-title">
          {current.kind === "oficial" ? t("Emisión oficial", "Official broadcast") : t("Cooficial", "Co-stream")} · {current.label}
        </span>
        <span className="dock-actions">
          <button className="dock-btn" onClick={toggleFullscreen} aria-label={isFullscreen ? t("Salir de pantalla completa", "Exit fullscreen") : t("Pantalla completa", "Fullscreen")} title={t("Pantalla completa", "Fullscreen")}>
            ⛶
          </button>
          <Link href={href("/")} className="dock-btn" aria-label={t("Ver en grande", "Watch full size")} title={t("Ver en grande", "Watch full size")}>
            ⤢
          </Link>
          <button className="dock-btn" onClick={close} aria-label={t("Cerrar emisión", "Close stream")} title={t("Cerrar", "Close")}>
            ✕
          </button>
        </span>
      </div>
      <div className="player-screen">
        {host ? (
          <iframe
            key={current.id}
            src={embedUrl(current, host)}
            title={t(`Emisión de ${current.label}`, `${current.label} stream`)}
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <div className="player-placeholder px-small">{t("Cargando emisión…", "Loading stream…")}</div>
        )}
      </div>
    </div>
  );
}
