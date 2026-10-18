import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["new", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const MAX_TEXT = 1000;

function cleanText(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, max);
  return clean || null;
}

function unauthorized(error: unknown) {
  const statusCode = typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode: unknown }).statusCode)
    : 401;
  const status = statusCode === 503 ? 503 : 401;
  return NextResponse.json(
    { error: status === 503 ? "administrator_auth_not_configured" : "unauthorized" },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function requireAdmin() {
  try {
    return { owner: await requireOwner() } as const;
  } catch (error) {
    return { response: unauthorized(error) } as const;
  }
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const url = new URL(request.url);
  const requestedStatus = url.searchParams.get("status");
  if (requestedStatus && !STATUSES.includes(requestedStatus as (typeof STATUSES)[number])) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  try {
    const leads = await db.marketingLead.findMany({
      where: {
        ...(requestedStatus ? { status: requestedStatus } : {}),
        ...(search ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            { company: { contains: search } },
          ],
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const stats = {
      total: leads.length,
      new: leads.filter((lead) => lead.status === "new").length,
      qualified: leads.filter((lead) => lead.status === "qualified").length,
      won: leads.filter((lead) => lead.status === "won").length,
      lost: leads.filter((lead) => lead.status === "lost").length,
    };
    return NextResponse.json({ leads, stats }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "marketing_leads_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.action === "create") {
    const name = cleanText(body.name, 160);
    const email = cleanText(body.email, 254)?.toLowerCase() ?? null;
    const phone = cleanText(body.phone, 40);
    if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
    if (!email && !phone) return NextResponse.json({ error: "email_or_phone_required" }, { status: 400 });
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    }
    try {
      const lead = await db.$transaction(async (tx) => {
        const created = await tx.marketingLead.create({
          data: {
            name,
            email,
            phone,
            company: cleanText(body.company, 160),
            source: cleanText(body.source, 80) ?? "website",
            service: cleanText(body.service, 80),
            budget: cleanText(body.budget, 80),
            status: "new",
            notes: cleanText(body.notes, 4000),
          },
        });
        await tx.auditLog.create({
          data: { actor: auth.owner.ownerId, action: "marketing.lead.created", detail: `Marketing lead ${created.id} created`, severity: "info" },
        });
        return created;
      });
      return NextResponse.json({ lead }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
    } catch {
      return NextResponse.json({ error: "marketing_lead_create_failed" }, { status: 503 });
    }
  }

  if (body.action === "update_status") {
    const id = cleanText(body.id, 191);
    const status = cleanText(body.status, 40);
    if (!id || !status || !STATUSES.includes(status as (typeof STATUSES)[number])) {
      return NextResponse.json({ error: "invalid_lead_update" }, { status: 400 });
    }
    try {
      const lead = await db.$transaction(async (tx) => {
        const updated = await tx.marketingLead.update({
          where: { id },
          data: { status, ...(typeof body.notes === "string" ? { notes: cleanText(body.notes, 4000) } : {}) },
        });
        await tx.auditLog.create({
          data: { actor: auth.owner.ownerId, action: "marketing.lead.updated", detail: `Marketing lead ${id} status changed`, severity: "info" },
        });
        return updated;
      });
      return NextResponse.json({ lead }, { headers: { "Cache-Control": "private, no-store" } });
    } catch {
      return NextResponse.json({ error: "marketing_lead_update_failed" }, { status: 404 });
    }
  }

  if (body.action === "delete") {
    return NextResponse.json(
      { error: "marketing_leads_are_retained", message: "For retention, change the lead status to lost instead of deleting the record." },
      { status: 409 },
    );
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
