"use client";

// Dibuja una imagen a baja resolución y la amplía sin suavizado, para que los
// iconos de campeones y las fotos de jugadores parezcan sprites.

import { useEffect, useRef } from "react";

export function PixelImg({ src, alt, size = 64, res = 28, className = "" }: { src: string; alt: string; size?: number; res?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !src) return;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, res, res);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "medium";
      // Recorte centrado y cuadrado
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      const sy = (img.naturalHeight - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, res, res);
    };
    img.src = src;
    return () => {
      img.onload = null;
    };
  }, [src, res]);

  return <canvas ref={ref} width={res} height={res} role="img" aria-label={alt} className={`pixel-img ${className}`} style={{ width: size, height: size }} />;
}
