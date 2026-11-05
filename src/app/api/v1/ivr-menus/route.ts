/**
 * GET  /api/v1/ivr-menus        — list IVR menus for current tenant
 * POST /api/v1/ivr-menus        — create new IVR menu
 *
 * IVR menu = JSON tree of nodes:
 *   [{ id, type: "play"|"gather"|"route"|"hangup", prompt?, inputVar?,
 *      routes: [{ dtmf, target }] }]
 *
 * Used by the telephony adapter to play prompts + collect DTMF input on
 * inbound calls.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const menus = await db.ivrMenu.findMany({
    where: { companyId: ctx.companyId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });

  return ok({
    menus: menus.map((m) => ({
      ...m,
      tree: JSON.parse(m.tree || '[]'),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !['company_owner', 'admin', 'manager'].includes(ctx.role)) {
    return forbidden('manager role required');
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.name) return badRequest('name is required');

  const created = await db.ivrMenu.create({
    data: {
      companyId: ctx.companyId,
      name: String(body.name),
      description: body.description || null,
      tree: body.tree ? JSON.stringify(body.tree) : '[]',
      language: body.language || 'bn-BD',
      voiceId: body.voiceId || null,
      status: body.status || 'draft',
      createdBy: ctx.userId,
    },
  });

  await emitEvent({
    type: 'ivr_menu.created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'ivr_menu',
    resourceId: created.id,
    title: 'IVR menu created',
    description: `IVR menu "${created.name}" was created`,
    metadata: { language: created.language, status: created.status },
  });

  return ok({
    menu: {
      ...created,
      tree: JSON.parse(created.tree || '[]'),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
