import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchUsers,
  createUser,
  updateUserApi,
  deleteUserApi,
  type UserCreateIn,
  type UserUpdateIn,
} from "./api";

export const queryKeys = {
  users: () => ["users"] as const,
};

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users(), queryFn: fetchUsers });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UserCreateIn) => createUser(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users() }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UserUpdateIn }) => updateUserApi(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users() }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteUserApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.users() }),
  });
}
