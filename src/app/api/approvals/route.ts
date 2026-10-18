import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const items = await db.approvalItem.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const { id, action, note } = await req.json().catch(() => ({
    id: "",
    action: "approve",
    note: "",
  }));
  const item = await db.approvalItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "revised";
  await db.approvalItem.update({
    where: { id },
    data: { status: newStatus, reviewerNote: note ?? "", reviewedAt: new Date() },
  });

  // If approved and it's content, create a publishing job
  if (newStatus === "approved" && item.type === "content") {
    await db.publishedPost.create({
      data: {
        platform: "facebook",
        topic: item.topic,
        status: "queued",
      },
    });
  }

  await db.auditLog.create({
    data: {
      actor: "admin",
      action: `approval.${action}`,
      detail: `Item ${id} → ${newStatus}`,
      severity: "info",
    },
  });
  await db.notification.create({
    data: {
      title: `অনুমোদন আপডেট`,
      body: `${item.title} → ${newStatus}`,
      kind: newStatus === "approved" ? "success" : newStatus === "rejected" ? "danger" : "info",
    },
  });
  return NextResponse.json({ id, status: newStatus });
}
