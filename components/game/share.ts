// Tarjeta final para compartir: se dibuja en un canvas de 1080x1080 con el
// entrenador, el equipo y la puntuación, y se comparte o se descarga.

import { STAGES, score, type Run } from "@/lib/game/engine";
import type { GameData } from "@/lib/game/types";

const SIZE = 1080;

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

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = "#e7e4d9") {
  ctx.fillStyle = "#2b66a8";
  ctx.fillRect(x + 12, y + 12, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#2a2a2a";
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, font = "Press Start 2P", align: CanvasTextAlign = "left") {
  ctx.font = `${size}px "${font}"`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

export function resultLine(run: Run) {
  return run.over === "champion" ? "¡CAMPEÓN DEL MUNDO!" : `Eliminado en ${STAGES[run.stage].name}`;
}

export async function drawCard(run: Run, data: GameData): Promise<HTMLCanvasElement> {
  await Promise.all([document.fonts.load('40px "Press Start 2P"'), document.fonts.load('40px "VT323"')]).catch(() => null);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  // Fondo: la escena de la web
  ctx.fillStyle = "#081429";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const scene = await load("/scene.svg", false);
  if (scene) {
    ctx.imageSmoothingEnabled = false;
    const h = SIZE;
    const w = (scene.naturalWidth / scene.naturalHeight) * h;
    ctx.drawImage(scene, (SIZE - w) / 2, 0, w, h);
  }

  text(ctx, "CAMINO A LA COPA", SIZE / 2 + 4, 64, 46, "#1e1e1e", undefined, "center");
  text(ctx, "CAMINO A LA COPA", SIZE / 2, 60, 46, "#f8d860", undefined, "center");
  text(ctx, resultLine(run), SIZE / 2, 140, 26, run.over === "champion" ? "#f8d860" : "#8cc2f7", undefined, "center");

  // Entrenador
  box(ctx, 80, 210, SIZE - 160, 230);
  const team = data.teams.find((t) => t.code === run.trainer.team);
  const [photo, logo] = await Promise.all([load(run.trainer.image), load(team?.image ?? "")]);
  if (photo) pixelated(ctx, photo, 112, 240, 168, 32);
  else if (logo) pixelated(ctx, logo, 112, 240, 168, 32);
  text(ctx, "ENTRENADOR", 312, 246, 18, "#4a4a44");
  text(ctx, run.trainer.name, 312, 284, 64, "#1e1e1e", "VT323");
  text(ctx, `${team?.name ?? run.trainer.team}`, 312, 352, 40, "#4a4a44", "VT323");
  if (logo) pixelated(ctx, logo, SIZE - 80 - 32 - 120, 250, 120, 40);

  // Equipo
  box(ctx, 80, 480, SIZE - 160, 330);
  text(ctx, "SU EQUIPO", 112, 512, 18, "#4a4a44");
  const icons = await Promise.all(run.team.map((u) => load(data.champions[u.champ]?.icon ?? "")));
  const slot = (SIZE - 160 - 64) / 5;
  run.team.forEach((u, i) => {
    const c = data.champions[u.champ];
    const x = 112 + i * slot;
    const img = icons[i];
    ctx.fillStyle = "#dcd8ca";
    ctx.fillRect(x, 556, slot - 24, slot - 24);
    if (img) pixelated(ctx, img, x, 556, slot - 24, 28);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#2a2a2a";
    ctx.strokeRect(x, 556, slot - 24, slot - 24);
    text(ctx, c?.name ?? u.champ, x + (slot - 24) / 2, 556 + slot - 12, 34, "#1e1e1e", "VT323", "center");
    text(ctx, `Nv ${u.level}`, x + (slot - 24) / 2, 556 + slot + 22, 16, "#b89a30", undefined, "center");
  });

  // Puntuación
  box(ctx, 80, 850, SIZE - 160, 130, "#1f4c80");
  text(ctx, "PUNTOS", 112, 890, 26, "#f9d97c");
  text(ctx, score(run).toLocaleString("es-ES"), SIZE - 112, 880, 52, "#f8d860", undefined, "right");
  text(ctx, "worlddex.lol/jugar", SIZE / 2, 1020, 22, "#8cc2f7", undefined, "center");
  return canvas;
}

export const toBlob = (canvas: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));

export function shareText(run: Run) {
  const where = run.over === "champion" ? "¡he ganado el Mundial" : `he llegado a ${STAGES[run.stage].name}`;
  return `En Camino a la Copa ${where} con ${run.trainer.name} (${run.trainer.team}): ${score(run).toLocaleString("es-ES")} puntos. ¿Me superas?`;
}

export function xIntent(run: Run, url: string) {
  return `https://x.com/intent/post?text=${encodeURIComponent(shareText(run))}&url=${encodeURIComponent(url)}`;
}
