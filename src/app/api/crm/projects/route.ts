import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const projects = await db.project.findMany({ orderBy: { createdAt: "desc" } });
  const stats = {
    total: projects.length,
    active: projects.filter(p => ["approved","development","review"].includes(p.status)).length,
    completed: projects.filter(p => p.status === "completed").length,
    pending: projects.filter(p => ["inquiry","proposal"].includes(p.status)).length,
  };
  return NextResponse.json({ projects, stats });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json();
  if (body.action === "create") {
    const project = await db.project.create({
      data: { clientId: body.clientId, name: body.name, service: body.service, budget: body.budget || null, deadline: body.deadline ? new Date(body.deadline) : null, description: body.description || null, status: "inquiry" },
    });
    await db.auditLog.create({ data: { actor: "admin", action: "project.create", detail: `Project: ${body.name}`, severity: "info" } });
    return NextResponse.json({ project });
  }
  if (body.action === "update_status" && body.id) {
    const project = await db.project.update({ where: { id: body.id }, data: { status: body.status } });
    return NextResponse.json({ project });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
