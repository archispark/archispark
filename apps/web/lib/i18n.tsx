"use client";

import fr from "@/messages/fr.json";
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import de from "@/messages/de.json";
import it from "@/messages/it.json";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Locale = "fr" | "en" | "es" | "de" | "it";

const MESSAGES: Record<Locale, typeof fr> = { fr, en, es, de, it };
type Messages = typeof fr;

type I18nCtx = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: keyof Messages, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nCtx>({
  locale: "fr",
  setLocale: () => {},
  t: (key) => String(key),
});

const VALID_LOCALES: Locale[] = ["fr", "en", "es", "de", "it"];

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && VALID_LOCALES.includes(saved)) setLocaleState(saved);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  }, []);

  const t = useCallback(
    (key: keyof Messages, params?: Record<string, string | number>): string => {
      let str: string =
        (MESSAGES[locale] as Messages)[key] ??
        (MESSAGES.fr as Messages)[key] ??
        String(key);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return str;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
