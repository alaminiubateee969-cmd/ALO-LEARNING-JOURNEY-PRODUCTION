import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const packages = await db.contentPackage.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ packages });
}
