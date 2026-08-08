import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchModel, saveModel, importModel } from "@/lib/api"
import { queryKeys } from "./keys"

export function useModel() {
  return useQuery({ queryKey: queryKeys.model(), queryFn: fetchModel })
}

export function useSaveModel() {
  return useMutation({ mutationFn: saveModel })
}

export function useImportModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => importModel(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.model() })
      qc.invalidateQueries({ queryKey: ["elements"] })
      qc.invalidateQueries({ queryKey: ["relationships"] })
      qc.invalidateQueries({ queryKey: queryKeys.views() })
    },
  })
}
