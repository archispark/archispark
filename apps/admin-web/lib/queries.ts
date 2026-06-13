import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchUsers,
  createUser,
  updateUserApi,
  deleteUserApi,
  fetchAdminOrganizations,
  setOrganizationEnabledApi,
  fetchNeonStatus,
  createAdminOrganization,
  verifyOrganizationDb,
  reprovisionOrganization,
  type UserCreateIn,
  type UserUpdateIn,
  type AdminOrganizationCreateIn,
} from "./api";

export const queryKeys = {
  users: () => ["users"] as const,
  adminOrganizations: () => ["admin-organizations"] as const,
  neonStatus: () => ["neon-status"] as const,
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

export function useAdminOrganizations() {
  return useQuery({ queryKey: queryKeys.adminOrganizations(), queryFn: fetchAdminOrganizations });
}

export function useSetOrganizationEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => setOrganizationEnabledApi(id, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminOrganizations() }),
  });
}

export function useNeonStatus() {
  return useQuery({ queryKey: queryKeys.neonStatus(), queryFn: fetchNeonStatus, staleTime: 30_000 });
}

export function useCreateAdminOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AdminOrganizationCreateIn) => createAdminOrganization(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminOrganizations() }),
  });
}

export function useVerifyOrganizationDb() {
  return useMutation({
    mutationFn: (id: string) => verifyOrganizationDb(id),
  });
}

export function useReprovisionOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reprovisionOrganization(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.adminOrganizations() }),
  });
}
