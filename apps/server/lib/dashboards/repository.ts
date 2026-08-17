/**
 * Dashboard CRUD sur Drizzle (`@workspace/db`).
 * Un dashboard est soit propre à un workspace (`workspaceId` défini, créé
 * depuis l'admin), soit système et partagé par tous les workspaces
 * (`workspaceId` NULL, `isSystem: true` — voir migration
 * `0032_dashboard_system_seed.sql`, même convention que
 * `imagePacks.organizationId` NULL). Toutes les méthodes prennent
 * `workspaceId` en premier paramètre : c'est le point d'application du
 * scoping — l'appelant (routes API) le résout via
 * `resolveActiveContext`/`assertOrgAccess` (lib/archimate/access.ts), jamais
 * lu depuis le payload client. Un dashboard système n'est jamais retourné
 * par `findWorkspaceHead` : il ne peut donc ni être édité, ni supprimé, quel
 * que soit le workspace appelant.
 */
import { and, eq, isNull, or } from "drizzle-orm"
import { db, dashboards, dashboardRevisions } from "@workspace/db"
import { NotFoundError, ValidationError } from "@/lib/archimate/errors"
import {
  dashboardRevisionSchema,
  type DashboardDefinition,
  type DashboardRevision,
} from "./contracts"

export interface DashboardAdministrationEntry {
  revision: DashboardRevision
  isSystem: boolean
  deletedAt: string | null
}

function toIso(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toISOString()
}

function toRevision(row: {
  dashboardId: string
  revision: number
  definition: unknown
  createdAt: number
  createdById: string
}): DashboardRevision {
  return dashboardRevisionSchema.parse({
    dashboardId: row.dashboardId,
    revision: row.revision,
    definition: row.definition,
    createdAt: toIso(row.createdAt),
    createdBy: row.createdById,
  })
}

/** A workspace sees its own dashboards plus every system dashboard (`workspaceId IS NULL`). */
function visibleToWorkspace(workspaceId: number) {
  return or(eq(dashboards.workspaceId, workspaceId), isNull(dashboards.workspaceId))
}

async function selectLatestRevisions(workspaceId: number, includeDeleted: boolean) {
  return db
    .select({
      dashboardId: dashboards.dashboardId,
      revision: dashboardRevisions.revision,
      definition: dashboardRevisions.definition,
      createdAt: dashboardRevisions.createdAt,
      createdById: dashboardRevisions.createdById,
      isSystem: dashboards.isSystem,
      deletedAt: dashboards.deletedAt,
    })
    .from(dashboardRevisions)
    .innerJoin(
      dashboards,
      and(
        eq(dashboards.id, dashboardRevisions.dashboardId),
        eq(dashboards.latestRevision, dashboardRevisions.revision)
      )
    )
    .where(
      includeDeleted
        ? visibleToWorkspace(workspaceId)
        : and(visibleToWorkspace(workspaceId), isNull(dashboards.deletedAt))
    )
}

export async function listLatestRevisions(workspaceId: number): Promise<DashboardRevision[]> {
  const rows = await selectLatestRevisions(workspaceId, false)
  return rows.map(toRevision)
}

export async function listForAdministration(
  workspaceId: number
): Promise<DashboardAdministrationEntry[]> {
  const rows = await selectLatestRevisions(workspaceId, true)
  return rows.map((row) => ({
    revision: toRevision(row),
    isSystem: row.isSystem,
    deletedAt: row.deletedAt === null ? null : toIso(row.deletedAt),
  }))
}

/** Only a dashboard actually owned by this workspace — never a system dashboard. Editable/deletable candidate. */
async function findWorkspaceHead(workspaceId: number, dashboardId: string) {
  const [head] = await db
    .select()
    .from(dashboards)
    .where(and(eq(dashboards.workspaceId, workspaceId), eq(dashboards.dashboardId, dashboardId)))
  return head
}

async function findSystemHead(dashboardId: string) {
  const [head] = await db
    .select()
    .from(dashboards)
    .where(and(isNull(dashboards.workspaceId), eq(dashboards.dashboardId, dashboardId)))
  return head
}

/** Workspace-owned dashboard if one exists under this id, else the shared system dashboard. */
async function findHead(workspaceId: number, dashboardId: string) {
  return (await findWorkspaceHead(workspaceId, dashboardId)) ?? (await findSystemHead(dashboardId))
}

export async function getLatestRevision(
  workspaceId: number,
  dashboardId: string
): Promise<DashboardRevision | undefined> {
  const head = await findHead(workspaceId, dashboardId)
  if (!head || head.deletedAt !== null) return undefined
  const [row] = await db
    .select({
      revision: dashboardRevisions.revision,
      definition: dashboardRevisions.definition,
      createdAt: dashboardRevisions.createdAt,
      createdById: dashboardRevisions.createdById,
    })
    .from(dashboardRevisions)
    .where(and(eq(dashboardRevisions.dashboardId, head.id), eq(dashboardRevisions.revision, head.latestRevision)))
  return row ? toRevision({ ...row, dashboardId }) : undefined
}

export async function getRevision(
  workspaceId: number,
  dashboardId: string,
  revision: number
): Promise<DashboardRevision | undefined> {
  const head = await findHead(workspaceId, dashboardId)
  if (!head) return undefined
  const [row] = await db
    .select({
      revision: dashboardRevisions.revision,
      definition: dashboardRevisions.definition,
      createdAt: dashboardRevisions.createdAt,
      createdById: dashboardRevisions.createdById,
    })
    .from(dashboardRevisions)
    .where(and(eq(dashboardRevisions.dashboardId, head.id), eq(dashboardRevisions.revision, revision)))
  return row ? toRevision({ ...row, dashboardId }) : undefined
}

export async function isSystemDashboard(workspaceId: number, dashboardId: string): Promise<boolean> {
  const head = await findHead(workspaceId, dashboardId)
  return head?.isSystem ?? false
}

/**
 * Crée une nouvelle révision (1 si le dashboard n'existe pas encore dans ce
 * workspace, sinon `latestRevision + 1`) — toujours immuable : l'historique
 * des révisions précédentes est conservé. Un dashboard précédemment
 * supprimé est ressuscité (deletedAt remis à NULL). Un dashboard système
 * partage le même identifiant à travers tous les workspaces : créer un
 * dashboard de workspace sous un identifiant déjà pris par un dashboard
 * système est refusé plutôt que de le masquer silencieusement.
 */
export async function createRevision(
  workspaceId: number,
  dashboardId: string,
  definition: DashboardDefinition,
  authorId: string
): Promise<DashboardRevision> {
  if (definition.id !== dashboardId) {
    throw new Error(
      `L'identifiant du dashboard (${dashboardId}) ne correspond pas à definition.id (${definition.id}).`
    )
  }
  return db.transaction(async (tx) => {
    const [head] = await tx
      .select()
      .from(dashboards)
      .where(and(eq(dashboards.workspaceId, workspaceId), eq(dashboards.dashboardId, dashboardId)))
      .for("update")

    if (!head) {
      const [systemHead] = await tx
        .select({ id: dashboards.id })
        .from(dashboards)
        .where(and(isNull(dashboards.workspaceId), eq(dashboards.dashboardId, dashboardId)))
      if (systemHead)
        throw new ValidationError(
          `L'identifiant « ${dashboardId} » est déjà utilisé par un dashboard système.`
        )
    }

    const revision = head ? head.latestRevision + 1 : 1
    let dashboardRowId: number
    if (head) {
      await tx
        .update(dashboards)
        .set({ latestRevision: revision, deletedAt: null })
        .where(eq(dashboards.id, head.id))
      dashboardRowId = head.id
    } else {
      const [inserted] = await tx
        .insert(dashboards)
        .values({
          workspaceId,
          dashboardId,
          isSystem: false,
          latestRevision: revision,
          createdById: authorId,
        })
        .returning({ id: dashboards.id })
      dashboardRowId = inserted!.id
    }

    await tx.insert(dashboardRevisions).values({
      dashboardId: dashboardRowId,
      revision,
      definition,
      createdById: authorId,
    })

    return dashboardRevisionSchema.parse({
      dashboardId,
      revision,
      definition,
      createdAt: new Date().toISOString(),
      createdBy: authorId,
    })
  })
}

export async function deleteDashboard(workspaceId: number, dashboardId: string): Promise<void> {
  const head = await findWorkspaceHead(workspaceId, dashboardId)
  if (head) {
    if (head.deletedAt !== null) throw new NotFoundError(`Dashboard introuvable : ${dashboardId}`)
    await db
      .update(dashboards)
      .set({ deletedAt: Math.floor(Date.now() / 1000) })
      .where(eq(dashboards.id, head.id))
    return
  }
  if (await findSystemHead(dashboardId))
    throw new ValidationError("Un dashboard système ne peut pas être supprimé.")
  throw new NotFoundError(`Dashboard introuvable : ${dashboardId}`)
}
