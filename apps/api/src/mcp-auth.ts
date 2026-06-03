import { db, mcpTokens } from "@workspace/db";

export async function checkMcpBearer(provided: string | undefined): Promise<boolean> {
  if (!provided) return false;
  const [row] = await db.select({ token: mcpTokens.token }).from(mcpTokens).limit(1);
  return !!row && row.token === provided;
}
