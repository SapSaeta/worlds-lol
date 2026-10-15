"use client";

// Piezas pequeñas del juego: sprites, iconos pixelados, barras de vida y fichas.

import { PixelImg } from "@/components/PixelImg";
import { CLS_LABEL, type Derived } from "@/lib/game/engine";
import type { GChamp, GItem, Stats } from "@/lib/game/types";

/* ---------- Iconos en rejilla de 8x8 ---------- */

const ICONS: Record<string, { grid: string[]; colors: Record<string, string> }> = {
  fight: {
    grid: ["......xx", ".....xwx", "....xwx.", "x..xwx..", "xx.wx...", ".xx.....", ".gxx....", "gg.x...."],
    colors: { x: "#2a2a2a", w: "#e8e8f0", g: "#b8862f" },
  },
  shop: {
    grid: ["..xxxx..", ".xyyyyx.", "xyyxxyyx", "xyxyyyyx", "xyyxxyyx", "xyyyyxyx", ".xyxxyx.", "..xxxx.."],
    colors: { x: "#7a5a10", y: "#f8d860" },
  },
  event: {
    grid: ["..xxxx..", ".xx..xx.", ".....xx.", "....xx..", "...xx...", "...xx...", "........", "...xx..."],
    colors: { x: "#2b66a8" },
  },
  fountain: {
    grid: [".xx..xx.", "xrrxxrrx", "xrrrrrrx", "xrrrrrrx", ".xrrrrx.", "..xrrx..", "...xx...", "........"],
    colors: { x: "#2a2a2a", r: "#e04848" },
  },
  objective: {
    grid: ["x......x", "xx.xx.xx", ".xppppx.", ".pwppwp.", ".pppppp.", "..pxxp..", "..pppp..", "...pp..."],
    colors: { x: "#2a2a2a", p: "#8a50c8", w: "#f8d860" },
  },
  boss: {
    grid: ["........", "y..y..y.", "yy.yy.yy", "yyyyyyyy", "yryyyryy", "yyyyyyyy", "yyyyyyyy", "........"],
    colors: { y: "#f8d860", r: "#e04848" },
  },
};

export function PixelIcon({ name, size = 24 }: { name: keyof typeof ICONS | string; size?: number }) {
  const icon = ICONS[name] ?? ICONS.event;
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      {icon.grid.flatMap((row, y) =>
        [...row].map((ch, x) => (icon.colors[ch] ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={icon.colors[ch]} /> : null)),
      )}
    </svg>
  );
}

/** Sprite de campeón: el icono oficial pixelado. Los monstruos usan su icono del juego. */
export function ChampSprite({ champ, size = 64, res = 28 }: { champ: GChamp; size?: number; res?: number }) {
  const src = champ.icon.startsWith("monster:") ? champ.icon.slice(8) : champ.icon;
  return <PixelImg src={src} alt={champ.name} size={size} res={res} />;
}

/** Retrato de combate: el sprite en un marco redondo del color de cada lado. */
export function Portrait({ champ, size, side, className = "" }: { champ: GChamp; size: number; side: "me" | "foe"; className?: string }) {
  const monster = champ.icon.startsWith("monster:");
  return (
    <span className={`g-portrait ${side}${monster ? " monster" : ""} ${className}`} style={{ width: size, height: size }}>
      <ChampSprite champ={champ} size={size} res={monster ? 44 : 40} />
    </span>
  );
}

export function TypeBadge({ cls }: { cls: string }) {
  return <span className={`badge t-${cls}`}>{CLS_LABEL[cls as keyof typeof CLS_LABEL] ?? "Monstruo"}</span>;
}

export function Hp({ hp, max, shield = 0, showNumbers = true }: { hp: number; max: number; shield?: number; showNumbers?: boolean }) {
  const v = Math.max(0, Math.min(1, hp / Math.max(1, max)));
  const cls = v >= 0.5 ? "" : v >= 0.25 ? "mid" : "low";
  return (
    <div className="g-hp">
      <div className={`hp-bar ${cls}`}>
        <i style={{ width: `${v * 100}%` }} />
        {shield > 0 ? <b style={{ width: `${Math.min(1, shield / Math.max(1, max)) * 100}%` }} /> : null}
      </div>
      {showNumbers ? (
        <span className="g-hp-num">
          {Math.max(0, Math.round(hp))}/{max}
        </span>
      ) : null}
    </div>
  );
}

const STAT_LABEL: Record<string, string> = { hp: "Vida", ad: "Daño", ap: "Poder", ar: "Armadura", mr: "Res. mágica", crit: "Crítico", as: "Vel. ataque", ms: "Velocidad", ls: "Robo de vida" };

export function statsText(s: Stats) {
  return Object.entries(s)
    .map(([k, v]) => `+${k === "crit" || k === "as" || k === "ls" ? `${Math.round((v ?? 0) * 100)} %` : v} ${STAT_LABEL[k] ?? k}`)
    .join(" · ");
}

export function ItemIcon({ item, size = 28 }: { item: GItem; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="g-item" src={item.icon} alt={item.name} title={`${item.name}: ${statsText(item.stats)}`} width={size} height={size} loading="lazy" />;
}

export function StatLine({ d, magic }: { d: Derived; magic: boolean }) {
  return (
    <div className="g-statline px-small">
      <span>{magic ? `PH ${d.ap}` : `AD ${d.ad}`}</span>
      <span>ARM {d.ar}</span>
      <span>RM {d.mr}</span>
      {d.crit ? <span>CRIT {Math.round(d.crit * 100)}%</span> : null}
    </div>
  );
}
