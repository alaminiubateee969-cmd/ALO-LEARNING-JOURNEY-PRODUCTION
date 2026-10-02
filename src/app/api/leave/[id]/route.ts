import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";

export const GET = withAuth(async () => {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
});

export const PATCH = withAuth(async () => {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
});

export const DELETE = withAuth(async () => {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
});
