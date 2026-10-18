import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const campaigns = await db.marketingCampaign.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ campaigns });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json();
  if (body.action === "create") {
    const campaign = await db.marketingCampaign.create({
      data: { name: body.name, channel: body.channel, content: body.content || null, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null, status: "draft" },
    });
    return NextResponse.json({ campaign });
  }
  if (body.action === "send" && body.id) {
    const campaign = await db.marketingCampaign.update({
      where: { id: body.id },
      data: { status: "running", scheduledAt: new Date() },
    });
    await db.auditLog.create({ data: { actor: "admin", action: "campaign.send", detail: `Campaign ${body.id} sent via ${campaign.channel}`, severity: "info" } });
    return NextResponse.json({ campaign, status: "EXTERNAL_SETUP_REQUIRED", message: `${campaign.channel} credentials required to actually send. Campaign queued.` });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
