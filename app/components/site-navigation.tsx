"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type SiteSection = "library" | "practice" | "videos" | "settings";

const primaryLinks: Array<{ href: string; label: string; section: SiteSection }> = [
  { href: "/", label: "Library", section: "library" },
  { href: "/practice", label: "Practice", section: "practice" },
  { href: "/videos", label: "Videos", section: "videos" },
  { href: "/integrations", label: "Settings", section: "settings" },
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
        <Link aria-label="ListenToLearn library" className="site-brand" href="/">ListenToLearn</Link>
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
        <div className="site-account">{account}</div>
      </div>
    </header>
  );
}
