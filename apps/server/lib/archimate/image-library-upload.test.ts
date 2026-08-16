import { describe, it, expect, beforeEach, vi } from "vitest"
import { randomUUID } from "crypto"
import { NotFoundError, ValidationError } from "./errors"
import { createCustomImagePack, listAllImagePacks } from "./image-library-store"

const put = vi.fn()
const del = vi.fn()
vi.mock("@vercel/blob", () => ({
  put: (...args: unknown[]) => put(...args),
  del: (...args: unknown[]) => del(...args),
}))

const {
  uploadImagePackItem,
  deleteImagePackItem,
  deleteCustomImagePack,
} = await import("./image-library-upload")

beforeEach(() => {
  put.mockReset()
  del.mockReset()
  put.mockResolvedValue({
    url: "https://blob.example.test/image-library/icon.png",
    pathname: "image-library/icon.png",
  })
  delete process.env["BLOB_READ_WRITE_TOKEN"]
})

const FILE = { name: "icon.png", type: "image/png", buffer: Buffer.from("x") }

async function systemPackId(): Promise<string> {
  const packs = await listAllImagePacks()
  return packs.find((p) => p.is_system)!.identifier
}

describe("uploadImagePackItem", () => {
  it("rejects when BLOB_READ_WRITE_TOKEN is not configured", async () => {
    const pack = await createCustomImagePack({
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    await expect(
      uploadImagePackItem(pack.identifier, FILE)
    ).rejects.toThrow(ValidationError)
    expect(put).not.toHaveBeenCalled()
  })

  it("rejects an unsupported mime type", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack({
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    await expect(
      uploadImagePackItem(pack.identifier, {
        ...FILE,
        type: "application/pdf",
      })
    ).rejects.toThrow(ValidationError)
    expect(put).not.toHaveBeenCalled()
  })

  it("rejects a file over the size limit", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack({
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    await expect(
      uploadImagePackItem(pack.identifier, {
        ...FILE,
        buffer: Buffer.alloc(3 * 1024 * 1024),
      })
    ).rejects.toThrow(ValidationError)
    expect(put).not.toHaveBeenCalled()
  })

  it("rejects uploading to a system pack", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    await expect(
      uploadImagePackItem(await systemPackId(), FILE)
    ).rejects.toThrow(NotFoundError)
    expect(put).not.toHaveBeenCalled()
  })

  it("uploads a valid file and inserts the item", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack({
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    const item = await uploadImagePackItem(pack.identifier, FILE)
    expect(put).toHaveBeenCalledTimes(1)
    expect(item.resolved_url).toBe(
      "https://blob.example.test/image-library/icon.png"
    )
    expect(item.name).toBe("icon.png")
  })
})

describe("deleteImagePackItem", () => {
  it("deletes the blob and the row for a custom pack item", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack({
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    const item = await uploadImagePackItem(pack.identifier, FILE)
    await deleteImagePackItem(item.identifier)
    expect(del).toHaveBeenCalledWith("image-library/icon.png", {
      token: "test-token",
    })
  })

  it("throws NotFoundError for a system pack item", async () => {
    const packs = await listAllImagePacks()
    const systemItem = packs.find((p) => p.is_system)?.items[0]
    await expect(
      deleteImagePackItem(systemItem!.identifier)
    ).rejects.toThrow(NotFoundError)
  })
})

describe("deleteCustomImagePack", () => {
  it("deletes every item's blob then the pack", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack({
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    await uploadImagePackItem(pack.identifier, FILE)
    await deleteCustomImagePack(pack.identifier)
    expect(del).toHaveBeenCalledWith(
      ["image-library/icon.png"],
      { token: "test-token" }
    )
  })

  it("does not require a token to delete an empty pack", async () => {
    const pack = await createCustomImagePack({
      name: "Empty Pack",
      slug: `empty-pack-${randomUUID()}`,
    })
    await expect(
      deleteCustomImagePack(pack.identifier)
    ).resolves.toBeUndefined()
    expect(del).not.toHaveBeenCalled()
  })

  it("rejects deleting a system pack", async () => {
    await expect(deleteCustomImagePack(await systemPackId())).rejects.toThrow(
      NotFoundError
    )
  })
})
