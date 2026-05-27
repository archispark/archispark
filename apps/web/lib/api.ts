export interface ModelInfo {
  identifier: string;
  name: string;
  documentation: string | null;
  version: string | null;
  element_count: number;
  relationship_count: number;
  view_count: number;
}

export interface Property {
  property_definition_ref: string;
  value: string;
}

export interface ElementOut {
  identifier: string;
  name: string;
  type: string;
  documentation: string | null;
  properties: Property[];
}

const BASE = "/api";

export async function fetchModel(): Promise<ModelInfo> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchElementTypes(): Promise<string[]> {
  const res = await fetch(`${BASE}/elements/types`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchElements(
  type?: string | null,
  name?: string | null
): Promise<ElementOut[]> {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (name) params.set("name", name);
  const qs = params.toString();
  const res = await fetch(`${BASE}/elements${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
