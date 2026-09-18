import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { status, search } = Object.fromEntries(new URL(req.url).searchParams);
    const where: any = { companyId: payload.companyId };
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { companyName: { contains: search } },
      ];
    }

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { activities: { take: 3, orderBy: { createdAt: 'desc' } }, tags: true },
    });

    const pipeline = await db.deal.groupBy({
      by: ['stage'],
      where: { companyId: payload.companyId },
      _count: true,
      _sum: { value: true },
    });

    const contacts = await db.contact.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'desc' },
    });

    const tickets = await db.ticket.findMany({
      where: { companyId: payload.companyId },
      orderBy: { createdAt: 'desc' },
      include: { messages: { take: 1 } },
    });

    return NextResponse.json({ leads, pipeline, contacts, tickets });
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
    const lead = await db.lead.create({
      data: { ...data, companyId: payload.companyId },
    });

    return NextResponse.json({ lead });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
