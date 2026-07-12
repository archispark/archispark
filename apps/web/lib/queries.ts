import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  fetchModel,
  fetchElements,
  fetchElement,
  fetchElementTypes,
  fetchElementRelationships,
  fetchElementViews,
  fetchElementsInViews,
  fetchRelationship,
  fetchRelationshipViews,
  fetchRelationships,
  fetchRelationshipTypes,
  fetchViews,
  fetchView,
  fetchViewpoints,
  fetchPropertyDefinitions,
  fetchWorkspaces,
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
  saveModel,
  importModel,
  fetchOrganizations,
  createOrganizationApi,
  renameOrganizationApi,
  deleteOrganizationApi,
  activateOrganizationApi,
  fetchOrganizationMembers,
  addOrganizationMemberApi,
  updateOrganizationMemberRoleApi,
  removeOrganizationMemberApi,
  fetchPlatformOrganizations,
  setPlatformOrganizationEnabled,
  deletePlatformOrganizationApi,
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
  type OrgRole,
} from "./api"

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const queryKeys = {
  model: () => ["model"] as const,
  elements: (type?: string | null, name?: string | null) =>
    ["elements", type, name] as const,
  element: (id: string) => ["element", id] as const,
  elementRelationships: (id: string) => ["elementRelationships", id] as const,
  elementViews: (id: string) => ["elementViews", id] as const,
  elementsInViews: () => ["elementsInViews"] as const,
  elementTypes: () => ["elementTypes"] as const,
  relationship: (id: string) => ["relationship", id] as const,
  relationshipViews: (id: string) => ["relationshipViews", id] as const,
  relationships: (type?: string | null, name?: string | null) =>
    ["relationships", type, name] as const,
  relationshipTypes: () => ["relationshipTypes"] as const,
  views: () => ["views"] as const,
  view: (id: string) => ["view", id] as const,
  viewpoints: () => ["viewpoints"] as const,
  propertyDefinitions: () => ["propertyDefinitions"] as const,
  workspaces: () => ["workspaces"] as const,
  organizations: () => ["organizations"] as const,
  organizationMembers: (orgId: string) =>
    ["organizationMembers", orgId] as const,
  platformOrganizations: () => ["platformOrganizations"] as const,
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useModel() {
  return useQuery({ queryKey: queryKeys.model(), queryFn: fetchModel })
}

export function useElements(type?: string | null, name?: string | null) {
  return useQuery({
    queryKey: queryKeys.elements(type, name),
    queryFn: () => fetchElements(type, name),
  })
}

export function useElement(id: string) {
  return useQuery({
    queryKey: queryKeys.element(id),
    queryFn: () => fetchElement(id),
    enabled: !!id,
  })
}

export function useElementRelationships(id: string) {
  return useQuery({
    queryKey: queryKeys.elementRelationships(id),
    queryFn: () => fetchElementRelationships(id),
    enabled: !!id,
  })
}

export function useElementViews(id: string) {
  return useQuery({
    queryKey: queryKeys.elementViews(id),
    queryFn: () => fetchElementViews(id),
    enabled: !!id,
  })
}

export function useElementsInViews() {
  return useQuery({
    queryKey: queryKeys.elementsInViews(),
    queryFn: fetchElementsInViews,
  })
}

export function useElementTypes() {
  return useQuery({
    queryKey: queryKeys.elementTypes(),
    queryFn: fetchElementTypes,
    staleTime: Infinity,
  })
}

export function useRelationship(id: string) {
  return useQuery({
    queryKey: queryKeys.relationship(id),
    queryFn: () => fetchRelationship(id),
    enabled: !!id,
  })
}

export function useRelationshipViews(id: string) {
  return useQuery({
    queryKey: queryKeys.relationshipViews(id),
    queryFn: () => fetchRelationshipViews(id),
    enabled: !!id,
  })
}

export function useRelationships(type?: string | null, name?: string | null) {
  return useQuery({
    queryKey: queryKeys.relationships(type, name),
    queryFn: () => fetchRelationships(type, name),
  })
}

export function useRelationshipTypes() {
  return useQuery({
    queryKey: queryKeys.relationshipTypes(),
    queryFn: fetchRelationshipTypes,
    staleTime: Infinity,
  })
}

export function useViews() {
  return useQuery({ queryKey: queryKeys.views(), queryFn: fetchViews })
}

export function useView(id: string) {
  return useQuery({
    queryKey: queryKeys.view(id),
    queryFn: () => fetchView(id),
    enabled: !!id,
  })
}

export function useViewpoints() {
  return useQuery({
    queryKey: queryKeys.viewpoints(),
    queryFn: fetchViewpoints,
    staleTime: Infinity,
  })
}

export function usePropertyDefinitions() {
  return useQuery({
    queryKey: queryKeys.propertyDefinitions(),
    queryFn: fetchPropertyDefinitions,
  })
}

export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces(),
    queryFn: fetchWorkspaces,
  })
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateElement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ElementCreateIn) => createElement(body),
    onSuccess: (el) => {
      qc.invalidateQueries({ queryKey: ["elements"] })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
      toast.success(`Élément « ${el.name} » créé`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useUpdateElement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ElementUpdateIn }) =>
      updateElement(id, body),
    onSuccess: (el, { id }) => {
      qc.invalidateQueries({ queryKey: ["elements"] })
      qc.invalidateQueries({ queryKey: queryKeys.element(id) })
      toast.success(`Élément « ${el.name} » mis à jour`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useDeleteElement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteElement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["elements"] })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
      toast.success("Élément supprimé")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useCreateRelationship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RelationshipCreateIn) => createRelationship(body),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["relationships"] })
      qc.invalidateQueries({ queryKey: ["elementRelationships"] })
      toast.success(`Relation ${r.type} créée`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useUpdateRelationship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RelationshipUpdateIn }) =>
      updateRelationship(id, body),
    onSuccess: (r, { id }) => {
      qc.invalidateQueries({ queryKey: ["relationships"] })
      qc.invalidateQueries({ queryKey: ["elementRelationships"] })
      qc.invalidateQueries({ queryKey: queryKeys.relationship(id) })
      toast.success(`Relation ${r.type} mise à jour`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useDeleteRelationship() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRelationship(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["relationships"] })
      qc.invalidateQueries({ queryKey: ["elementRelationships"] })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
      toast.success("Relation supprimée")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useCreateView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ViewCreateIn) => createView(body),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: queryKeys.views() })
      toast.success(`Vue « ${v.name} » créée`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useUpdateView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ViewUpdateIn }) =>
      updateView(id, body),
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: queryKeys.views() })
      toast.success(`Vue « ${v.name} » mise à jour`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useDeleteView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteView(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.views() })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
      toast.success("Vue supprimée")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useCreatePropertyDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PropertyDefinitionCreateIn) =>
      createPropertyDefinition(body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.propertyDefinitions() }),
  })
}

export function useUpdatePropertyDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string
      body: PropertyDefinitionUpdateIn
    }) => updatePropertyDefinition(id, body),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.propertyDefinitions() }),
  })
}

export function useDeletePropertyDefinition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePropertyDefinition(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.propertyDefinitions() }),
  })
}

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: WorkspaceCreateIn) => createWorkspaceApi(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.workspaces() }),
  })
}

export function useActivateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => activateWorkspaceApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces() })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
    },
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: WorkspaceUpdateIn }) =>
      updateWorkspaceApi(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces() })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
    },
  })
}

export function useDeleteWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWorkspaceApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workspaces() })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
    },
  })
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

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations(),
    queryFn: fetchOrganizations,
  })
}

export function useCreateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createOrganizationApi(name),
    onSuccess: (org) => {
      qc.invalidateQueries({ queryKey: queryKeys.organizations() })
      toast.success(`Organisation « ${org.name} » créée`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useRenameOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      renameOrganizationApi(id, name),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.organizations() }),
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useDeleteOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteOrganizationApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organizations() })
      toast.success("Organisation supprimée")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useActivateOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => activateOrganizationApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organizations() })
      qc.invalidateQueries({ queryKey: queryKeys.workspaces() })
      qc.invalidateQueries({ queryKey: queryKeys.model() })
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useOrganizationMembers(orgId: string) {
  return useQuery({
    queryKey: queryKeys.organizationMembers(orgId),
    queryFn: () => fetchOrganizationMembers(orgId),
    enabled: !!orgId,
  })
}

export function useAddOrganizationMember(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ username, role }: { username: string; role: OrgRole }) =>
      addOrganizationMemberApi(orgId, username, role),
    onSuccess: (member) => {
      qc.invalidateQueries({ queryKey: queryKeys.organizationMembers(orgId) })
      toast.success(`« ${member.username} » ajouté à l'organisation`)
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useUpdateOrganizationMemberRole(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      updateOrganizationMemberRoleApi(orgId, userId, role),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.organizationMembers(orgId) }),
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useRemoveOrganizationMember(orgId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => removeOrganizationMemberApi(orgId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.organizationMembers(orgId) })
      toast.success("Membre retiré")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}

// ---------------------------------------------------------------------------
// Platform admin — organizations (metadata only)
// ---------------------------------------------------------------------------

export function usePlatformOrganizations() {
  return useQuery({
    queryKey: queryKeys.platformOrganizations(),
    queryFn: fetchPlatformOrganizations,
  })
}

export function useSetPlatformOrganizationEnabled() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      setPlatformOrganizationEnabled(id, enabled),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.platformOrganizations() }),
    onError: (e) => toast.error((e as Error).message),
  })
}

export function useDeletePlatformOrganization() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePlatformOrganizationApi(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.platformOrganizations() })
      toast.success("Organisation supprimée")
    },
    onError: (e) => toast.error((e as Error).message),
  })
}
