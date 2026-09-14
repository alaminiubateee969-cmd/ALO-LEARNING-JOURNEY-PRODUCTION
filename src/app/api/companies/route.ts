import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const companies = await db.company.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ companies });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const { action, name, domain, plan } = await req.json().catch(() => ({
    action: "list", name: "", domain: "", plan: "growth",
  }));

  if (action === "create") {
    const company = await db.company.create({
      data: { name, domain: domain || null, plan: plan || "growth", active: true },
    });
    await db.auditLog.create({
      data: { actor: "admin", action: "company.create", detail: `Created company "${name}" (${plan})`, severity: "info" },
    });
    return NextResponse.json({ company });
  }

  if (action === "suspend" || action === "activate") {
    const { id } = await req.json().catch(() => ({ id: "" }));
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const active = action === "activate";
    await db.company.update({ where: { id }, data: { active } });
    await db.auditLog.create({
      data: { actor: "admin", action: `company.${action}`, detail: `Company ${id} → ${active ? "active" : "suspended"}`, severity: "warn" },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
