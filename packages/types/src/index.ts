// ---------------------------------------------------------------------------
// Shared API types — single source of truth for API ↔ Web
// These types mirror the output schemas in apps/api/src/schemas.ts
// ---------------------------------------------------------------------------

export interface RGBColor {
  r: number;
  g: number;
  b: number;
  a?: number | null;
}

export interface Font {
  name?: string | null;
  size?: number | null;
  style?: string | null;
  color?: RGBColor | null;
}

export interface Style {
  line_color?: RGBColor | null;
  fill_color?: RGBColor | null;
  font?: Font | null;
  line_width?: number | null;
}

export interface Property {
  property_definition_ref: string;
  value: string;
}

export interface ModelInfo {
  identifier: string;
  name: string;
  documentation: string | null;
  version: string | null;
  element_count: number;
  relationship_count: number;
  view_count: number;
  property_definition_count: number;
  workspace_id?: string | null;
  workspace_name?: string | null;
}

export interface ElementOut {
  identifier: string;
  name: string;
  type: string;
  documentation: string | null;
  properties: Property[];
}

export interface RelationshipOut {
  identifier: string;
  name?: string | null;
  type: string;
  source: string;
  source_name?: string | null;
  target: string;
  target_name?: string | null;
  documentation?: string | null;
  properties: Property[];
  access_type?: string | null;
  is_directed?: boolean | null;
  modifier?: string | null;
}

export type EdgeSide = "top" | "right" | "bottom" | "left";

export interface ConnectionOut {
  identifier: string;
  name?: string | null;
  relationship_ref?: string | null;
  source?: string | null;
  target?: string | null;
  source_side?: EdgeSide | null;
  target_side?: EdgeSide | null;
  style?: Style | null;
}

export interface NodeOut {
  identifier: string;
  name?: string | null;
  element_ref?: string | null;
  x?: number | null;
  y?: number | null;
  w?: number | null;
  h?: number | null;
  style?: Style | null;
  children: NodeOut[];
}

export interface ViewOut {
  identifier: string;
  name: string;
  documentation?: string | null;
  viewpoint?: string | null;
  node_count: number;
  connection_count: number;
}

export interface ViewDetailOut extends ViewOut {
  nodes: NodeOut[];
  connections: ConnectionOut[];
}

export interface PropertyDefinitionOut {
  identifier: string;
  name: string;
  type: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path?: string | null;
  active: boolean;
}

export interface UserOut {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

export const PERMISSION_FLAGS = ["read", "create", "update", "delete"] as const;
export type PermissionFlag = typeof PERMISSION_FLAGS[number];
export type LayerPermissions = PermissionFlag[];

export const ARCHIMATE_LAYERS = [
  "Strategy",
  "Business",
  "Application",
  "Technology",
  "Motivation",
  "Physical",
  "Implementation",
  "Composite",
  "Relations",
  "Views",
] as const;
export type ArchiLayer = typeof ARCHIMATE_LAYERS[number];

export interface RoleOut {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  permissions: Record<ArchiLayer, LayerPermissions>;
  user_ids: string[];
}
