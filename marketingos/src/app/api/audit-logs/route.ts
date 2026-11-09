import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-middleware";

// GET /api/audit-logs — Paginated audit logs (admin only)
export const GET = withAuth(
  async (request) => {
    try {
      const { searchParams } = new URL(request.url);

      const userId = searchParams.get("userId") || "";
      const action = searchParams.get("action") || "";
      const resource = searchParams.get("resource") || "";
      const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
      const limit = Math.min(
        200,
        Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
      );
      const skip = (page - 1) * limit;

      const where: Record<string, unknown> = {};

      if (userId) where.userId = userId;
      if (action) where.action = action;
      if (resource) where.resource = resource;

      const [logs, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip,
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, role: true },
            },
          },
        }),
        db.auditLog.count({ where }),
      ]);

      return NextResponse.json({
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error("Error listing audit logs:", error);
      return NextResponse.json(
        { error: "Failed to list audit logs" },
        { status: 500 }
      );
    }
  },
  { minRole: "admin" }
);
