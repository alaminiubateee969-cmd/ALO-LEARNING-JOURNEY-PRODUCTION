import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { LEAD_STAGES } from "@/lib/crm-constants";
import { createLeadSchema } from "@/lib/crm-validation";
import { parseJson, resolveCompanyScope, scopeError, validationError } from "@/lib/crm-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const scope = await resolveCompanyScope(request);
  if (scope.error) return scopeError(scope);

  const url = new URL(request.url);
  const search = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const requestedStage = url.searchParams.get("stage");
  if (requestedStage && !LEAD_STAGES.includes(requestedStage as (typeof LEAD_STAGES)[number])) {
    return NextResponse.json({ error: "invalid_lead_stage" }, { status: 400 });
  }
  const stage = requestedStage ?? undefined;
  const dueOnly = url.searchParams.get("due") === "1";
  const where = {
    companyId: scope.companyId,
    ...(stage ? { stage } : dueOnly ? { stage: { notIn: ["enrolled", "lost"] } } : {}),
    ...(dueOnly ? { nextFollowUp: { lte: new Date() } } : {}),
    ...(search ? {
      OR: [
        { fullName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { courseInterest: { contains: search } },
        { targetCountry: { contains: search } },
      ],
    } : {}),
  };

  const [leads, total, newCount, dueCount, quoteCount] = await Promise.all([
    db.lead.findMany({
      where,
      orderBy: [{ nextFollowUp: "asc" }, { updatedAt: "desc" }],
      take: 250,
      include: { _count: { select: { activities: true, quotations: true } } },
    }),
    db.lead.count({ where: { companyId: scope.companyId } }),
    db.lead.count({ where: { companyId: scope.companyId, stage: "new" } }),
    db.lead.count({ where: { companyId: scope.companyId, nextFollowUp: { lte: new Date() }, stage: { notIn: ["enrolled", "lost"] } } }),
    db.quotation.count({ where: { lead: { companyId: scope.companyId }, status: { in: ["draft", "sent"] } } }),
  ]);

  return NextResponse.json(
    { leads, stats: { total, new: newCount, followUpsDue: dueCount, openQuotations: quoteCount } },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const scope = await resolveCompanyScope(request);
  if (scope.error) return scopeError(scope);

  const parsedBody = await parseJson(request);
  if ("response" in parsedBody) return parsedBody.response;
  const parsed = createLeadSchema.safeParse(parsedBody.body);
  if (!parsed.success) return validationError(parsed.error.issues);
  if (parsed.data.consentStatus === "consented" && parsed.data.consentRecordedAt && parsed.data.consentRecordedAt > new Date()) {
    return NextResponse.json({ error: "Consent capture date cannot be in the future." }, { status: 400 });
  }

  const lead = await db.$transaction(async (tx) => {
    const created = await tx.lead.create({ data: { ...parsed.data, company: { connect: { id: scope.companyId } } } });
    await tx.leadActivity.create({ data: { leadId: created.id, type: "created", body: "Enquiry record created." } });
    await tx.auditLog.create({ data: { actor: "admin", action: "crm.lead.created", detail: `Created lead record ${created.id}`, severity: "info" } });
    return created;
  });

  return NextResponse.json({ lead }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
