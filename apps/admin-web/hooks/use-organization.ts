"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export interface OrgMetadata {
  description?: string;
  [key: string]: unknown;
}

export interface OrganizationListItem {
  id: string;
  name: string;
  slug: string;
  createdAt: string | Date;
  logo?: string | null;
  metadata?: OrgMetadata | null;
}

async function unwrap<T>(
  promise: Promise<{ data: T | null; error: { message?: string } | null }>,
): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(error.message ?? "Request failed");
  return data as T;
}

export function useOrganizations(): OrganizationListItem[] {
  const { data } = authClient.useListOrganizations();
  return (data as unknown as OrganizationListItem[] | null) ?? [];
}

export function useCreateOrganization() {
  return useMutation({
    mutationFn: (body: { name: string; slug: string; description?: string }) =>
      unwrap(authClient.organization.create({
        name: body.name,
        slug: body.slug,
        metadata: body.description ? { description: body.description } : undefined,
      })),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { organizationId: string; name: string; slug: string; metadata?: OrgMetadata }) =>
      unwrap(authClient.organization.update({
        organizationId: body.organizationId,
        data: { name: body.name, slug: body.slug, metadata: body.metadata },
      })),
    onSuccess: () => qc.invalidateQueries(),
  });
}
