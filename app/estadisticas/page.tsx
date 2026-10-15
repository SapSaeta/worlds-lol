import { TeamLogo } from "@/components/TeamLogo";
import { getWorldsData } from "@/lib/lolesports";

export const revalidate = 300;

export const metadata = { title: "Worlddex · Worlds LOL" };

export default async function Estadisticas() {
  const data = await getWorldsData();
  const teams = [...data.teams].sort((a, b) => (a.region ?? "").localeCompare(b.region ?? "") || a.code.localeCompare(b.code));
  return (
    <div className="page">
      <div className="dialog pixel-box">
        Esta es la <strong>Worlddex</strong>: aquí estarán todos los equipos, jugadores y los campeones más jugados y
        baneados del torneo. De momento puedes ver los equipos registrados.
        <span className="next">▼</span>
      </div>

      <div className="grid-cards">
        {teams.map((t, i) => (
          <div key={t.code} className="team-card pixel-box">
            <div className="px-small no">Nº {String(i + 1).padStart(3, "0")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "10px 0" }}>
              <TeamLogo code={t.code} image={t.image} size={40} />
              <div>
                <div className="px-title">{t.code}</div>
                <div className="muted">{t.name}</div>
              </div>
            </div>
            {t.region ? <span className="badge oficial">{t.region}</span> : null}{" "}
            <span className="record">
              <span className="w">{t.wins}</span>-<span className="l">{t.losses}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
