import { get, post, put, del } from "./client"

export interface PropertyDefinitionOut {
  identifier: string
  name: string
  type: string
}

export interface PropertyDefinitionCreateIn {
  name: string
  type?: string
}

export interface PropertyDefinitionUpdateIn {
  name?: string
  type?: string
}

export const fetchPropertyDefinitions = () =>
  get<PropertyDefinitionOut[]>("/property-definitions")
export const createPropertyDefinition = (body: PropertyDefinitionCreateIn) =>
  post<PropertyDefinitionOut>("/property-definitions", body)
export const updatePropertyDefinition = (
  id: string,
  body: PropertyDefinitionUpdateIn
) =>
  put<PropertyDefinitionOut>(
    `/property-definitions/${encodeURIComponent(id)}`,
    body
  )
export const deletePropertyDefinition = (id: string) =>
  del(`/property-definitions/${encodeURIComponent(id)}`)
