/**
 * GET    /api/v1/ivr-menus/{id}
 * PATCH  /api/v1/ivr-menus/{id}    — update name/description/tree/language/voiceId/status
 * DELETE /api/v1/ivr-menus/{id}    — soft-delete (status=archived)
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, forbidden, badRequest, ok, notFound } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

const WRITABLE = ['name', 'description', 'tree', 'language', 'voiceId', 'status'] as const;

function serialize(m: any) {
  return {
    ...m,
    tree: JSON.parse(m.tree || '[]'),
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const { id } = await params;
  const menu = await db.ivrMenu.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!menu) return notFound('ivr menu not found');
  return ok({ menu: serialize(menu) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !['company_owner', 'admin', 'manager'].includes(ctx.role)) {
    return forbidden('manager role required');
  }

  const { id } = await params;
  const existing = await db.ivrMenu.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('ivr menu not found');

  const body = await request.json().catch(() => null);
  if (!body) return badRequest('body required');

  const update: any = {};
  for (const k of WRITABLE) {
    if (!(k in body)) continue;
    update[k] = k === 'tree' ? (Array.isArray(body[k]) ? JSON.stringify(body[k]) : body[k]) : body[k];
  }

  const updated = await db.ivrMenu.update({ where: { id }, data: update });

  await emitEvent({
    type: 'ivr_menu.updated',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'ivr_menu',
    resourceId: id,
    title: 'IVR menu updated',
    description: `IVR menu "${updated.name}" was updated`,
    metadata: { fields: Object.keys(update) },
  });

  return ok({ menu: serialize(updated) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();
  if (!ctx.isSuperAdmin && !['company_owner', 'admin', 'manager'].includes(ctx.role)) {
    return forbidden('manager role required');
  }

  const { id } = await params;
  const existing = await db.ivrMenu.findFirst({ where: { id, companyId: ctx.companyId } });
  if (!existing) return notFound('ivr menu not found');

  await db.ivrMenu.update({ where: { id }, data: { status: 'archived' } });

  await emitEvent({
    type: 'ivr_menu.archived',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'ivr_menu',
    resourceId: id,
    title: 'IVR menu archived',
    description: `IVR menu "${existing.name}" was archived`,
    metadata: {},
  });

  return ok({ archived: true, id });
}
