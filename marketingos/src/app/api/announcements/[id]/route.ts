import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const PUT = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.announcement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = sanitizeInput(body.title);
    if (body.content !== undefined) data.content = sanitizeInput(body.content);
    if (body.priority !== undefined) data.priority = sanitizeInput(body.priority);
    if (body.targetRoles !== undefined) data.targetRoles = sanitizeInput(body.targetRoles);
    if (body.isActive !== undefined) data.isActive = body.isActive;

    const announcement = await db.announcement.update({
      where: { id },
      data,
      include: { institution: { select: { id: true, name: true, shortName: true } } },
    });

    await createAuditLog({
      userId: user.userId,
      action: "update",
      resource: "announcement",
      resourceId: id,
      details: data,
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: announcement });
  } catch (error) {
    console.error("Announcement PUT error:", error);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}, { minRole: "admin" });

export const DELETE = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const existing = await db.announcement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    await db.announcement.delete({ where: { id } });

    await createAuditLog({
      userId: user.userId,
      action: "delete",
      resource: "announcement",
      resourceId: id,
      details: { title: existing.title },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: { message: "Announcement deleted successfully" } });
  } catch (error) {
    console.error("Announcement DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}, { minRole: "admin" });
