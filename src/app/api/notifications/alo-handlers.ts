import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const notifications = await db.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const unread = notifications.filter((n) => !n.read).length;
  return NextResponse.json({ notifications, unread });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const { action, id } = await req.json().catch(() => ({ action: "mark_all", id: null }));

  if (action === "mark_all") {
    await db.notification.updateMany({
      where: { read: false },
      data: { read: true },
    });
    await db.auditLog.create({
      data: { actor: "admin", action: "notifications.mark_all_read", detail: "Marked all notifications as read", severity: "info" },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "mark_one" && id) {
    await db.notification.update({ where: { id }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }

  if (action === "clear_all") {
    await db.notification.deleteMany({});
    await db.auditLog.create({
      data: { actor: "admin", action: "notifications.clear_all", detail: "Cleared all notifications", severity: "info" },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
