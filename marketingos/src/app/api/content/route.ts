import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { type, status } = Object.fromEntries(new URL(req.url).searchParams);
    const where: any = { companyId: payload.companyId };
    if (type && type !== 'all') where.type = type;
    if (status && status !== 'all') where.status = status;

    const content = await db.content.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ content });
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

    const data = await req.json();
    // Prisma stores engagement as String, so JSON.stringify objects
    const createData: any = { ...data, creatorId: payload.userId, companyId: payload.companyId };
    if (data.engagement && typeof data.engagement === 'object') {
      createData.engagement = JSON.stringify(data.engagement);
    }
    if (data.scheduledAt) createData.scheduledAt = new Date(data.scheduledAt);
    if (data.publishedAt) createData.publishedAt = new Date(data.publishedAt);
    createData.aiGenerated = data.aiGenerated || false;
    const content = await db.content.create({ data: createData });

    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
