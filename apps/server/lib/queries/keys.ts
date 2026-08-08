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
  organizationInvitations: (orgId: string) =>
    ["organizationInvitations", orgId] as const,
  invitationPreview: (token: string) => ["invitationPreview", token] as const,
  platformOrganizations: () => ["platformOrganizations"] as const,
}
