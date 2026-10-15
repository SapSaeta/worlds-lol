"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NextMatchChip } from "@/components/NextMatchChip";
import { TOURNAMENT } from "@/config/tournament";

const LINKS = [
  { href: "/", label: "Directo" },
  { href: "/estadisticas", label: "Worlddex" },
  { href: "/jugar", label: "Jugar" },
];

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className="site-header">
      <Link href="/" className="logo" aria-label="Inicio">
        <span className="icon-btn">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" />
        </span>
        <span className="logo-text">
          WORLDS·LOL
          <small>{TOURNAMENT.name} en español</small>
        </span>
      </Link>
      <span className="header-spacer" />
      <NextMatchChip />
      <nav className="nav">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="btn" aria-current={path === l.href || (l.href !== "/" && path.startsWith(`${l.href}/`)) ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
