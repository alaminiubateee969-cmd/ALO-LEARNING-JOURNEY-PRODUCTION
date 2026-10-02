import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// PATCH /api/workflows/[id] — update workflow
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.workflow.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const update: any = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.description !== undefined) update.description = body.description ? String(body.description) : null;
    if (body.trigger !== undefined) update.trigger = String(body.trigger);
    if (body.triggerConfig !== undefined) update.triggerConfig = JSON.stringify(body.triggerConfig);
    if (body.steps !== undefined) update.steps = JSON.stringify(body.steps);
    if (body.isActive !== undefined) update.isActive = !!body.isActive;

    const workflow = await db.workflow.update({ where: { id }, data: update });
    return NextResponse.json({ data: workflow });
  } catch (err) {
    console.error('[PATCH /api/workflows/[id]]', err);
    return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 });
  }
}

// DELETE /api/workflows/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await db.workflow.findFirst({ where: { id, companyId: payload.companyId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await db.workflow.delete({ where: { id } });
    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error('[DELETE /api/workflows/[id]]', err);
    return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 });
  }
}
