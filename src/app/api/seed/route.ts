import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

export async function POST() {
  await ensureSeeded();
  // Idempotent: returns counts after ensuring seed
  const [companies, ideas, packages, approvals, connections, ragDocs] = await Promise.all([
    db.company.count(),
    db.contentIdea.count(),
    db.contentPackage.count(),
    db.approvalItem.count(),
    db.socialConnection.count(),
    db.ragDocument.count(),
  ]);
  return NextResponse.json({
    seeded: true,
    counts: { companies, ideas, packages, approvals, connections, ragDocs },
  });
}
