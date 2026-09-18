import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";
import { sanitizeInput, createAuditLog, ipFromRequest } from "@/lib/security";

export const GET = withAuth(async (request, { user }) => {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const skip = (page - 1) * limit;

    // Get messages sent by the user
    const sent = await db.message.findMany({
      where: { senderId: user.userId },
      include: {
        sender: { select: { id: true, name: true, email: true, avatar: true } },
        recipients: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get messages received by the user
    const received = await db.messageRecipient.findMany({
      where: { userId: user.userId },
      include: {
        message: {
          include: {
            sender: { select: { id: true, name: true, email: true, avatar: true } },
            recipients: {
              include: {
                user: { select: { id: true, name: true, email: true, avatar: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Combine and deduplicate
    const allMessages = new Map<string, unknown>();
    for (const msg of sent) {
      allMessages.set(msg.id, { ...msg, direction: "sent" });
    }
    for (const rec of received) {
      if (!allMessages.has(rec.messageId)) {
        allMessages.set(rec.messageId, {
          ...rec.message,
          isRead: rec.isRead,
          readAt: rec.readAt,
          direction: "received",
        });
      }
    }

    const sorted = Array.from(allMessages.values()).sort(
      (a, b) => new Date((b as Record<string, unknown>).createdAt as string).getTime() - new Date((a as Record<string, unknown>).createdAt as string).getTime()
    );

    // Paginate after combining
    const paginated = sorted.slice(skip, skip + limit);

    return NextResponse.json({
      data: paginated,
      pagination: {
        page,
        limit,
        total: sorted.length,
        totalPages: Math.ceil(sorted.length / limit),
      },
    });
  } catch (error) {
    console.error("Messages GET error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { user }) => {
  try {
    const body = await request.json();
    const content = sanitizeInput(body.content);
    const recipientIds: string[] = body.recipientIds || [];

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    if (recipientIds.length === 0) {
      return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
    }

    const message = await db.message.create({
      data: {
        content,
        senderId: user.userId,
        recipients: {
          create: recipientIds.map((userId: string) => ({ userId })),
        },
      },
      include: {
        sender: { select: { id: true, name: true, email: true, avatar: true } },
        recipients: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
    });

    await createAuditLog({
      userId: user.userId,
      action: "create",
      resource: "message",
      resourceId: message.id,
      details: { recipientCount: recipientIds.length },
      ipAddress: ipFromRequest(request),
    });

    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error) {
    console.error("Messages POST error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
});
