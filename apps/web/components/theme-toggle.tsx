"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Clock, Moon, Sun } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { useT } from "@/lib/i18n";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useT();
  const [themePref, setThemePref] = useState<"light" | "dark" | "auto">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("theme-pref") as "light" | "dark" | "auto") ?? "dark";
    setThemePref(saved);
  }, []);

  useEffect(() => {
    if (themePref !== "auto") return;
    const apply = () => {
      const h = new Date().getHours();
      setTheme(h >= 7 && h < 20 ? "light" : "dark");
    };
    apply();
    const id = setInterval(apply, 60_000);
    return () => clearInterval(id);
  }, [themePref, setTheme]);

  function cycleTheme() {
    const next = themePref === "light" ? "dark" : themePref === "dark" ? "auto" : "light";
    localStorage.setItem("theme-pref", next);
    setThemePref(next);
    if (next !== "auto") setTheme(next);
  }

  const label =
    themePref === "light"
      ? t("nav.theme_light")
      : themePref === "dark"
        ? t("nav.theme_dark")
        : t("nav.theme_auto");

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={cycleTheme}
      aria-label={label}
      title={label}
    >
      {themePref === "auto" ? (
        <Clock className="size-4" />
      ) : resolvedTheme === "dark" ? (
        <Sun className="size-4" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}
