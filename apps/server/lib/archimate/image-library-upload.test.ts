import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest"
import { randomUUID } from "crypto"
import { getOrCreatePersonalOrganization } from "@workspace/db"
import { NotFoundError, ValidationError } from "./errors"
import { createCustomImagePack } from "./image-library-store"

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

let orgId: number
let otherOrgId: number

beforeAll(async () => {
  orgId = await getOrCreatePersonalOrganization(
    `image-lib-upload-owner-${randomUUID()}`
  )
  otherOrgId = await getOrCreatePersonalOrganization(
    `image-lib-upload-other-${randomUUID()}`
  )
})

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

describe("uploadImagePackItem", () => {
  it("rejects when BLOB_READ_WRITE_TOKEN is not configured", async () => {
    const pack = await createCustomImagePack(orgId, {
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    await expect(
      uploadImagePackItem(orgId, pack.identifier, FILE)
    ).rejects.toThrow(ValidationError)
    expect(put).not.toHaveBeenCalled()
  })

  it("rejects an unsupported mime type", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack(orgId, {
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    await expect(
      uploadImagePackItem(orgId, pack.identifier, {
        ...FILE,
        type: "application/pdf",
      })
    ).rejects.toThrow(ValidationError)
    expect(put).not.toHaveBeenCalled()
  })

  it("rejects a file over the size limit", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack(orgId, {
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    await expect(
      uploadImagePackItem(orgId, pack.identifier, {
        ...FILE,
        buffer: Buffer.alloc(3 * 1024 * 1024),
      })
    ).rejects.toThrow(ValidationError)
    expect(put).not.toHaveBeenCalled()
  })

  it("rejects uploading to a pack owned by another organization", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack(otherOrgId, {
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    await expect(
      uploadImagePackItem(orgId, pack.identifier, FILE)
    ).rejects.toThrow(NotFoundError)
    expect(put).not.toHaveBeenCalled()
  })

  it("uploads a valid file and inserts the item", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack(orgId, {
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    const item = await uploadImagePackItem(orgId, pack.identifier, FILE)
    expect(put).toHaveBeenCalledTimes(1)
    expect(item.resolved_url).toBe(
      "https://blob.example.test/image-library/icon.png"
    )
    expect(item.name).toBe("icon.png")
  })
})

describe("deleteImagePackItem", () => {
  it("deletes the blob and the row when owned by the organization", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack(orgId, {
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    const item = await uploadImagePackItem(orgId, pack.identifier, FILE)
    await deleteImagePackItem(orgId, item.identifier)
    expect(del).toHaveBeenCalledWith("image-library/icon.png", {
      token: "test-token",
    })
  })

  it("throws NotFoundError for an item owned by another organization", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack(otherOrgId, {
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    const item = await uploadImagePackItem(otherOrgId, pack.identifier, FILE)
    await expect(deleteImagePackItem(orgId, item.identifier)).rejects.toThrow(
      NotFoundError
    )
  })
})

describe("deleteCustomImagePack", () => {
  it("deletes every item's blob then the pack", async () => {
    process.env["BLOB_READ_WRITE_TOKEN"] = "test-token"
    const pack = await createCustomImagePack(orgId, {
      name: "Pack",
      slug: `pack-${randomUUID()}`,
    })
    await uploadImagePackItem(orgId, pack.identifier, FILE)
    await deleteCustomImagePack(orgId, pack.identifier)
    expect(del).toHaveBeenCalledWith(
      ["image-library/icon.png"],
      { token: "test-token" }
    )
  })

  it("does not require a token to delete an empty pack", async () => {
    const pack = await createCustomImagePack(orgId, {
      name: "Empty Pack",
      slug: `empty-pack-${randomUUID()}`,
    })
    await expect(
      deleteCustomImagePack(orgId, pack.identifier)
    ).resolves.toBeUndefined()
    expect(del).not.toHaveBeenCalled()
  })
})
