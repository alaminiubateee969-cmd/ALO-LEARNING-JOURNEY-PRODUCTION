import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sendSmsViaProvider } from '@/lib/sms-provider-chain';
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
    const messageBody = `Your ALO Labs verification code is: ${otp}. Valid for 5 minutes.`;

    // Persist with status='queued' first
    const sms = await db.smsMessage.create({
      data: {
        to,
        from: null,
        body: messageBody,
        status: 'queued',
        providerMessageId: `otp_${otp}_${Date.now()}`,
        companyId: payload.companyId,
        sentBy: payload.userId,
      },
    });

    // Try real provider delivery (Twilio / httpSMS / Telnyx / Domovina).
    // Falls through to simulation when no provider is configured.
    const result = await sendSmsViaProvider({
      to,
      body: messageBody,
      companyId: payload.companyId,
      sentBy: payload.userId,
    });

    // Update the row with the actual outcome
    await db.smsMessage.update({
      where: { id: sms.id },
      data: {
        status: result.status === 'simulation' ? 'sent' : result.status,
        providerMessageId: result.providerMessageId
          ? `otp_${otp}_${result.providerName}_${result.providerMessageId}`
          : `otp_${otp}_${Date.now()}`,
      },
    });

    return NextResponse.json({
      data: {
        smsId: sms.id,
        to,
        otpSent: result.status !== 'failed',
        simulated: result.simulated,
        provider: result.providerName,
        expiresIn: 300,
        // OTP is returned in non-production so the operator can test verification
        otp: process.env.NODE_ENV === 'production' ? undefined : otp,
        ...(result.error ? { warning: result.error } : {}),
      },
    }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed', message: e?.message?.slice(0, 200) }, { status: 500 });
  }
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
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
