"use client";

// Tabla de tipos del combate: contra quién pega fuerte cada clase y de quién
// recibe. Resalta las clases que hay ahora en el campo.

import { useEffect, useRef } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { TypeBadge } from "@/components/game/parts";
import { STRONG, type Battle } from "@/lib/game/engine";
import type { Cls } from "@/lib/game/types";

const ORDER: Cls[] = ["Fighter", "Tank", "Mage", "Assassin", "Marksman", "Support"];
const weakTo = (c: Cls) => ORDER.filter((x) => STRONG[x].includes(c));

/** Clases de los campeones en pie en el campo de un lado (los monstruos no cuentan). */
const onField = (b: Battle, side: 0 | 1) =>
  b.on[side]
    .map((k) => (side === 0 ? b.mine : b.theirs)[k])
    .filter((f) => f && f.hp > 0 && !f.champ.tags.includes("Monster"))
    .map((f) => f.champ.cls);

export function TypeChart({ battle, onClose }: { battle: Battle; onClose: () => void }) {
  const { t } = useLocale();
  const mine = onField(battle, 0);
  const foes = onField(battle, 1);
  const ref = useRef<HTMLElement>(null);
  // En pantallas estrechas sale debajo del combate: se lleva a la vista al abrirla.
  useEffect(() => {
    if (window.matchMedia("(max-width: 1000px)").matches) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);
  const pill = (c: Cls, on: boolean) => (
    <span key={c} className={on ? "on" : ""}>
      <TypeBadge cls={c} />
    </span>
  );
  return (
    <aside ref={ref} className="g-types card">
      <div className="g-types-body">
        <div className="px-small g-types-title">
          {t("Tabla de tipos", "Type chart")}
          <button type="button" className="g-types-close" onClick={onClose} aria-label={t("Cerrar la tabla de tipos", "Close the type chart")}>
            ✕
          </button>
        </div>
        <div className="g-types-head muted">
          <span />
          <span className="eff up">{t("Fuerte ×1,3", "Strong ×1.3")}</span>
          <span className="eff down">{t("Débil ×0,77", "Weak ×0.77")}</span>
        </div>
        {ORDER.map((c) => (
          <div key={c} className={`g-types-row${mine.includes(c) ? " mine" : ""}${foes.includes(c) ? " foe" : ""}`}>
            <TypeBadge cls={c} />
            <span className="g-types-list">{STRONG[c].map((x) => pill(x, mine.includes(c) && foes.includes(x)))}</span>
            <span className="g-types-list">{weakTo(c).map((x) => pill(x, mine.includes(c) && foes.includes(x)))}</span>
          </div>
        ))}
        <p className="g-types-note muted">
          {t(
            "Fuerte: tus golpes hacen ×1,3 a esas clases. Débil: haces ×0,77 a esas clases y ellas te hacen ×1,3. Los monstruos son neutros.",
            "Strong: your hits deal ×1.3 to those classes. Weak: you deal ×0.77 to those classes and they deal ×1.3 to you. Monsters are neutral.",
          )}
        </p>
      </div>
    </aside>
  );
}
