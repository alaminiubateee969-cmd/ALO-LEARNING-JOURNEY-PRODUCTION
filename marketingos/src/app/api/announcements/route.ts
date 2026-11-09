import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async () => {
  try {
    const announcements = await db.announcement.findMany({
      include: {
        institution: { select: { id: true, name: true, shortName: true } },
      },
      orderBy: [
        { isActive: "desc" },
        { createdAt: "desc" },
      ],
    });

    // Resolve creator names
    const creatorIds = [...new Set(announcements.map((a) => a.createdBy).filter(Boolean))] as string[];
    let creators: Record<string, { id: string; name: string; email: string }> = {};
    if (creatorIds.length > 0) {
      const creatorUsers = await db.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true, email: true },
      });
      creators = Object.fromEntries(creatorUsers.map((u) => [u.id, u]));
    }

    const data = announcements.map((a) => ({
      ...a,
      creator: a.createdBy ? creators[a.createdBy] || null : null,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Announcements GET error:", error);
    return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 });
  }
}, { minRole: "teacher" });

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const title = sanitizeInput(body.title);
    const content = sanitizeInput(body.content);
    const priority = sanitizeInput(body.priority || "normal");
    const targetRoles = sanitizeInput(body.targetRoles || "all");
    const institutionId = body.institutionId;

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    if (!institutionId) {
      return NextResponse.json({ error: "Institution ID is required" }, { status: 400 });
    }

    const announcement = await db.announcement.create({
      data: {
        title,
        content,
        priority,
        targetRoles,
        institutionId,
        createdBy: user.userId,
      },
      include: {
        institution: { select: { id: true, name: true, shortName: true } },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "announcement",
      resourceId: announcement.id,
      details: { title, priority, targetRoles },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: announcement }, { status: 201 });
  } catch (error) {
    console.error("Announcements POST error:", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}, { minRole: "admin" });
