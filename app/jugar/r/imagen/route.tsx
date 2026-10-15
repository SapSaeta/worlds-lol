// Tarjeta del resultado en 1200x630 para la vista previa de los enlaces
// (og:image): X, WhatsApp, Telegram o Discord la enseñan dentro del post.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { championIcon, getChampions } from "@/lib/ddragon";
import { STAGE_SHORT, fmt, fromQuery, resultLine, resultSub, stageStates, statsLine } from "@/lib/game/result";

const file = (p: string) => readFile(join(process.cwd(), p));
const svgData = async (p: string) => `data:image/svg+xml;base64,${(await file(p)).toString("base64")}`;

/** La fuente pixel no trae mayúsculas con tilde: el titular va sin ellas. */
const plain = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");

export async function GET(req: Request) {
  const r = fromQuery(new URL(req.url).searchParams);
  if (!r) return new Response("Resultado no válido", { status: 400 });

  const [pixel, body, scene, cup, dd] = await Promise.all([
    file("assets/fonts/PressStart2P-Regular.ttf"),
    file("assets/fonts/VT323-Regular.ttf"),
    svgData("public/scene.svg"),
    svgData("public/logo.svg"),
    getChampions().catch(() => null),
  ]);
  const champs = r.champs.filter((c) => dd?.champions[c.id]);
  const accent = r.champion ? "#f8d860" : r.stage >= 3 ? "#ff8a3d" : "#ff5a5a";
  const head = plain(resultLine(r).toUpperCase());
  const headSize = Math.min(54, Math.floor(1060 / head.length));
  const outline = "4px 4px 0 #1e1e1e";

  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        position: "relative",
        background: "#081429",
        fontFamily: "VT323",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={scene}
        width={1200}
        height={630}
        alt=""
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1200,
          height: 630,
          objectFit: "cover",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1200,
          height: 630,
          display: "flex",
          backgroundImage: `radial-gradient(circle at 50% 28%, ${r.champion ? "rgba(248,216,96,0.45)" : "rgba(255,90,90,0.38)"}, rgba(8,20,41,0.35) 62%)`,
        }}
      />
      {/* Contenido repartido en el alto que deja libre la franja de abajo */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: 1200,
          height: 566,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-around",
          padding: "14px 0 18px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Press Start 2P",
            fontSize: 22,
            color: "#8cc2f7",
            textShadow: "3px 3px 0 #1e1e1e",
          }}
        >
          CAMINO A LA COPA
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {r.champion ? <img src={cup} width={72} height={72} alt="" /> : null}
          <div
            style={{
              display: "flex",
              fontFamily: "Press Start 2P",
              fontSize: headSize,
              color: accent,
              textShadow: outline,
            }}
          >
            {head}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {r.champion ? <img src={cup} width={72} height={72} alt="" /> : null}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 40,
            color: "#ffffff",
            textShadow: "2px 2px 0 #1e1e1e",
          }}
        >
          {resultSub(r)}
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {stageStates(r).map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 190,
                height: 46,
                fontFamily: "Press Start 2P",
                fontSize: 14,
                color: s === "none" ? "#5a6478" : "#ffffff",
                background: s === "won" ? "#3fa34d" : s === "lost" ? "#d04040" : "#2a3446",
                border: "4px solid #1e1e1e",
                boxShadow: "5px 5px 0 #000",
              }}
            >
              {STAGE_SHORT[i]}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 24, width: 1060 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              padding: "14px 20px",
              background: "#e7e4d9",
              border: "5px solid #1e1e1e",
              boxShadow: "9px 9px 0 #2b66a8",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
              <span
                style={{
                  fontFamily: "Press Start 2P",
                  fontSize: 13,
                  color: "#4a4a44",
                }}
              >
                ENTRENADOR
              </span>
              <span style={{ fontSize: 44, color: "#1e1e1e" }}>{r.name}</span>
              <span style={{ fontSize: 32, color: "#4a4a44" }}>{r.team}</span>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
              {champs.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={championIcon(dd!.version, c.id)} width={74} height={74} alt="" style={{ border: "4px solid #1e1e1e" }} />
                  <span
                    style={{
                      fontFamily: "Press Start 2P",
                      fontSize: 11,
                      color: "#b89a30",
                      marginTop: 4,
                    }}
                  >
                    Nv {c.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              width: 400,
              padding: "14px 22px",
              background: "#1f4c80",
              border: "5px solid #1e1e1e",
              boxShadow: "9px 9px 0 #0d2a4d",
            }}
          >
            <span
              style={{
                fontFamily: "Press Start 2P",
                fontSize: 16,
                color: "#f9d97c",
              }}
            >
              PUNTOS
            </span>
            <span
              style={{
                fontFamily: "Press Start 2P",
                fontSize: 46,
                color: "#f8d860",
                textShadow: outline,
                marginTop: 10,
              }}
            >
              {fmt(r.score)}
            </span>
            <span style={{ fontSize: 26, color: "#cfe4ff", marginTop: 10 }}>{statsLine(r)}</span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: 1200,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          background: "#f8d860",
          borderTop: "6px solid #1e1e1e",
          fontFamily: "Press Start 2P",
          color: "#1e1e1e",
        }}
      >
        <span style={{ fontSize: 24 }}>¿ME SUPERAS?</span>
        <span style={{ fontSize: 18 }}>worlddex.lol/jugar</span>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Press Start 2P", data: pixel, style: "normal", weight: 400 },
        { name: "VT323", data: body, style: "normal", weight: 400 },
      ],
      // La imagen solo depende del enlace: se puede guardar para siempre.
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
