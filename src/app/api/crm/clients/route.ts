import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const clients = await db.client.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ clients });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json();
  if (body.action === "create") {
    const client = await db.client.create({
      data: { name: body.name, email: body.email, phone: body.phone || null, company: body.company || null, type: body.type || "individual" },
    });
    await db.auditLog.create({ data: { actor: "admin", action: "client.create", detail: `Client: ${body.name}`, severity: "info" } });
    return NextResponse.json({ client });
  }
  if (body.action === "delete" && body.id) {
    await db.client.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
