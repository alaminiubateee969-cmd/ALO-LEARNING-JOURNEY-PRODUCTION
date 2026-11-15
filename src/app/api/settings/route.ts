import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { requireOwner } from "@/lib/auth";

// Brand + system settings. Stored in the Company model + a Settings-like
// fallback using in-memory defaults when DB rows don't exist yet.
const DEFAULTS = {
  brandName: "আলো Learning Journey",
  brandNameBn: "আলো",
  tagline: "শিশুদের শিক্ষা ও প্যারেন্টিং নিয়ে সচেতনতা ✨",
  primaryColor: "#f59e0b",
  secondaryColor: "#ec4899",
  accentColor: "#10b981",
  domain: "learn.aloeducation.com",
  smtpHost: process.env.SMTP_HOST || "learn.aloeducation.com",
  smtpPort: process.env.SMTP_PORT || "465",
  smtpFrom: process.env.SMTP_FROM || "ALO Learning Journey <info@learn.aloeducation.com>",
  timezone: "Asia/Dhaka",
  language: "bn",
  emergencyStop: false,
  autoApproveLowRisk: false,
  notifyOnSensitive: true,
  notifyOnFailure: true,
  maxJobsPerCron: "10",
  maxHeavyJobsPerCron: "3",
};

/**
 * Brand + system settings belong to the ALO administrator console.
 *
 * The request gateway (`src/proxy.ts`) authenticates *either* an admin session
 * or a MarketingOS bearer token before any `/api/` route handler runs. That is
 * authentication only, so a valid MarketingOS token would otherwise reach this
 * single-tenant route and rebrand the whole site. Require the admin session
 * here as well. MarketingOS tenants use `/api/settings/company`,
 * `/api/settings/api-keys`, etc., which scope every query by the `companyId`
 * carried in their token.
 */
async function requireAdminSession() {
  try {
    await requireOwner();
    return null;
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    return NextResponse.json(
      { error: status === 401 ? "unauthorized" : "authentication_not_configured" },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET() {
  const denied = await requireAdminSession();
  if (denied) return denied;
  await ensureSeeded();
  // In a real app these would come from a Settings table; here we return
  // defaults merged with any company-level overrides.
  const company = await db.company.findFirst({ orderBy: { createdAt: "asc" } });
  const settings = {
    ...DEFAULTS,
    brandName: company?.name ? `${company.name} Learning Journey` : DEFAULTS.brandName,
    domain: company?.domain ?? DEFAULTS.domain,
  };
  return NextResponse.json({ settings });
}

export async function POST(req: Request) {
  const denied = await requireAdminSession();
  if (denied) return denied;
  await ensureSeeded();
  const body = await req.json().catch(() => ({}));

  // Persist brand-level fields to the first company (demo single-tenant).
  if (body.brandName || body.domain) {
    const company = await db.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (company) {
      await db.company.update({
        where: { id: company.id },
        data: {
          name: body.brandName ? body.brandName.replace(" Learning Journey", "") : company.name,
          domain: body.domain ?? company.domain,
        },
      });
    }
  }

  await db.auditLog.create({
    data: {
      actor: "admin",
      action: "settings.update",
      detail: `Updated settings: ${Object.keys(body).join(", ")}`,
      severity: "info",
    },
  });

  return NextResponse.json({ ok: true, settings: { ...DEFAULTS, ...body } });
}
