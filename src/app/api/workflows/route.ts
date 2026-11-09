import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// GET /api/workflows — list all workflows
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const workflows = await db.workflow.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { runs: true } } },
    });

    return NextResponse.json({
      data: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        trigger: w.trigger,
        triggerConfig: (() => { try { return JSON.parse(w.triggerConfig || '{}'); } catch { return {}; } })(),
        steps: (() => { try { return JSON.parse(w.steps || '[]'); } catch { return []; } })(),
        isActive: w.isActive,
        lastRunAt: w.lastRunAt?.toISOString() || null,
        runCount: w.runCount,
        runHistoryCount: w._count.runs,
        createdAt: w.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[GET /api/workflows]', err);
    return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
  }
}

// POST /api/workflows — create a new workflow
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const triggers = ['manual', 'lead.created', 'deal.won', 'ticket.created', 'schedule'];
    const trigger = triggers.includes(body.trigger) ? body.trigger : 'manual';

    const workflow = await db.workflow.create({
      data: {
        name,
        description: body.description ? String(body.description) : null,
        trigger,
        triggerConfig: JSON.stringify(body.triggerConfig || {}),
        steps: JSON.stringify(body.steps || []),
        isActive: body.isActive || false,
        companyId: payload.companyId,
        createdBy: payload.userId,
      },
    });

    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'workflow.created',
      title: 'Workflow created',
      description: `Workflow "${workflow.name}" created (${trigger} trigger, ${Array.isArray(body.steps) ? body.steps.length : 0} steps)`,
      resourceType: 'workflow',
      resourceId: workflow.id,
    });

    return NextResponse.json({
      data: {
        id: workflow.id,
        name: workflow.name,
        trigger: workflow.trigger,
        isActive: workflow.isActive,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/workflows]', err);
    return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
  }
}
