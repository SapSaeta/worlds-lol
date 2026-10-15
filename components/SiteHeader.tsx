"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="" className="logo-mark" />
        <span className="logo-text">
          WORLDS·LOL
          <small>{TOURNAMENT.name} en español</small>
        </span>
      </Link>
      <nav className="nav">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="cursor" aria-current={path === l.href ? "page" : undefined}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
