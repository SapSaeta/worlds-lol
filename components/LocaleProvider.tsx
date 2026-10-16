"use client";

import { createContext, useContext, useMemo } from "react";
import { intlLocale, localePath, tr, type Locale } from "@/lib/i18n";

type LocaleCtx = {
  locale: Locale;
  /** Texto en el idioma de la página: t("Directo", "Live") */
  t: (es: string, en: string) => string;
  /** URL pública de una ruta interna: href("/jugar") → "/en/play" en inglés */
  href: (path: string) => string;
  /** Locale de Intl para fechas y números */
  intl: string;
};

const Ctx = createContext<LocaleCtx | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<LocaleCtx>(
    () => ({ locale, t: (es, en) => tr(locale, es, en), href: (p) => localePath(locale, p), intl: intlLocale(locale) }),
    [locale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLocale fuera de LocaleProvider");
  return c;
}
