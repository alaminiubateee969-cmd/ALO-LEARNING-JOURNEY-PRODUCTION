/**
 * DELETE /api/v1/admin/ai-models/agent-assignments/{agentType}
 *
 * Removes an agent-type → model assignment. The agent then falls back to
 * the default chain.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, ok, notFound } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ agentType: string }> }
) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const { agentType } = await params;
  const existing = await db.agentModelAssignment.findUnique({
    where: { companyId_agentType: { companyId: ctx.companyId, agentType } },
  });
  if (!existing) return notFound(`no assignment for agent type "${agentType}"`);

  await db.agentModelAssignment.delete({ where: { id: existing.id } });
  return ok({ deleted: true, agentType });
}
