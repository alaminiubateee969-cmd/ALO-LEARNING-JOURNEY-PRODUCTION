import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const members = await db.companyUser.findMany({
      where: { companyId: payload.companyId },
      include: { user: true },
      orderBy: { joinedAt: 'desc' },
    });

    const invitations = await db.invitation.findMany({
      where: { companyId: payload.companyId, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const auditLogs = await db.auditLog.findMany({
      where: { companyId: payload.companyId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ members, invitations, auditLogs, roles: ROLE_LABELS });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { action, ...data } = await req.json();

    if (action === 'invite') {
      const { email, role } = data;
      const token = crypto.randomUUID().replace(/-/g, '');
      const invitation = await db.invitation.create({
        data: {
          email,
          role: role || 'team_member',
          token,
          expiresAt: new Date(Date.now() + 7 * 86400000),
          companyId: payload.companyId,
        },
      });
      return NextResponse.json({ invitation });
    }

    if (action === 'update_role') {
      const { companyUserId, role } = data;
      const updated = await db.companyUser.update({
        where: { id: companyUserId, companyId: payload.companyId },
        data: { role },
      });
      return NextResponse.json({ updated });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}