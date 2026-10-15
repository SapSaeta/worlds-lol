"use client";

import { useState } from "react";
import { ItemIcon, statsText } from "@/components/game/parts";
import { TeamBar } from "@/components/game/TeamBar";
import { MAX_ITEMS, combine, type Run, type Unit } from "@/lib/game/engine";
import type { GameData, GItem } from "@/lib/game/types";

const KIND_LABEL: Record<GItem["kind"], string> = { basic: "Componente", epic: "Intermedio", legendary: "Objeto", potion: "Consumible" };

/** Qué pasaría al dárselo a ese campeón: si cabe y si completa una receta. */
function preview(u: Unit, item: GItem, data: GameData) {
  if (item.kind === "potion") return u.hp <= 0 ? "No puede" : "Cura 50 %";
  const { items, made } = combine([...u.items, item.id], data);
  if (items.length > MAX_ITEMS) return "Sin hueco";
  return made.length ? `→ ${made.at(-1)!.name}` : "";
}

/** Tienda: componentes y objetos con su receta real. Los componentes se combinan solos. */
export function ShopView({ run, data, stock, msg, onBuy, onLeave }: { run: Run; data: GameData; stock: GItem[]; msg?: string; onBuy: (item: GItem, unit: Unit) => void; onLeave: () => void }) {
  const [sel, setSel] = useState<GItem | null>(null);
  const byId = (id: string) => data.items.find((i) => i.id === id);
  // Objetos a los que lleva un componente, para que se entienda para qué sirve.
  const usedIn = (id: string) => data.items.filter((i) => i.kind !== "basic" && i.from.includes(id)).length;

  return (
    <div className="g-shop">
      <div className="g-dialog card static">
        <span>{msg ?? "Bienvenido a la tienda. Si un campeón junta los componentes de una receta, se combinan solos y gratis."}</span>
      </div>
      <div className="g-shop-grid">
        {stock.map((it, i) => {
          const cant = run.gold < it.gold;
          return (
            <button
              key={`${it.id}-${i}`}
              type="button"
              className={`g-shop-item card${sel === it ? " sel" : ""}`}
              disabled={cant}
              aria-pressed={sel === it}
              onClick={() => setSel(sel === it ? null : it)}
            >
              <ItemIcon item={it} size={40} />
              <span className="g-shop-text">
                <span className="bold g-shop-name">{it.name}</span>
                <span className="px-small muted">{KIND_LABEL[it.kind]}</span>
                <span className="px-small">{it.kind === "potion" ? "Cura la mitad de la vida" : statsText(it.stats)}</span>
                {it.from.length ? (
                  <span className="g-recipe px-small muted">
                    Receta:{" "}
                    {it.from.map((f, j) => {
                      const c = byId(f);
                      return c ? <ItemIcon key={j} item={c} size={16} /> : null;
                    })}
                  </span>
                ) : it.kind === "basic" ? (
                  <span className="px-small muted">Sirve para {usedIn(it.id)} objetos</span>
                ) : null}
              </span>
              <span className={`g-price px-small${cant ? " no" : ""}`}>{it.gold}</span>
            </button>
          );
        })}
      </div>
      {sel ? (
        <div className="g-shop-pick">
          <div className="px-small g-switch-title">¿Para quién es {sel.name}?</div>
          <TeamBar
            run={run}
            data={data}
            pickLabel="Dárselo"
            onPick={(u) => {
              onBuy(sel, u);
              setSel(null);
            }}
            disabled={(u) => preview(u, sel, data) === "Sin hueco" || preview(u, sel, data) === "No puede"}
            hint={(u) => preview(u, sel, data)}
          />
        </div>
      ) : null}
      <div className="g-actions-row">
        <button type="button" className="btn" onClick={onLeave}>
          Salir de la tienda
        </button>
      </div>
    </div>
  );
}
