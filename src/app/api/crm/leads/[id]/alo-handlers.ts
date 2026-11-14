import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { updateLeadSchema } from "@/lib/crm-validation";
import { parseJson, resolveCompanyScope, scopeError, validationError } from "@/lib/crm-server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const scope = await resolveCompanyScope(request);
  if (scope.error) return scopeError(scope);
  const { id } = await context.params;

  const lead = await db.lead.findFirst({
    where: { id, companyId: scope.companyId },
    include: {
      company: { select: { name: true, domain: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      quotations: { orderBy: { createdAt: "desc" }, include: { items: { orderBy: { position: "asc" } } } },
    },
  });
  if (!lead) return NextResponse.json({ error: "lead_not_found" }, { status: 404 });
  return NextResponse.json({ lead }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request, context: RouteContext) {
  const scope = await resolveCompanyScope(request);
  if (scope.error) return scopeError(scope);
  const { id } = await context.params;
  const parsedBody = await parseJson(request);
  if ("response" in parsedBody) return parsedBody.response;
  const parsed = updateLeadSchema.safeParse(parsedBody.body);
  if (!parsed.success) return validationError(parsed.error.issues);
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "At least one field is required." }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({ where: { id, companyId: scope.companyId } });
    if (!existing) return { notFound: true as const };

    const nextEmail = parsed.data.email === undefined ? existing.email : parsed.data.email;
    const nextPhone = parsed.data.phone === undefined ? existing.phone : parsed.data.phone;
    if (!nextEmail && !nextPhone) return { missingContact: true as const };

    if (
      parsed.data.consentStatus === "consented" &&
      parsed.data.consentRecordedAt &&
      parsed.data.consentRecordedAt > new Date()
    ) return { futureConsent: true as const };

    const updated = await tx.lead.update({ where: { id }, data: parsed.data });
    if (parsed.data.stage && parsed.data.stage !== existing.stage) {
      await tx.leadActivity.create({
        data: {
          leadId: id,
          type: "stage_change",
          body: `Stage changed from ${existing.stage} to ${parsed.data.stage}.`,
        },
      });
    }
    if (parsed.data.consentStatus && parsed.data.consentStatus !== existing.consentStatus) {
      await tx.leadActivity.create({
        data: { leadId: id, type: "note", body: `Marketing contact preference updated to ${parsed.data.consentStatus}.` },
      });
    }
    await tx.auditLog.create({ data: { actor: "admin", action: "crm.lead.updated", detail: `Updated lead record ${id}`, severity: "info" } });
    return { lead: updated };
  });

  if ("notFound" in result) return NextResponse.json({ error: "lead_not_found" }, { status: 404 });
  if ("missingContact" in result) return NextResponse.json({ error: "At least one email address or phone number must remain on the record." }, { status: 400 });
  if ("futureConsent" in result) return NextResponse.json({ error: "Consent capture date cannot be in the future." }, { status: 400 });
  return NextResponse.json({ lead: result.lead }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request: Request, context: RouteContext) {
  const scope = await resolveCompanyScope(request);
  if (scope.error) return scopeError(scope);
  const { id } = await context.params;

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.lead.findFirst({ where: { id, companyId: scope.companyId }, select: { id: true } });
    if (!existing) return false;
    await tx.auditLog.create({ data: { actor: "admin", action: "crm.lead.deleted", detail: `Deleted lead record ${id}`, severity: "warn" } });
    await tx.lead.delete({ where: { id } });
    return true;
  });

  if (!result) return NextResponse.json({ error: "lead_not_found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
