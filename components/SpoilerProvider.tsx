"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { NOSPOIL_ATTR, NOSPOIL_KEY, REVEALED_KEY, REVEALED_MAX, concealedMatches, resultHidden, type SpoilerView } from "@/lib/spoilers";
import type { Match } from "@/lib/types";

type SpoilerCtx = SpoilerView & {
  /** Ya se ha leído la preferencia del navegador */
  ready: boolean;
  toggle: () => void;
  /** Destapa un partido (se recuerda en este navegador) */
  reveal: (id: string) => void;
  /** Bloques enteros destapados en esta visita: "clasificacion", "estadisticas"… */
  opened: ReadonlySet<string>;
  open: (key: string) => void;
  /**
   * Clase para los bloques con resultados: mientras React no ha leído la
   * preferencia, el CSS los oculta si <html> lleva el atributo del modo.
   */
  guard: string;
};

const Ctx = createContext<SpoilerCtx | null>(null);

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {
    // Sin almacenamiento (modo privado): el modo dura lo que dure la página.
  }
};

export function SpoilerProvider({ children }: { children: React.ReactNode }) {
  const [on, setOn] = useState(false);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(() => new Set());
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setOn(read(NOSPOIL_KEY) !== "0");
    try {
      const ids = JSON.parse(read(REVEALED_KEY) ?? "[]");
      if (Array.isArray(ids)) setRevealed(new Set(ids.filter((x) => typeof x === "string")));
    } catch {
      // Valor corrupto: se empieza de cero.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.toggleAttribute(NOSPOIL_ATTR, on);
  }, [on, ready]);

  const toggle = useCallback(() => {
    setOn((v) => {
      write(NOSPOIL_KEY, v ? "0" : "1");
      return !v;
    });
    setOpened(new Set());
  }, []);

  const reveal = useCallback((id: string) => {
    setRevealed((prev) => {
      if (prev.has(id)) return prev;
      const next = [...prev, id].slice(-REVEALED_MAX);
      write(REVEALED_KEY, JSON.stringify(next));
      return new Set(next);
    });
  }, []);

  const open = useCallback((key: string) => setOpened((prev) => new Set(prev).add(key)), []);

  const value = useMemo<SpoilerCtx>(
    () => ({ on, ready, toggle, revealed, reveal, opened, open, guard: ready ? "" : "spoil-guard" }),
    [on, ready, toggle, revealed, reveal, opened, open],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSpoilers() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSpoilers fuera de SpoilerProvider");
  return c;
}

/** Qué partidos de una lista llevan el marcador tapado y cuáles los equipos. */
export function useMatchSpoilers(matches: Match[]) {
  const s = useSpoilers();
  const concealed = useMemo(() => concealedMatches(matches, s), [matches, s]);
  return {
    ...s,
    concealed,
    /** Marcador y ganador tapados */
    hidesResult: (m: Match) => resultHidden(m, s),
    /** Equipos tapados */
    hidesTeams: (m: Match) => concealed.has(m.id),
  };
}

/** Un bloque entero (clasificación, balances, estadísticas) tapado tras un botón. */
export function useGate(key: string) {
  const s = useSpoilers();
  return { hidden: s.on && !s.opened.has(key), show: () => s.open(key) };
}

/** Interruptor de la cabecera. */
export function SpoilerToggle() {
  const { on, toggle } = useSpoilers();
  const { t } = useLocale();
  return (
    <button
      type="button"
      className="btn sm spoiler-toggle"
      aria-pressed={on}
      onClick={toggle}
      title={
        on
          ? t("Resultados ocultos. Pulsa para volver a verlos.", "Results hidden. Click to show them again.")
          : t("Oculta marcadores, ganadores y clasificación hasta que los destapes.", "Hide scores, winners and standings until you reveal them.")
      }
    >
      <span className="spoiler-switch" aria-hidden>
        <i />
      </span>
      <span className="spoiler-label">{t("Sin spoilers", "No spoilers")}</span>
    </button>
  );
}

/** Botón para destapar un partido o un bloque. */
export function RevealButton({ onClick, label, className = "" }: { onClick: () => void; label?: string; className?: string }) {
  const { t } = useLocale();
  return (
    <button
      type="button"
      className={`reveal-btn px-small ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {label ?? t("Ver resultado", "Show result")}
    </button>
  );
}

/** Aviso con botón que tapa un bloque entero. */
export function SpoilerGate({ text, action, onShow }: { text: string; action: string; onShow: () => void }) {
  return (
    <div className="spoiler-gate inset">
      <p className="px-small">{text}</p>
      <RevealButton onClick={onShow} label={action} />
    </div>
  );
}
