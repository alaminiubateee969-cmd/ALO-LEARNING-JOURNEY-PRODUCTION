import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { emitEvent } from '@/lib/events';

// Prisma rejects unknown arguments, so the request body is mapped onto the
// MosCampaign model explicitly. The dashboard form also posts `description`,
// which the model does not have; it is folded into `metrics` metadata instead
// of failing the insert. `metrics` is TEXT NOT NULL and older deployments were
// created without the column default, so it is always written explicitly.
function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function jsonText(value: unknown, fallback = '{}'): string {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

function optionalDate(value: unknown): Date | null {
  const text = optionalText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function optionalNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const campaigns = await db.mosCampaign.findMany({
      where: { companyId: payload.companyId },
      include: { contents: true },
      orderBy: { createdAt: 'desc' },
    });

    // Parse metrics JSON strings into objects so the frontend can read them directly
    const parsed = campaigns.map((c) => ({
      ...c,
      metrics: (() => { try { return JSON.parse(c.metrics || '{}'); } catch { return {}; } })(),
    }));

    return NextResponse.json({ campaigns: parsed });
  } catch (err) {
    console.error('[GET /api/campaigns]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    if (!payload.companyId) {
      return NextResponse.json({ error: 'No company associated' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const name = optionalText(body.name);
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const metrics = (() => {
      const parsed = (() => {
        try { return JSON.parse(jsonText(body.metrics)); } catch { return {}; }
      })();
      const base = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      const description = optionalText(body.description);
      return description ? { ...base, description } : base;
    })();

    const campaign = await db.mosCampaign.create({
      data: {
        name,
        type: optionalText(body.type) ?? 'social',
        status: optionalText(body.status) ?? 'draft',
        budget: optionalNumber(body.budget),
        startDate: optionalDate(body.startDate),
        endDate: optionalDate(body.endDate),
        metrics: JSON.stringify(metrics),
        companyId: payload.companyId,
      },
    });

    // Fire event: campaign created
    await emitEvent({
      companyId: payload.companyId,
      userId: payload.userId,
      type: 'campaign.created',
      title: 'New campaign created',
      description: `Campaign "${campaign.name}" created (${campaign.type}${campaign.budget !== null ? `, $${campaign.budget} budget` : ''})`,
      resourceType: 'campaign',
      resourceId: campaign.id,
      link: '/campaigns',
      metadata: { name: campaign.name, type: campaign.type, budget: campaign.budget },
    });

    return NextResponse.json({ campaign });
  } catch (err) {
    console.error('[POST /api/campaigns]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
