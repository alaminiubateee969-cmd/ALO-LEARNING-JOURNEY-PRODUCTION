import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";

export const POST = withAuth(async (_request, { user }) => {
  try {
    await db.notification.updateMany({
      where: {
        userId: user.userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({ data: { message: "All notifications marked as read" } });
  } catch (error) {
    console.error("Notifications read-all error:", error);
    return NextResponse.json({ error: "Failed to mark all as read" }, { status: 500 });
  }
});
