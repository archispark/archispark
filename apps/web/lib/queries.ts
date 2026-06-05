import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchModel,
  fetchElements,
  fetchElement,
  fetchElementTypes,
  fetchElementRelationships,
  fetchElementViews,
  fetchElementsInViews,
  fetchRelationships,
  fetchRelationshipTypes,
  fetchViews,
  fetchView,
  fetchViewpoints,
  fetchPropertyDefinitions,
  fetchWorkspaces,
  fetchUsers,
  fetchRoles,
  fetchRoleCatalog,
  createUser,
  updateUserApi,
  deleteUserApi,
  createElement,
  updateElement,
  deleteElement,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  createView,
  updateView,
  deleteView,
  createPropertyDefinition,
  updatePropertyDefinition,
  deletePropertyDefinition,
  createWorkspaceApi,
  updateWorkspaceApi,
  deleteWorkspaceApi,
  activateWorkspaceApi,
  createRole,
  updateRole,
  deleteRole,
  saveModel,
  importModel,
  type ElementCreateIn,
  type ElementUpdateIn,
  type RelationshipCreateIn,
  type RelationshipUpdateIn,
  type ViewCreateIn,
  type ViewUpdateIn,
  type PropertyDefinitionCreateIn,
  type PropertyDefinitionUpdateIn,
  type WorkspaceCreateIn,
  type WorkspaceUpdateIn,
  type RoleCreateIn,
  type RoleUpdateIn,
  type UserCreateIn,
  type UserUpdateIn,
} from "./api";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const queryKeys = {
  model: () => ["model"] as const,
  elements: (type?: string | null, name?: string | null) => ["elements", type, name] as const,
  element: (id: string) => ["element", id] as const,
  elementRelationships: (id: string) => ["elementRelationships", id] as const,
  elementViews: (id: string) => ["elementViews", id] as const,
  elementsInViews: () => ["elementsInViews"] as const,
  elementTypes: () => ["elementTypes"] as const,
  relationships: (type?: string | null, name?: string | null) => ["relationships", type, name] as const,
  relationshipTypes: () => ["relationshipTypes"] as const,
  views: () => ["views"] as const,
  view: (id: string) => ["view", id] as const,
  viewpoints: () => ["viewpoints"] as const,
  propertyDefinitions: () => ["propertyDefinitions"] as const,
  workspaces: () => ["workspaces"] as const,
  users: () => ["users"] as const,
  roles: () => ["roles"] as const,
  roleCatalog: () => ["roleCatalog"] as const,
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useModel() {
  return useQuery({ queryKey: queryKeys.model(), queryFn: fetchModel });
}

export function useElements(type?: string | null, name?: string | null) {
  return useQuery({
    queryKey: queryKeys.elements(type, name),
    queryFn: () => fetchElements(type, name),
  });
}

export function useElement(id: string) {
  return useQuery({ queryKey: queryKeys.element(id), queryFn: () => fetchElement(id), enabled: !!id });
}

export function useElementRelationships(id: string) {
  return useQuery({ queryKey: queryKeys.elementRelationships(id), queryFn: () => fetchElementRelationships(id), enabled: !!id });
}

export function useElementViews(id: string) {
  return useQuery({ queryKey: queryKeys.elementViews(id), queryFn: () => fetchElementViews(id), enabled: !!id });
}

export function useElementsInViews() {
  return useQuery({ queryKey: queryKeys.elementsInViews(), queryFn: fetchElementsInViews });
}

export function useElementTypes() {
  return useQuery({ queryKey: queryKeys.elementTypes(), queryFn: fetchElementTypes, staleTime: Infinity });
}

export function useRelationships(type?: string | null, name?: string | null) {
  return useQuery({
    queryKey: queryKeys.relationships(type, name),
    queryFn: () => fetchRelationships(type, name),
  });
}

export function useRelationshipTypes() {
  return useQuery({ queryKey: queryKeys.relationshipTypes(), queryFn: fetchRelationshipTypes, staleTime: Infinity });
}

export function useViews() {
  return useQuery({ queryKey: queryKeys.views(), queryFn: fetchViews });
}

export function useView(id: string) {
  return useQuery({ queryKey: queryKeys.view(id), queryFn: () => fetchView(id), enabled: !!id });
}

export function useViewpoints() {
  return useQuery({ queryKey: queryKeys.viewpoints(), queryFn: fetchViewpoints, staleTime: Infinity });
}

export function usePropertyDefinitions() {
  return useQuery({ queryKey: queryKeys.propertyDefinitions(), queryFn: fetchPropertyDefinitions });
}

export function useWorkspaces() {
  return useQuery({ queryKey: queryKeys.workspaces(), queryFn: fetchWorkspaces });
}

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users(), queryFn: fetchUsers });
}

export function useRoles() {
  return useQuery({ queryKey: queryKeys.roles(), queryFn: fetchRoles });
}

export function useRoleCatalog() {
  return useQuery({ queryKey: queryKeys.roleCatalog(), queryFn: fetchRoleCatalog, staleTime: Infinity });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateElement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ElementCreateIn) => createElement(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elements"] });
      qc.invalidateQueries({ queryKey: queryKeys.model() });
    },
  });
}

export function useUpdateElement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ElementUpdateIn }) => updateElement(id, body),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["elements"] });
      qc.invalidateQueries({ queryKey: queryKeys.element(id) });
    },
  });
}

export function useDeleteElement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteElement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elements"] });
      qc.invalidateQueries({ queryKey: queryKeys.model() });
    },
  });
}

export function useCreateRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RelationshipCreateIn) => createRelationship(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relationships"] });
      qc.invalidateQueries({ queryKey: ["elementRelationships"] });
    },
  });
}

export function useUpdateRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RelationshipUpdateIn }) => updateRelationship(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relationships"] });
      qc.invalidateQueries({ queryKey: ["elementRelationships"] });
    },
  });
}

export function useDeleteRelationship() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRelationship(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relationships"] });
      qc.invalidateQueries({ queryKey: ["elementRelationships"] });
      qc.invalidateQueries({ queryKey: queryKeys.model() });
    },
  });
}

export function useCreateView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ViewCreateIn) => createView(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.views() }),
  });
}

export function useUpdateView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ViewUpdateIn }) => updateView(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.views() }),
  });
}

export function useDeleteView() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteView(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.views() });
      qc.invalidateQueries({ queryKey: queryKeys.model() });
    },
  });
}

export function useCreatePropertyDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PropertyDefinitionCreateIn) => createPropertyDefinition(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.propertyDefinitions() }),
  });
}

export function useUpdatePropertyDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PropertyDefinitionUpdateIn }) => updatePropertyDefinition(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.propertyDefinitions() }),
  });
}

export function useDeletePropertyDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePropertyDefinition(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.propertyDefinitions() }),
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: WorkspaceCreateIn) => createWorkspaceApi(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaces() }),
  });
}

export function useUpdateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: WorkspaceUpdateIn }) => updateWorkspaceApi(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaces() }),
  });
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteWorkspaceApi(id),
    onSuccess: () => {
      // A workspace switch may have happened server-side: flush everything so
      // the sidebar, breadcrumb, and dashboard all reflect the new active workspace.
      qc.invalidateQueries({ queryKey: queryKeys.workspaces() });
      qc.invalidateQueries({ queryKey: queryKeys.model() });
      qc.invalidateQueries({ queryKey: ["elements"] });
      qc.invalidateQueries({ queryKey: ["relationships"] });
      qc.invalidateQueries({ queryKey: ["views"] });
    },
  });
}

export function useActivateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activateWorkspaceApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces() });
      qc.invalidateQueries({ queryKey: queryKeys.model() });
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RoleCreateIn) => createRole(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles() }),
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RoleUpdateIn }) => updateRole(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles() }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.roles() }),
  });
}

export function useSaveModel() {
  return useMutation({ mutationFn: saveModel });
}

export function useImportModel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => importModel(file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.model() });
      qc.invalidateQueries({ queryKey: ["elements"] });
      qc.invalidateQueries({ queryKey: ["relationships"] });
      qc.invalidateQueries({ queryKey: queryKeys.views() });
    },
  });
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
