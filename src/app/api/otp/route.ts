import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * ALO OTP / Verification Service
 * Generates 6-digit codes, persists with expiry, verifies with attempt limits.
 * Channels: sms | email | whatsapp | voice
 * Real delivery is mocked (no Twilio/SMTP) — code is returned for dev preview.
 * In production, wire the delivery adapter to real providers.
 */

function generate6DigitCode(): string {
  // cryptographically-weak but fine for dev; use crypto.randomInt in prod
  return String(Math.floor(100000 + Math.random() * 900000));
}

function isExpired(expiresAt: Date): boolean {
  return new Date(expiresAt).getTime() < Date.now();
}

// GET — list recent OTP requests (admin view)
export async function GET() {
  try {
    const recent = await db.otpRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const stats = {
      total: recent.length,
      pending: recent.filter((r) => r.status === 'pending').length,
      delivered: recent.filter((r) => r.status === 'delivered').length,
      verified: recent.filter((r) => r.status === 'verified').length,
      expired: recent.filter((r) => r.status === 'expired').length,
      failed: recent.filter((r) => r.status === 'failed').length,
    };
    // mask codes in list view for security (only show last 2 digits)
    const masked = recent.map((r) => ({
      ...r,
      code: r.status === 'verified' ? '******' : `••••${r.code.slice(-2)}`,
    }));
    return NextResponse.json({ requests: masked, stats });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST — generate + send OTP, or verify an existing OTP
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action: string = body.action || 'send';

    // ---------- VERIFY ----------
    if (action === 'verify') {
      const { recipient, code } = body as { recipient: string; code: string };
      if (!recipient || !code) {
        return NextResponse.json(
          { ok: false, error: 'recipient and code are required' },
          { status: 400 }
        );
      }
      // find the most recent pending/delivered OTP for this recipient
      const otp = await db.otpRequest.findFirst({
        where: {
          recipient,
          status: { in: ['pending', 'delivered'] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!otp) {
        return NextResponse.json(
          { ok: false, error: 'No active OTP for this recipient' },
          { status: 404 }
        );
      }
      if (isExpired(otp.expiresAt)) {
        await db.otpRequest.update({
          where: { id: otp.id },
          data: { status: 'expired' },
        });
        return NextResponse.json(
          { ok: false, error: 'OTP has expired. Please request a new one.' },
          { status: 410 }
        );
      }
      if (otp.attempts >= otp.maxAttempts) {
        await db.otpRequest.update({
          where: { id: otp.id },
          data: { status: 'failed' },
        });
        return NextResponse.json(
          {
            ok: false,
            error: 'Max verification attempts exceeded. Please request a new OTP.',
          },
          { status: 429 }
        );
      }
      // increment attempts
      const updated = await db.otpRequest.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });

      if (otp.code !== String(code).trim()) {
        return NextResponse.json(
          {
            ok: false,
            error: `Invalid code. ${
              updated.maxAttempts - updated.attempts
            } attempts remaining.`,
            attemptsRemaining: updated.maxAttempts - updated.attempts,
          },
          { status: 401 }
        );
      }

      // success
      const verified = await db.otpRequest.update({
        where: { id: otp.id },
        data: { status: 'verified', verifiedAt: new Date() },
      });
      return NextResponse.json({
        ok: true,
        status: 'verified',
        recipient: verified.recipient,
        purpose: verified.purpose,
        verifiedAt: verified.verifiedAt,
      });
    }

    // ---------- SEND (default) ----------
    const {
      recipient,
      channel = 'sms',
      purpose = 'verification',
      ttlSeconds = 300, // 5 min default
    } = body as {
      recipient: string;
      channel?: string;
      purpose?: string;
      ttlSeconds?: number;
    };

    if (!recipient) {
      return NextResponse.json(
        { ok: false, error: 'recipient is required' },
        { status: 400 }
      );
    }

    // validate channel
    const validChannels = ['sms', 'email', 'whatsapp', 'voice'];
    if (!validChannels.includes(channel)) {
      return NextResponse.json(
        { ok: false, error: `channel must be one of ${validChannels.join(', ')}` },
        { status: 400 }
      );
    }

    // basic recipient format check
    if (channel === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }
    if ((channel === 'sms' || channel === 'whatsapp' || channel === 'voice') &&
        !/^[+]?[\d\s-]{8,15}$/.test(recipient)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    // expire any prior pending OTPs for this recipient (so only the newest is active)
    await db.otpRequest.updateMany({
      where: { recipient, status: { in: ['pending', 'delivered'] } },
      data: { status: 'expired' },
    });

    const code = generate6DigitCode();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // ---- Delivery adapter (mock — wire to real provider in prod) ----
    let deliveryStatus = 'delivered';
    let deliveryError: string | null = null;
    let providerMeta: Record<string, unknown> = {};

    try {
      // In production, dispatch by channel:
      //   sms/voice -> Twilio / 46elks / httpsms
      //   email -> SMTP / SendGrid / Postmark
      //   whatsapp -> WhatsApp Business API / wacrm
      // Here we simulate a successful handoff to the provider.
      providerMeta = {
        provider: 'alo-internal-dev',
        messageId: `msg_${Date.now()}`,
        channel,
        simulated: true,
        note: 'Wire to real provider (Twilio/SendGrid/WABA) in production',
      };
    } catch (e) {
      deliveryStatus = 'failed';
      deliveryError = (e as Error).message;
    }

    const record = await db.otpRequest.create({
      data: {
        channel,
        recipient,
        code,
        purpose,
        status: deliveryStatus,
        expiresAt,
        metadataJson: JSON.stringify(providerMeta),
      },
    });

    return NextResponse.json({
      ok: deliveryStatus === 'delivered',
      id: record.id,
      channel,
      recipient,
      purpose,
      status: deliveryStatus,
      expiresAt,
      ttlSeconds,
      // DEV ONLY: return the code so it can be displayed for testing.
      // In production, REMOVE this field and only deliver via the provider.
      devPreviewCode: code,
      error: deliveryError,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
