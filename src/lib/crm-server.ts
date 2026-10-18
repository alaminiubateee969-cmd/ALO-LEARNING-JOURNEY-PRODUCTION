import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export type CompanyScope =
  | { companyId: string; error?: never }
  | { companyId?: never; error: string; status: number };

export async function resolveCompanyScope(request: Request): Promise<CompanyScope> {
  try {
    await requireOwner();
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : 401;
    return {
      error: statusCode === 503 ? "Administrator authentication is not configured." : "Sign in is required.",
      status: statusCode === 503 ? 503 : 401,
    };
  }

  await ensureSeeded();
  const requestedId = request.headers.get("x-alo-company-id")?.trim();
  const company = requestedId
    ? await db.company.findFirst({ where: { id: requestedId, active: true }, select: { id: true } })
    : await db.company.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" }, select: { id: true } });

  if (!company && requestedId) {
    return { error: "The selected workspace does not exist or is inactive.", status: 404 };
  }
  if (!company) {
    return { error: "No active workspace is available.", status: 503 };
  }
  return { companyId: company.id };
}

export function scopeError(scope: Extract<CompanyScope, { error: string }>) {
  return NextResponse.json({ error: scope.error }, { status: scope.status, headers: { "Cache-Control": "no-store" } });
}

export function validationError(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return NextResponse.json(
    {
      error: "validation_error",
      details: issues.map((issue) => ({ field: issue.path.map(String).join("."), message: issue.message })),
    },
    { status: 400, headers: { "Cache-Control": "no-store" } }
  );
}

export async function parseJson(request: Request): Promise<{ body: unknown } | { response: NextResponse }> {
  try {
    return { body: await request.json() };
  } catch {
    return { response: NextResponse.json({ error: "invalid_json" }, { status: 400 }) };
  }
}

export function dateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}
