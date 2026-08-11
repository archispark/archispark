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

export const fetchImagePacks = () =>
  get<ImagePackOut[]>("/image-library/packs")

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
