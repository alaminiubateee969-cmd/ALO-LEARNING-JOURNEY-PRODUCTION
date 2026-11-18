// Shared path: serves both the ALO admin console and the MarketingOS dashboard.
// MarketingOS requests carry `Authorization: Bearer <JWT>`; everything else is the
// ALO console (next-auth session, enforced by middleware). See src/lib/route-dispatch.ts.
import type { NextRequest } from "next/server";
import { isMarketingOsRequest, methodNotAllowed } from "@/lib/route-dispatch";
import * as alo from "./alo-handlers";
import * as marketingos from "./marketingos-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return isMarketingOsRequest(request) ? marketingos.GET(request) : alo.GET();
}

export async function POST(request: NextRequest) {
  return isMarketingOsRequest(request) ? methodNotAllowed(["GET"]) : alo.POST(request);
}
