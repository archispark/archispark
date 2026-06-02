"use client";

import { useT, type Locale } from "@/lib/i18n";
import { Flag } from "@/components/flags";

// `cc` is the ISO country code for the flag (en → gb).
const LOCALES: { value: Locale; label: string; cc: string }[] = [
  { value: "fr", label: "Français", cc: "fr" },
  { value: "en", label: "English",  cc: "gb" },
  { value: "es", label: "Español",  cc: "es" },
  { value: "de", label: "Deutsch",  cc: "de" },
  { value: "it", label: "Italiano", cc: "it" },
];

export function LocaleSwitcher() {
  const { locale, setLocale } = useT();
  const current = LOCALES.find((l) => l.value === locale) ?? LOCALES[0];

  return (
    <div className="relative group">
      <button
        className="flex items-center gap-1 px-2 h-8 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title={current.label}
      >
        <Flag code={current.cc} />
        <span className="uppercase tracking-wide">{current.value}</span>
      </button>
      <div className="absolute right-0 top-full mt-1 z-50 hidden group-hover:block bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[130px]">
        {LOCALES.map((l) => (
          <button
            key={l.value}
            onClick={() => setLocale(l.value)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] hover:bg-muted transition-colors text-left ${
              l.value === locale ? "text-primary font-semibold" : "text-foreground"
            }`}
          >
            <Flag code={l.cc} />
            <span>{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
