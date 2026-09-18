import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async (request, { params, user }) => {
  try {
    const { id } = await params;
    const message = await db.message.findUnique({
      where: { id },
      include: {
        sender: { select: { id: true, name: true, email: true, avatar: true } },
        recipients: {
          include: {
            user: { select: { id: true, name: true, email: true, avatar: true } },
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Only allow if sender or recipient
    const isSender = message.senderId === user.userId;
    const isRecipient = message.recipients.some((r) => r.userId === user.userId);
    if (!isSender && !isRecipient) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Mark as read if recipient
    if (isRecipient) {
      const myRecipient = message.recipients.find((r) => r.userId === user.userId);
      if (myRecipient && !myRecipient.isRead) {
        await db.messageRecipient.update({
          where: { id: myRecipient.id },
          data: { isRead: true, readAt: new Date() },
        });
      }
    }

    return NextResponse.json({ data: message });
  } catch (error) {
    console.error("Message GET by id error:", error);
    return NextResponse.json({ error: "Failed to fetch message" }, { status: 500 });
  }
});
