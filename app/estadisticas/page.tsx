import { HpBar, StatBars } from "@/components/Pixel";
import { TeamLogo } from "@/components/TeamLogo";
import { getWorldsData } from "@/lib/lolesports";

export const revalidate = 300;

export const metadata = { title: "Worlddex · Worlds LOL" };

export default async function Estadisticas() {
  const data = await getWorldsData();
  const teams = [...data.teams].sort((a, b) => (a.region ?? "").localeCompare(b.region ?? "") || a.code.localeCompare(b.code));
  const maxGames = Math.max(1, ...teams.map((t) => t.gameWins + t.gameLosses));
  return (
    <div className="page">
      <h1 className="screen-title">¡Worlddex!</h1>
      <p className="screen-subtitle">Equipos del torneo</p>

      <div className="grid-cards">
        {teams.map((t, i) => {
          const series = t.wins + t.losses;
          const wr = series ? t.wins / series : 0;
          return (
            <article key={t.code} className="card starter">
              <div className="px-small muted" style={{ textAlign: "left" }}>
                Nº {String(i + 1).padStart(3, "0")}
              </div>
              <div className="sprite">
                <TeamLogo code={t.code} image={t.image} size={64} />
              </div>
              <div className="name bold">{t.name}</div>
              <div className="lv">{t.code}</div>
              {t.region ? <span className="badge region">{t.region}</span> : <span className="badge">Worlds</span>}
              <StatBars
                stats={[
                  { k: "Vic", v: t.wins, max: Math.max(series, 1) },
                  { k: "Der", v: t.losses, max: Math.max(series, 1) },
                  { k: "Part", v: t.gameWins + t.gameLosses, max: maxGames },
                  { k: "Win%", v: wr * 100, max: 100, text: `${Math.round(wr * 100)}%`, gold: true },
                ]}
              />
              <HpBar value={series ? wr : 1} label={`${t.wins}/${series}`} />
              <div className="move inset">
                <div className="bold" style={{ fontSize: 20 }}>
                  Plantilla
                </div>
                <div className="px-small muted" style={{ marginTop: 4 }}>
                  {t.players.length ? `${t.players.length} jugadores` : "Próximamente"}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
