// Piezas visuales reutilizables al estilo pokelike.

export function HpBar({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const cls = v >= 0.5 ? "" : v >= 0.25 ? "mid" : "low";
  return (
    <div title={label}>
      <div className={`hp-bar ${cls}`}>
        <i style={{ width: `${v * 100}%` }} />
      </div>
      {label ? <div className="hp-text">{label}</div> : null}
    </div>
  );
}

export type Stat = { k: string; v: number; max: number; text?: string; gold?: boolean };

export function StatBars({ stats }: { stats: Stat[] }) {
  return (
    <div className="stats">
      {stats.map((s) => (
        <div key={s.k} style={{ display: "contents" }}>
          <span className="k">{s.k}</span>
          <span className={`bar ${s.gold ? "gold" : ""}`}>
            <i style={{ width: `${s.max ? Math.min(100, (s.v / s.max) * 100) : 0}%` }} />
          </span>
          <span className="v">{s.text ?? s.v}</span>
        </div>
      ))}
    </div>
  );
}

export const ROLE_LABEL: Record<string, string> = {
  top: "Top",
  jungle: "Jungla",
  mid: "Mid",
  bottom: "ADC",
  support: "Supp",
};

export const ROLE_ORDER = ["top", "jungle", "mid", "bottom", "support"];

export function RoleBadge({ role }: { role: string }) {
  return <span className={`role ${ROLE_LABEL[role] ? role : "none"}`}>{ROLE_LABEL[role] ?? (role || "—")}</span>;
}
