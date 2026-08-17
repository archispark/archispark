import { describe, it, expect } from "vitest"
import { randomUUID } from "crypto"
import { NotFoundError, ValidationError } from "./errors"
import { createCustomImagePack, listAllImagePacks } from "./image-library-store"
import { installImagePackItems } from "./image-library-install"

const CLEAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`
const EVIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`

function svgFile(name: string, content = CLEAN_SVG) {
  return { name, buffer: Buffer.from(content) }
}

async function newPack() {
  return createCustomImagePack({
    name: "Plugin pack",
    slug: `plugin-pack-${randomUUID()}`,
  })
}

async function systemPackId(): Promise<string> {
  const packs = await listAllImagePacks()
  return packs.find((p) => p.is_system)!.identifier
}

describe("installImagePackItems", () => {
  it("installs several svg files as inline_svg items", async () => {
    const pack = await newPack()
    const items = await installImagePackItems(pack.identifier, undefined, [
      svgFile("actor.svg"),
      svgFile("gateway.svg"),
    ])
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.name).sort()).toEqual(["actor", "gateway"])
    expect(items[0]!.resolved_url).toMatch(
      /^\/api\/image-library\/items\/.+\/svg$/
    )
  })

  it("ignores non-svg files in the bundle", async () => {
    const pack = await newPack()
    const items = await installImagePackItems(pack.identifier, undefined, [
      svgFile("actor.svg"),
      { name: "readme.txt", buffer: Buffer.from("hi") },
    ])
    expect(items).toHaveLength(1)
  })

  it("applies manifest slug/name overrides", async () => {
    const pack = await newPack()
    const items = await installImagePackItems(
      pack.identifier,
      {
        items: [
          { file: "actor.svg", slug: "custom-actor", name: "Custom Actor" },
        ],
      },
      [svgFile("actor.svg")]
    )
    expect(items[0]!.slug).toBe("custom-actor")
    expect(items[0]!.name).toBe("Custom Actor")
  })

  it("rejects an empty bundle", async () => {
    const pack = await newPack()
    await expect(
      installImagePackItems(pack.identifier, undefined, [])
    ).rejects.toThrow(ValidationError)
  })

  it("rejects a malicious svg, naming the offending file", async () => {
    const pack = await newPack()
    await expect(
      installImagePackItems(pack.identifier, undefined, [
        svgFile("evil.svg", EVIL_SVG),
      ])
    ).rejects.toThrow(ValidationError)
  })

  it("rejects installing into a system pack", async () => {
    await expect(
      installImagePackItems(await systemPackId(), undefined, [
        svgFile("actor.svg"),
      ])
    ).rejects.toThrow(NotFoundError)
  })

  it("rejects a manifest that resolves two files to the same slug", async () => {
    const pack = await newPack()
    await expect(
      installImagePackItems(
        pack.identifier,
        {
          items: [
            { file: "a.svg", slug: "dup" },
            { file: "b.svg", slug: "dup" },
          ],
        },
        [svgFile("a.svg"), svgFile("b.svg")]
      )
    ).rejects.toThrow(ValidationError)
  })
})
