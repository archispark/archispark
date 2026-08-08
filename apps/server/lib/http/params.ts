import { ValidationError } from "@/lib/archimate/errors"

/** Parses a route param as an integer id, throwing `ValidationError` (422) on failure. */
export function parseIntParam(value: string, message = "ID invalide."): number {
  const n = parseInt(value, 10)
  if (isNaN(n)) throw new ValidationError(message)
  return n
}
