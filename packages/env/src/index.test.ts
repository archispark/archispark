import { existsSync, mkdtempSync, writeFileSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { afterEach, describe, expect, it } from "vitest"
import { applyEnvFile, loadEnv, repoRoot } from "./index.js"

describe("applyEnvFile", () => {
  let dir: string | undefined
  const keys: string[] = []

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = undefined
    for (const key of keys.splice(0)) delete process.env[key]
  })

  function envFile(contents: string): string {
    dir = mkdtempSync(join(tmpdir(), "workspace-env-test-"))
    const path = join(dir, ".env")
    writeFileSync(path, contents)
    return path
  }

  it("sets a variable that isn't already in process.env", () => {
    keys.push("ARCHISPARK_TEST_URL")
    applyEnvFile(envFile("ARCHISPARK_TEST_URL=example.com\n"))
    expect(process.env["ARCHISPARK_TEST_URL"]).toBe("example.com")
  })

  it("never overrides a variable already set in process.env", () => {
    keys.push("ARCHISPARK_TEST_URL")
    process.env["ARCHISPARK_TEST_URL"] = "toto.com"
    applyEnvFile(envFile("ARCHISPARK_TEST_URL=example.com\n"))
    expect(process.env["ARCHISPARK_TEST_URL"]).toBe("toto.com")
  })

  it("is a no-op when the file doesn't exist", () => {
    expect(() => applyEnvFile("/nonexistent/.env")).not.toThrow()
  })

  it("skips comments and blank lines, strips quotes", () => {
    keys.push("ARCHISPARK_TEST_A", "ARCHISPARK_TEST_B")
    applyEnvFile(
      envFile('# comment\n\nARCHISPARK_TEST_A="quoted"\nARCHISPARK_TEST_B=bare\n')
    )
    expect(process.env["ARCHISPARK_TEST_A"]).toBe("quoted")
    expect(process.env["ARCHISPARK_TEST_B"]).toBe("bare")
  })

  it("interpolates ${VAR} against vars loaded earlier in the same file", () => {
    keys.push("ARCHISPARK_TEST_PASSWORD", "ARCHISPARK_TEST_DATABASE_URL")
    applyEnvFile(
      envFile(
        "ARCHISPARK_TEST_PASSWORD=secret\nARCHISPARK_TEST_DATABASE_URL=postgresql://u:${ARCHISPARK_TEST_PASSWORD}@localhost/db\n"
      )
    )
    expect(process.env["ARCHISPARK_TEST_DATABASE_URL"]).toBe(
      "postgresql://u:secret@localhost/db"
    )
  })
})

describe("repoRoot", () => {
  it("resolves to the actual repo root", () => {
    expect(existsSync(join(repoRoot(), "pnpm-workspace.yaml"))).toBe(true)
  })
})

describe("loadEnv", () => {
  it("doesn't throw and never overrides an existing variable", () => {
    process.env["ARCHISPARK_TEST_LOADENV_MARKER"] = "already-set"
    expect(() => loadEnv()).not.toThrow()
    expect(process.env["ARCHISPARK_TEST_LOADENV_MARKER"]).toBe("already-set")
    delete process.env["ARCHISPARK_TEST_LOADENV_MARKER"]
  })
})
