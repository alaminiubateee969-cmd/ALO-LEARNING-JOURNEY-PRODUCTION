import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const leads = await db.lead.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === "new").length,
    qualified: leads.filter(l => l.status === "qualified").length,
    won: leads.filter(l => l.status === "won").length,
    lost: leads.filter(l => l.status === "lost").length,
  };
  return NextResponse.json({ leads, stats });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json();
  
  if (body.action === "create") {
    const lead = await db.lead.create({
      data: {
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        company: body.company || null,
        source: body.source || "website",
        service: body.service || null,
        budget: body.budget || null,
        status: "new",
        notes: body.notes || null,
      },
    });
    await db.auditLog.create({
      data: { actor: "system", action: "lead.create", detail: `New lead: ${body.name}`, severity: "info" },
    });
    return NextResponse.json({ lead });
  }

  if (body.action === "update_status" && body.id) {
    const lead = await db.lead.update({
      where: { id: body.id },
      data: { status: body.status, notes: body.notes || undefined },
    });
    await db.auditLog.create({
      data: { actor: "admin", action: "lead.update", detail: `Lead ${body.id} → ${body.status}`, severity: "info" },
    });
    return NextResponse.json({ lead });
  }

  if (body.action === "delete" && body.id) {
    await db.lead.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
