// Página del resultado compartido. Su vista previa (og:image) es la tarjeta de
// la partida, así que al publicar el enlace la imagen sale dentro del post.

import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { STAGES } from "@/lib/game/engine";
import { fmt, fromQuery, resultLine, resultSub, stageStates, statsLine, toQuery } from "@/lib/game/result";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function read(searchParams: Props["searchParams"]) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") q.set(k, v);
  return fromQuery(q);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const r = await read(searchParams);
  if (!r) return { title: "Camino a la Copa · Worlddex" };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "worlddex.lol";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const image = {
    url: `${proto}://${host}/jugar/r/imagen?${toQuery(r)}`,
    width: 1200,
    height: 630,
    alt: `${resultLine(r)} · ${fmt(r.score)} puntos`,
  };
  const title = `${resultLine(r)} · Camino a la Copa`;
  const description = `${resultSub(r)}. ${fmt(r.score)} puntos con una sola vida. ¿Llegas tú más lejos?`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [image],
      type: "website",
      siteName: "Worlddex",
      locale: "es_ES",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

export default async function Resultado({ searchParams }: Props) {
  const r = await read(searchParams);
  if (!r) redirect("/jugar");
  return (
    <div className="page">
      <div className="g-end g-shared">
        <div className={`g-end-hero${r.champion ? " gold" : ""}`}>
          <h1 className={`screen-title g-big${r.champion ? " gold" : ""}`}>{resultLine(r)}</h1>
          <p className="g-end-sub">{resultSub(r)}</p>
          <ol className="g-track" aria-label="Hasta dónde llegó">
            {stageStates(r).map((s, i) => (
              <li key={STAGES[i].name} className={s}>
                <span aria-hidden>{s === "won" ? "✓" : s === "lost" ? "✗" : "·"}</span>
                {STAGES[i].name}
              </li>
            ))}
          </ol>
        </div>
        <div className="g-shared-body card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/jugar/r/imagen?${toQuery(r)}`} width={1200} height={630} alt={`Tarjeta de ${r.name}: ${fmt(r.score)} puntos`} />
          <p className="px-small muted">
            {r.name} ({r.team}) · {fmt(r.score)} puntos · {statsLine(r)}
          </p>
          <Link href="/jugar" className="btn g-share-main">
            ¡Te toca! Juega ahora
          </Link>
        </div>
      </div>
    </div>
  );
}
