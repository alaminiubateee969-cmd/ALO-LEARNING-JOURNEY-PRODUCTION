import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

// Non-admin leave view — returns only the current user's leave records.
// This module is part of the education platform and is not active in the CRM.

export const GET = withAuth(async () => {
  return NextResponse.json({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
});

export const POST = withAuth(async () => {
  return NextResponse.json({ error: "This module is not available in the CRM" }, { status: 404 });
});
