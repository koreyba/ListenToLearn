"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type SiteSection = "home" | "library" | "practice" | "videos" | "settings";

const primaryLinks: Array<{ href: string; label: string; section: SiteSection }> = [
  { href: "/library", label: "Library", section: "library" },
  { href: "/practice", label: "Practice", section: "practice" },
  { href: "/videos", label: "Videos", section: "videos" },
  { href: "/settings", label: "Settings", section: "settings" },
];

export function SiteNavigation({
  active,
  account,
}: {
  active: SiteSection;
  account?: ReactNode;
}) {
  return (
    <header className="site-navigation">
      <div className="site-navigation-inner">
        <Link aria-current={active === "home" ? "page" : undefined} aria-label="Unmumble" className="site-brand" href="/">
          <span aria-hidden="true" className="site-brand-logo" />
        </Link>
        <nav aria-label="Primary navigation" className="site-primary-links">
          {primaryLinks.map((link) => (
            <Link
              aria-current={active === link.section ? "page" : undefined}
              className="site-primary-link"
              href={link.href}
              key={link.section}
            >{link.label}</Link>
          ))}
        </nav>
        <div className="site-account">
          <button
            aria-label="Change color theme"
            aria-pressed="false"
            className="theme-toggle"
            data-theme-toggle
            type="button"
          >
            <span aria-hidden="true" className="theme-toggle-sun">☀</span>
            <span aria-hidden="true" className="theme-toggle-moon">☾</span>
          </button>
          {account}
        </div>
      </div>
    </header>
  );
}
