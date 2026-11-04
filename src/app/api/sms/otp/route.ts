import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const body = await req.json();
    const to = String(body.to || '').trim();
    if (!to) return NextResponse.json({ error: 'to required' }, { status: 400 });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const sms = await db.smsMessage.create({ data: { to, from: null, body: `Your ALO Labs verification code is: ${otp}. Valid for 5 minutes.`, status: 'sent', providerMessageId: `otp_${otp}_${Date.now()}`, companyId: payload.companyId, sentBy: payload.userId } });
    return NextResponse.json({ data: { smsId: sms.id, to, otpSent: true, expiresIn: 300, otp: process.env.NODE_ENV === 'production' ? undefined : otp } }, { status: 201 });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload?.companyId) return NextResponse.json({ error: 'Invalid' }, { status: 401 });
    const to = new URL(req.url).searchParams.get('to');
    if (!to) return NextResponse.json({ error: 'to required' }, { status: 400 });
    const recent = await db.smsMessage.findFirst({ where: { to, companyId: payload.companyId, providerMessageId: { startsWith: 'otp_' }, createdAt: { gte: new Date(Date.now() - 300000) } }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ data: { hasActiveOtp: !!recent, sentAt: recent?.createdAt.toISOString() || null } });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
