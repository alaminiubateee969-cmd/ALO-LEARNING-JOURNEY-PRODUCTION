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
    const content = await db.content.create({
      data: {
        ...data,
        creatorId: payload.userId,
        companyId: payload.companyId,
        aiGenerated: data.aiGenerated || false,
      },
    });

    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
