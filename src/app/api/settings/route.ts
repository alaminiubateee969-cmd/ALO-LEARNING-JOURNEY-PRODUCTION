import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

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
  smtpHost: "",
  smtpPort: "587",
  smtpFrom: "",
  timezone: "Asia/Dhaka",
  language: "bn",
  emergencyStop: false,
  autoApproveLowRisk: false,
  notifyOnSensitive: true,
  notifyOnFailure: true,
  maxJobsPerCron: "10",
  maxHeavyJobsPerCron: "3",
};

export async function GET() {
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
