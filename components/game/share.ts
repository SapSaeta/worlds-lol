// Lo que se comparte al acabar: el mensaje (con emojis y la ruta por fases,
// al estilo de Wordle), el enlace propio del resultado y una tarjeta dibujada
// en canvas, cuadrada para posts o vertical para historias de Instagram y TikTok.

import { score, type Run } from "@/lib/game/engine";
import * as R from "@/lib/game/result";
import type { GameData } from "@/lib/game/types";
import { localePath, tr, type Locale } from "@/lib/i18n";

export type CardFormat = "square" | "story";

const W = 1080;
const HEIGHT: Record<CardFormat, number> = { square: 1080, story: 1920 };


/** La fuente pixel no trae mayúsculas con tilde: en los titulares van sin ella. */
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").normalize("NFC");

export function toResult(run: Run): R.SharedResult {
  return {
    name: run.partner ? `${run.trainer.name} & ${run.partner.name}` : run.trainer.name,
    team: run.trainer.team,
    stage: run.stage,
    champion: run.over === "champion",
    score: score(run),
    wins: run.wins,
    objectives: run.objectives,
    bosses: run.bosses,
    killer: run.killer,
    champs: run.team.map((u) => ({ id: u.champ, level: u.level })),
    seed: run.seed,
    daily: run.daily,
  };
}

export const resultLine = (run: Run, l: Locale = "es") => R.resultLine(toResult(run), l);
export const resultSub = (run: Run, l: Locale = "es") => R.resultSub(toResult(run), l);
export const stageStates = (run: Run) => R.stageStates(toResult(run));
export const shareText = (run: Run, l: Locale = "es") => R.shareText(toResult(run), l);

/** Enlace propio del resultado: al publicarlo, la red enseña la tarjeta como vista previa. */
export const resultUrl = (run: Run, origin: string, l: Locale = "es") => `${origin}${localePath(l, `/jugar/r?${R.toQuery(toResult(run))}`)}`;

export const xIntent = (run: Run, url: string, l: Locale = "es") => `https://x.com/intent/post?text=${encodeURIComponent(shareText(run, l))}&url=${encodeURIComponent(url)}`;
export const whatsappLink = (run: Run, url: string, l: Locale = "es") => `https://wa.me/?text=${encodeURIComponent(`${shareText(run, l)}\n${url}`)}`;
export const telegramLink = (run: Run, url: string, l: Locale = "es") => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(shareText(run, l))}`;

// ---------- Tarjeta ----------

function load(src: string, proxy = true): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = proxy ? `/api/img?u=${encodeURIComponent(src)}` : src;
  });
}

/** Dibuja la imagen en baja resolución y la amplía sin suavizar, como un sprite. */
function pixelated(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number, res = 28) {
  const tmp = document.createElement("canvas");
  tmp.width = res;
  tmp.height = res;
  const t = tmp.getContext("2d")!;
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  t.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, res, res);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, x, y, size, size);
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = "#e7e4d9", shadow = "#2b66a8") {
  ctx.fillStyle = shadow;
  ctx.fillRect(x + 12, y + 12, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#1e1e1e";
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
}

type TextOpts = { font?: string; align?: CanvasTextAlign; outline?: number; shadow?: number };

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, o: TextOpts = {}) {
  ctx.font = `${size}px "${o.font ?? "Press Start 2P"}"`;
  ctx.textAlign = o.align ?? "left";
  ctx.textBaseline = "top";
  if (o.shadow) {
    ctx.fillStyle = "#1e1e1e";
    ctx.fillText(s, x + o.shadow, y + o.shadow);
  }
  if (o.outline) {
    ctx.lineJoin = "miter";
    ctx.lineWidth = o.outline;
    ctx.strokeStyle = "#1e1e1e";
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** Texto centrado que se encoge hasta caber en el ancho dado. */
function fit(ctx: CanvasRenderingContext2D, s: string, y: number, size: number, maxW: number, color: string, o: TextOpts = {}) {
  let px = size;
  ctx.font = `${px}px "${o.font ?? "Press Start 2P"}"`;
  while (px > 12 && ctx.measureText(s).width > maxW) {
    px -= 2;
    ctx.font = `${px}px "${o.font ?? "Press Start 2P"}"`;
  }
  text(ctx, s, W / 2, y, px, color, { ...o, align: "center" });
  return px;
}

/** Rayos de luz detrás del titular, en bloques pixelados. */
function rays(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = color;
  const n = 18;
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Parte un titular en líneas que quepan con la fuente pixel. */
function lines(ctx: CanvasRenderingContext2D, s: string, size: number, maxW: number) {
  ctx.font = `${size}px "Press Start 2P"`;
  const out: string[] = [];
  let cur = "";
  for (const w of s.split(" ")) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/** Medidas de cada formato: cuadrado para posts, vertical para historias. */
const LAYOUT = {
  square: { top: 40, title: 30, afterTitle: 56, head: 60, headGap: 22, cup: 110, rays: 640, sub: 44, afterSub: 70, cellH: 70, afterTrack: 32, boxH: 274, photo: 104, name: 56, team: 34, iconY: 146, icon: 88, iconName: 28, afterBox: 30, scoreH: 112, score: 58, cta: 96, ctaBottom: 0 },
  story: { top: 110, title: 40, afterTitle: 90, head: 76, headGap: 26, cup: 220, rays: 900, sub: 52, afterSub: 110, cellH: 104, afterTrack: 60, boxH: 430, photo: 150, name: 72, team: 42, iconY: 200, icon: 150, iconName: 34, afterBox: 60, scoreH: 200, score: 84, cta: 150, ctaBottom: 80 },
};

export async function drawCard(run: Run, data: GameData, format: CardFormat = "square", l: Locale = "es"): Promise<HTMLCanvasElement> {
  await Promise.all([document.fonts.load('40px "Press Start 2P"'), document.fonts.load('40px "VT323"')]).catch(() => null);
  const H = HEIGHT[format];
  const L = LAYOUT[format];
  const story = format === "story";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  let ctx = canvas.getContext("2d")!;
  const champion = run.over === "champion";
  const accent = champion ? "#f8d860" : run.stage >= 3 ? "#ff8a3d" : "#ff5a5a";

  // Fondo: la escena de la web, algo oscurecida para que resalte el texto
  ctx.fillStyle = "#081429";
  ctx.fillRect(0, 0, W, H);
  const [scene, cup] = await Promise.all([load("/scene.svg", false), load("/logo.svg", false)]);
  if (scene) {
    ctx.imageSmoothingEnabled = false;
    const w = (scene.naturalWidth / scene.naturalHeight) * H;
    ctx.drawImage(scene, (W - w) / 2, 0, w, H);
  }
  ctx.fillStyle = "rgba(8, 20, 41, 0.35)";
  ctx.fillRect(0, 0, W, H);
  const base = ctx;
  // El contenido se dibuja en una capa aparte para centrarlo luego en el hueco libre.
  const layer = document.createElement("canvas");
  layer.width = W;
  layer.height = H;
  ctx = layer.getContext("2d")!;

  let y = L.top;
  fit(ctx, R.cardTitle(run, l), y, L.title, W - 120, run.daily ? "#f8d860" : "#8cc2f7", { shadow: 4 });
  y += L.afterTitle;

  // Titular con rayos detrás, y la copa si eres campeón
  const head = lines(ctx, plain(resultLine(run, l).toUpperCase()), L.head, W - 120);
  const cupSize = champion && cup ? L.cup : 0;
  rays(ctx, W / 2, y + (cupSize + head.length * (L.head + L.headGap)) / 2, L.rays, accent);
  if (cup && cupSize) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cup, (W - cupSize) / 2, y, cupSize, cupSize);
    y += cupSize + 12;
  }
  for (const l of head) {
    fit(ctx, l, y, L.head, W - 100, accent, { outline: 14, shadow: 8 });
    y += L.head + L.headGap;
  }
  fit(ctx, resultSub(run, l), y + 2, L.sub, W - 140, "#ffffff", { font: "VT323", shadow: 3 });
  y += L.afterSub;

  // Ruta por fases
  const gap = 14;
  const cell = (W - 160 - gap * 4) / 5;
  stageStates(run).forEach((s, i) => {
    const x = 80 + i * (cell + gap);
    const ink = s === "none" ? "#5a6478" : "#ffffff";
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(x + 6, y + 6, cell, L.cellH);
    ctx.fillStyle = s === "won" ? "#3fa34d" : s === "lost" ? "#d04040" : "#2a3446";
    ctx.fillRect(x, y, cell, L.cellH);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#1e1e1e";
    ctx.strokeRect(x + 2.5, y + 2.5, cell - 5, L.cellH - 5);
    text(ctx, s === "won" ? "✓" : s === "lost" ? "✗" : "·", x + cell / 2, y + L.cellH * 0.1, L.cellH * 0.42, ink, { font: "VT323", align: "center" });
    text(ctx, R.stageShort(l)[i], x + cell / 2, y + L.cellH * 0.68, story ? 15 : 12, ink, { align: "center" });
  });
  y += L.cellH + L.afterTrack;

  // Entrenador y equipo
  const team = data.teams.find((t) => t.code === run.trainer.team);
  box(ctx, 80, y, W - 160, L.boxH);
  const [photo, logo] = await Promise.all([load(run.trainer.image), load(team?.image ?? "")]);
  const pic = photo ?? logo;
  if (pic) pixelated(ctx, pic, 112, y + 28, L.photo, 32);
  const tx = 112 + L.photo + 28;
  text(ctx, tr(l, "ENTRENADOR", "TRAINER"), tx, y + 34, story ? 18 : 15, "#4a4a44");
  text(ctx, run.trainer.name, tx, y + 34 + (story ? 30 : 24), L.name, "#1e1e1e", { font: "VT323" });
  text(ctx, team?.name ?? run.trainer.team, tx, y + 34 + (story ? 30 : 24) + L.name * 0.92, L.team, "#4a4a44", { font: "VT323" });
  if (logo) pixelated(ctx, logo, W - 112 - L.photo * 0.8, y + 28, L.photo * 0.8, 40);
  const icons = await Promise.all(run.team.map((u) => load(data.champions[u.champ]?.icon ?? "")));
  const slot = (W - 224) / 5;
  run.team.forEach((u, i) => {
    const c = data.champions[u.champ];
    const x = 112 + i * slot + (slot - 24 - L.icon) / 2;
    const iy = y + L.iconY;
    ctx.fillStyle = "#dcd8ca";
    ctx.fillRect(x, iy, L.icon, L.icon);
    const img = icons[i];
    if (img) pixelated(ctx, img, x, iy, L.icon, 28);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#1e1e1e";
    ctx.strokeRect(x, iy, L.icon, L.icon);
    text(ctx, (c?.name ?? u.champ).slice(0, 10), x + L.icon / 2, iy + L.icon + 4, L.iconName, "#1e1e1e", { font: "VT323", align: "center" });
    if (story) text(ctx, `${tr(l, "Nv", "Lv")} ${u.level}`, x + L.icon / 2, iy + L.icon + 42, 16, "#b89a30", { align: "center" });
  });
  y += L.boxH + L.afterBox;

  // Puntos y resumen
  box(ctx, 80, y, W - 160, L.scoreH, "#1f4c80", "#0d2a4d");
  text(ctx, tr(l, "PUNTOS", "POINTS"), 116, y + (story ? 40 : 28), story ? 26 : 20, "#f9d97c");
  text(ctx, R.fmt(score(run), l), W - 116, y + (story ? 26 : 22), L.score, "#f8d860", { align: "right", shadow: 6 });
  const stats = R.statsLine(toResult(run), l);
  const cta = tr(l, "¿ME SUPERAS?", "CAN YOU BEAT ME?");
  const site = tr(l, "worlddex.lol/jugar", "worlddex.lol/en/play");
  if (story) text(ctx, stats, W / 2, y + 140, 44, "#cfe4ff", { font: "VT323", align: "center" });
  else text(ctx, stats, 116, y + 64, 32, "#cfe4ff", { font: "VT323" });
  y += L.scoreH + 12;

  // Reto: franja amarilla abajo; el contenido se centra en lo que queda encima
  const cy = H - L.cta - L.ctaBottom;
  const shift = Math.max(0, Math.floor((cy - 6 - y) / 2));
  base.drawImage(layer, 0, shift);
  ctx = base;
  ctx.fillStyle = "#1e1e1e";
  ctx.fillRect(0, cy - 6, W, L.cta + 12);
  ctx.fillStyle = "#f8d860";
  ctx.fillRect(0, cy, W, L.cta);
  if (story) {
    text(ctx, cta, W / 2, cy + 26, 44, "#1e1e1e", { align: "center" });
    text(ctx, site, W / 2, cy + 88, 30, "#1e1e1e", { align: "center" });
  } else {
    text(ctx, cta, 60, cy + 33, l === "en" ? 26 : 30, "#1e1e1e");
    text(ctx, site, W - 60, cy + 37, l === "en" ? 20 : 22, "#1e1e1e", { align: "right" });
  }
  return canvas;
}

export const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
