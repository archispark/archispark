"use client";

import { useEffect } from "react";

export function useKeyboardShortcut(
  key: string,
  handler: (e: KeyboardEvent) => void,
  options: { meta?: boolean; ctrl?: boolean; shift?: boolean; enabled?: boolean } = {},
) {
  const { meta = false, ctrl = false, shift = false, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (meta && !e.metaKey) return;
      if (ctrl && !e.ctrlKey) return;
      if (shift && !e.shiftKey) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (!meta && !ctrl && inInput) return;
      handler(e);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler, meta, ctrl, shift, enabled]);
}
