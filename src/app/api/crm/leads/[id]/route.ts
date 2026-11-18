// Shared path: serves both the ALO admin console and the MarketingOS dashboard.
// MarketingOS requests carry `Authorization: Bearer <JWT>`; everything else is the
// ALO console (next-auth session, enforced by middleware). See src/lib/route-dispatch.ts.
import type { NextRequest } from "next/server";
import { isMarketingOsRequest } from "@/lib/route-dispatch";
import * as alo from "./alo-handlers";
import * as marketingos from "./marketingos-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return isMarketingOsRequest(request) ? marketingos.GET(request, context) : alo.GET(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  return isMarketingOsRequest(request) ? marketingos.PATCH(request, context) : alo.PATCH(request, context);
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  return isMarketingOsRequest(request) ? marketingos.DELETE(request, context) : alo.DELETE(request, context);
}
