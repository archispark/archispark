/**
 * Retry helpers for Neo4j failures worth retrying rather than failing the
 * whole batch — shared by `import-all-workspaces.ts` (the reusable function
 * and the CLI script that wraps it).
 */

export const MAX_IMPORT_ATTEMPTS = 3

export function isRetriableNeo4jFailure(error: unknown): boolean {
  if (error && typeof error === "object") {
    const candidate = error as { retriable?: unknown; retryable?: unknown }
    if (candidate.retriable === true || candidate.retryable === true)
      return true
  }
  return /ECONNRESET|SessionExpired|Failed to connect/i.test(
    error instanceof Error ? error.message : String(error)
  )
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
