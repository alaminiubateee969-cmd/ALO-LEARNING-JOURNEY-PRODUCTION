/**
 * GET   /api/v1/admin/ai-models/agent-assignments            — list all assignments
 * POST  /api/v1/admin/ai-models/agent-assignments            — create/update assignment
 *
 * Body for POST:
 *   { "agentType": "seo", "providerId": "...", "modelId": "...",
 *     "isEnabled": true, "dailyTokenBudget": 100000, "dailyRequestBudget": 100 }
 *
 * Per requirement 5: configurable model selection for SEO, content, WhatsApp,
 * SMS, lead qualification and CRM agents.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok, notFound } from '@/lib/v1-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const assignments = await db.agentModelAssignment.findMany({
    where: { companyId: ctx.companyId },
    include: { provider: true, model: true },
    orderBy: { agentType: 'asc' },
  });

  return ok({
    assignments: assignments.map((a) => ({
      id: a.id,
      agentType: a.agentType,
      providerId: a.providerId,
      providerSlug: a.provider.slug,
      providerLabel: a.provider.label,
      modelId: a.modelId,
      modelDisplayName: a.model.displayName,
      modelModelId: a.model.modelId,
      isEnabled: a.isEnabled,
      dailyTokenBudget: a.dailyTokenBudget,
      dailyRequestBudget: a.dailyRequestBudget,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin) return forbidden('super_admin role required');

  const body = await request.json().catch(() => null);
  if (!body || !body.agentType || !body.providerId || !body.modelId) {
    return badRequest('agentType, providerId, and modelId are required');
  }

  // Validate the model belongs to the provider
  const model = await db.aiModelEntry.findUnique({
    where: { providerId_modelId: { providerId: body.providerId, modelId: body.modelId } },
  });
  if (!model) return badRequest(`model "${body.modelId}" not found in provider ${body.providerId}`);

  const assignment = await db.agentModelAssignment.upsert({
    where: { companyId_agentType: { companyId: ctx.companyId, agentType: body.agentType } },
    update: {
      providerId: body.providerId,
      modelId: model.id,
      isEnabled: body.isEnabled ?? true,
      dailyTokenBudget: body.dailyTokenBudget ?? 100000,
      dailyRequestBudget: body.dailyRequestBudget ?? 100,
      updatedBy: ctx.userId,
    },
    create: {
      companyId: ctx.companyId,
      agentType: body.agentType,
      providerId: body.providerId,
      modelId: model.id,
      isEnabled: body.isEnabled ?? true,
      dailyTokenBudget: body.dailyTokenBudget ?? 100000,
      dailyRequestBudget: body.dailyRequestBudget ?? 100,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    },
    include: { provider: true, model: true },
  });

  return ok({
    id: assignment.id,
    agentType: assignment.agentType,
    provider: assignment.provider.slug,
    model: assignment.model.modelId,
    isEnabled: assignment.isEnabled,
  });
}
