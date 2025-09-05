"use client";
import { useState } from "react";
import Link from "next/link";
import GlitchText from "@/components/ui/GlitchText";
import { AlignJustify, X } from "lucide-react";

type LinkItem = { label: string; href: string; ariaLabel?: string };

export default function AppHeader({
  title,
  menuLinks,
  rightChildren,
}: {
  title: string;
  menuLinks: LinkItem[];
  rightChildren?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="mb-4 sticky top-0 z-40 bg-deep-charcoal/80 backdrop-blur border-b border-accent/20 py-2">
      <div className="flex items-center justify-between gap-3">
        <GlitchText text={title} className="text-xl sm:text-2xl" />

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2">
          {menuLinks.map((l) => (
            <Link key={l.href} href={l.href} className="btn" aria-label={l.ariaLabel || l.label}>
              {l.label}
            </Link>
          ))}
          {rightChildren}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden btn inline-flex items-center gap-2"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={16} /> : <AlignJustify size={16} />} Menu
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden mt-3 border border-accent/50 rounded bg-deep-charcoal/80 backdrop-blur p-3 space-y-2">
          <nav className="grid gap-2">
            {menuLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="btn text-left"
                aria-label={l.ariaLabel || l.label}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          {rightChildren && <div className="pt-2 border-t border-accent/30">{rightChildren}</div>}
        </div>
      )}
    </header>
  );
}
