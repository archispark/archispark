"use client";

import { useT, type Locale } from "@/lib/i18n";

const LOCALES: { value: Locale; label: string; flag: string }[] = [
  { value: "fr", label: "Français", flag: "🇫🇷" },
  { value: "en", label: "English",  flag: "🇬🇧" },
  { value: "es", label: "Español",  flag: "🇪🇸" },
  { value: "de", label: "Deutsch",  flag: "🇩🇪" },
  { value: "it", label: "Italiano", flag: "🇮🇹" },
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
        <span>{current.flag}</span>
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
            <span>{l.flag}</span>
            <span>{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
