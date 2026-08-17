import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  fetchImagePacks,
  createImagePack,
  deleteImagePack,
  uploadImagePackItems,
  installImagePackItems,
  deleteImagePackItem,
  type ImagePackCreateIn,
  type ImagePackManifestIn,
} from "@/lib/api"
import { queryKeys } from "./keys"

export function useImagePacks() {
  return useQuery({
    queryKey: queryKeys.imagePacks(),
    queryFn: fetchImagePacks,
  })
}

export function useCreateImagePack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ImagePackCreateIn) => createImagePack(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.imagePacks() }),
  })
}

export function useDeleteImagePack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (packId: string) => deleteImagePack(packId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.imagePacks() }),
  })
}

export function useUploadImagePackItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ packId, files }: { packId: string; files: File[] }) =>
      uploadImagePackItems(packId, files),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.imagePacks() }),
  })
}

export function useInstallImagePackItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      packId,
      files,
      manifest,
    }: {
      packId: string
      files: File[]
      manifest?: ImagePackManifestIn
    }) => installImagePackItems(packId, files, manifest),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.imagePacks() }),
  })
}

export function useDeleteImagePackItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itemUuid: string) => deleteImagePackItem(itemUuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.imagePacks() }),
  })
}
