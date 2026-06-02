"use client";

import { useId } from "react";

/**
 * Inline SVG country flags for the locale switcher.
 *
 * Flag emoji (🇫🇷 …) don't render on Windows and several Linux setups, so we draw
 * them as SVG to guarantee they show everywhere — and offline (Docker), with no
 * external CDN.
 */
export function Flag({ code, className = "h-3.5 w-5 rounded-[2px] shrink-0" }: { code: string; className?: string }) {
  switch (code) {
    case "fr":
      return (
        <svg viewBox="0 0 3 2" className={className} aria-hidden>
          <rect width="1" height="2" x="0" fill="#0055A4" />
          <rect width="1" height="2" x="1" fill="#fff" />
          <rect width="1" height="2" x="2" fill="#EF4135" />
        </svg>
      );
    case "it":
      return (
        <svg viewBox="0 0 3 2" className={className} aria-hidden>
          <rect width="1" height="2" x="0" fill="#009246" />
          <rect width="1" height="2" x="1" fill="#fff" />
          <rect width="1" height="2" x="2" fill="#CE2B37" />
        </svg>
      );
    case "de":
      return (
        <svg viewBox="0 0 5 3" className={className} aria-hidden>
          <rect width="5" height="1" y="0" fill="#000" />
          <rect width="5" height="1" y="1" fill="#D00" />
          <rect width="5" height="1" y="2" fill="#FFCE00" />
        </svg>
      );
    case "es":
      return (
        <svg viewBox="0 0 6 4" className={className} aria-hidden>
          <rect width="6" height="4" fill="#AA151B" />
          <rect width="6" height="2" y="1" fill="#F1BF00" />
        </svg>
      );
    case "gb":
      return <UnionJack className={className} />;
    default:
      return null;
  }
}

function UnionJack({ className }: { className?: string }) {
  const clip = useId();
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden>
      <clipPath id={clip}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${clip})`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}
