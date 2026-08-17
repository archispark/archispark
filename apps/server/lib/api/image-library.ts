import { BASE, get, post, del } from "./client"

/** Mirrors @workspace/db's ARCHISPARK_IMAGE_PROPERTY_ID — duplicated here so
 *  client components can identify the property without importing
 *  @workspace/db (which pulls in the Postgres driver). */
export const ARCHISPARK_IMAGE_PROPERTY_ID = "archispark-image"

export interface ImagePackItemOut {
  identifier: string
  slug: string
  name: string
  archimate_type: string | null
  resolved_url: string
}

export interface ImagePackOut {
  identifier: string
  slug: string
  name: string
  description: string | null
  is_system: boolean
  items: ImagePackItemOut[]
}

export interface ImagePackCreateIn {
  name: string
  slug: string
}

export const fetchImagePacks = () => get<ImagePackOut[]>("/image-library/packs")

export const createImagePack = (body: ImagePackCreateIn) =>
  post<ImagePackOut>("/image-library/packs", body)

export const deleteImagePack = (packId: string) =>
  del(`/image-library/packs/${encodeURIComponent(packId)}`)

export const deleteImagePackItem = (itemUuid: string) =>
  del(`/image-library/items/${encodeURIComponent(itemUuid)}`)

export async function uploadImagePackItems(
  packId: string,
  files: File[]
): Promise<ImagePackItemOut[]> {
  const form = new FormData()
  for (const file of files) form.append("files", file)
  const res = await fetch(
    `${BASE}/image-library/packs/${encodeURIComponent(packId)}/items`,
    { method: "POST", credentials: "include", body: form }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `API error: ${res.status}`)
  }
  return res.json()
}

export interface ImagePackManifestItemIn {
  file: string
  slug?: string
  name?: string
}

export interface ImagePackManifestIn {
  name?: string
  description?: string
  items?: ImagePackManifestItemIn[]
}

/** Bulk-installs a plugin pack's svg files into an existing custom pack. */
export async function installImagePackItems(
  packId: string,
  files: File[],
  manifest?: ImagePackManifestIn
): Promise<ImagePackItemOut[]> {
  const form = new FormData()
  for (const file of files) form.append("files", file)
  if (manifest) form.append("manifest", JSON.stringify(manifest))
  const res = await fetch(
    `${BASE}/image-library/packs/${encodeURIComponent(packId)}/install`,
    { method: "POST", credentials: "include", body: form }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `API error: ${res.status}`)
  }
  return res.json()
}
