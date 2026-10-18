import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const invoices = await db.invoice.findMany({ orderBy: { createdAt: "desc" } });
  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === "paid").length,
    pending: invoices.filter(i => ["draft","sent"].includes(i.status)).length,
    overdue: invoices.filter(i => i.status === "overdue").length,
    totalAmount: invoices.filter(i => i.status === "paid").reduce((s,i) => s + i.amount, 0),
  };
  return NextResponse.json({ invoices, stats });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json();
  if (body.action === "create") {
    const invoice = await db.invoice.create({
      data: { clientId: body.clientId, projectId: body.projectId || null, amount: body.amount, currency: body.currency || "BDT", status: "draft", itemsJson: body.items ? JSON.stringify(body.items) : null, dueDate: body.dueDate ? new Date(body.dueDate) : null },
    });
    return NextResponse.json({ invoice });
  }
  if (body.action === "mark_paid" && body.id) {
    const invoice = await db.invoice.update({ where: { id: body.id }, data: { status: "paid", paidAt: new Date() } });
    await db.auditLog.create({ data: { actor: "admin", action: "invoice.paid", detail: `Invoice ${body.id} paid: ${invoice.amount} ${invoice.currency}`, severity: "info" } });
    return NextResponse.json({ invoice });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
