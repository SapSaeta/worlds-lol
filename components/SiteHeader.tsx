"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { NextMatchChip } from "@/components/NextMatchChip";
import { SpoilerToggle } from "@/components/SpoilerProvider";
import { TOURNAMENT } from "@/config/tournament";
import { LOCALE_COOKIE, switchPath, type Locale } from "@/lib/i18n";

/** Selector de idioma: guarda la elección en una cookie y abre la misma página en el otro idioma. */
function LangSwitch() {
  const { locale, t } = useLocale();
  const go = (to: Locale) => {
    if (to === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${to}; path=/; max-age=31536000; samesite=lax`;
    window.location.assign(switchPath(location.pathname, to) + location.search + location.hash);
  };
  return (
    <div className="lang-switch" role="group" aria-label={t("Idioma", "Language")}>
      {(["es", "en"] as const).map((l) => (
        <button key={l} type="button" className="btn sm" aria-pressed={l === locale} lang={l} title={l === "es" ? "Español" : "English"} onClick={() => go(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const { t, href } = useLocale();
  const links = [
    { href: href("/"), label: t("Directo", "Live") },
    { href: href("/estadisticas"), label: "Worlddex" },
    { href: href("/jugar"), label: t("Jugar", "Play") },
  ];
  const home = href("/");
  return (
    <header className="site-header">
      <Link href={home} className="logo" aria-label={t("Inicio", "Home")}>
        <span className="icon-btn">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" />
        </span>
        <span className="logo-text">
          WORLDS·LOL
          <small>{t(`${TOURNAMENT.name} en español`, `${TOURNAMENT.name} live`)}</small>
        </span>
      </Link>
      <span className="header-spacer" />
      <NextMatchChip />
      <nav className="nav">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="btn" aria-current={path === l.href || (l.href !== home && path.startsWith(`${l.href}/`)) ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
      <SpoilerToggle />
      <LangSwitch />
    </header>
  );
}
