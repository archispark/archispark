"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT, type Locale } from "@/lib/i18n";
import { Flag } from "@/components/flags";

const LOCALES: { value: Locale; label: string; cc: string }[] = [
  { value: "fr", label: "Français", cc: "fr" },
  { value: "en", label: "English", cc: "gb" },
  { value: "es", label: "Español", cc: "es" },
  { value: "de", label: "Deutsch", cc: "de" },
  { value: "it", label: "Italiano", cc: "it" },
];

export function LocaleSwitcher() {
  const { locale, setLocale } = useT();
  const [open, setOpen] = useState(false);
  const current = LOCALES.find((language) => language.value === locale) ?? LOCALES[0]!;

  return (
    <div className="relative w-40">
      <button
        type="button"
        aria-expanded={open}
        className="flex h-8 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <Flag code={current.cc} />
        <span className="flex-1 text-left">{current.label}</span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border border-border bg-popover py-1 shadow-lg">
          {LOCALES.map((language) => (
            <button
              key={language.value}
              type="button"
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                language.value === locale ? "font-semibold text-primary" : "text-foreground"
              }`}
              onClick={() => {
                setLocale(language.value);
                setOpen(false);
              }}
            >
              <Flag code={language.cc} />
              {language.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
