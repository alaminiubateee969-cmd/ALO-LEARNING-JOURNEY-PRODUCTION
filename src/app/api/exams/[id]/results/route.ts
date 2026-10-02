import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async () => {
  return NextResponse.json({ data: [] });
});
