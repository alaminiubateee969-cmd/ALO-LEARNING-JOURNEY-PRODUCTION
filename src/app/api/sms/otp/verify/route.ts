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
    const to = String(body.to || '').trim(), code = String(body.code || '').trim();
    if (!to || !code) return NextResponse.json({ error: 'to and code required' }, { status: 400 });
    const otpMessage = await db.smsMessage.findFirst({ where: { to, companyId: payload.companyId, providerMessageId: { startsWith: 'otp_' }, createdAt: { gte: new Date(Date.now() - 300000) } }, orderBy: { createdAt: 'desc' } });
    if (!otpMessage) return NextResponse.json({ data: { verified: false, reason: 'OTP expired' } });
    const storedOtp = otpMessage.providerMessageId.split('_')[1];
    if (storedOtp === code) { await db.smsMessage.update({ where: { id: otpMessage.id }, data: { status: 'delivered' } }); return NextResponse.json({ data: { verified: true } }); }
    return NextResponse.json({ data: { verified: false, reason: 'Invalid code' } });
  } catch { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
