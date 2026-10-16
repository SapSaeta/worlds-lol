// Página del resultado compartido. Su vista previa (og:image) es la tarjeta de
// la partida, así que al publicar el enlace la imagen sale dentro del post.

import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { fmt, fromQuery, gameName, replayHref, resultLine, resultSub, stageName, stageStates, statsLine, toQuery } from "@/lib/game/result";
import { isLocale, localePath, tr, type Locale } from "@/lib/i18n";

type Props = PageProps<"/[lang]/jugar/r">;

const lang = async (params: Props["params"]): Promise<Locale> => {
  const { lang } = await params;
  return isLocale(lang) ? lang : "es";
};

async function read(searchParams: Props["searchParams"]) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === "string") q.set(k, v);
  return fromQuery(q);
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const l = await lang(params);
  const r = await read(searchParams);
  if (!r) return { title: `${gameName(l)} · Worlddex` };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "worlddex.lol";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const image = {
    url: `${proto}://${host}${localePath(l, `/jugar/r/imagen?${toQuery(r)}`)}`,
    width: 1200,
    height: 630,
    alt: `${resultLine(r, l)} · ${fmt(r.score, l)} ${tr(l, "puntos", "points")}`,
  };
  const title = `${r.daily ? tr(l, `Reto #${r.daily} · `, `Challenge #${r.daily} · `) : ""}${resultLine(r, l)} · ${gameName(l)}`;
  const description = tr(
    l,
    `${resultSub(r, l)}. ${fmt(r.score, l)} puntos con una sola vida. ¿Llegas tú más lejos?`,
    `${resultSub(r, l)}. ${fmt(r.score, l)} points with a single life. Can you go further?`,
  );
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [image],
      type: "website",
      siteName: "Worlddex",
      locale: l === "en" ? "en_US" : "es_ES",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

export default async function Resultado({ params, searchParams }: Props) {
  const l = await lang(params);
  const T = (es: string, en: string) => tr(l, es, en);
  const r = await read(searchParams);
  if (!r) redirect(localePath(l, "/jugar"));
  return (
    <div className="page">
      <div className="g-end g-shared">
        <div className={`g-end-hero${r.champion ? " gold" : ""}`}>
          <h1 className={`screen-title g-big${r.champion ? " gold" : ""}`}>{resultLine(r, l)}</h1>
          <p className="g-end-sub">{resultSub(r, l)}</p>
          <ol className="g-track" aria-label={T("Hasta dónde llegó", "How far they got")}>
            {stageStates(r).map((s, i) => (
              <li key={i} className={s}>
                <span aria-hidden>{s === "won" ? "✓" : s === "lost" ? "✗" : "·"}</span>
                {stageName(i, l)}
              </li>
            ))}
          </ol>
        </div>
        <div className="g-shared-body card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={localePath(l, `/jugar/r/imagen?${toQuery(r)}`)}
            width={1200}
            height={630}
            alt={T(`Tarjeta de ${r.name}: ${fmt(r.score, l)} puntos`, `${r.name}'s card: ${fmt(r.score, l)} points`)}
          />
          <p className="px-small muted">
            {r.name} ({r.team}) · {fmt(r.score, l)} {T("puntos", "points")} · {statsLine(r, l)}
          </p>
          {r.seed ? (
            <>
              <Link href={replayHref(r, l)} className="btn g-share-main">
                {r.daily ? T(`¡Juega el reto #${r.daily}!`, `Play challenge #${r.daily}!`) : T("¡Juega su misma partida!", "Play the same run!")}
              </Link>
              <p className="px-small muted">{T("Mismos entrenadores y mismo mapa. ¿Llegas más lejos?", "Same trainers, same map. Can you go further?")}</p>
              <Link href={localePath(l, "/jugar")} className="btn">
                {T("Partida nueva", "New run")}
              </Link>
            </>
          ) : (
            <Link href={localePath(l, "/jugar")} className="btn g-share-main">
              {T("¡Te toca! Juega ahora", "Your turn! Play now")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
