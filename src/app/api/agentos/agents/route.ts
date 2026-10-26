import { NextResponse } from "next/server";
import { AGENT_CATALOG, AGENT_ROLES } from "@/lib/agentos-catalog";
import { DEPARTMENTS } from "@/lib/departments";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
  const department = url.searchParams.get("department");
  const status = url.searchParams.get("status");
  const filtered = AGENT_CATALOG.filter((agent) =>
    (!department || agent.department_id === department || agent.department_name.toLowerCase() === department.toLowerCase()) &&
    (!status || agent.status === status),
  );
  return NextResponse.json({
    total: filtered.length,
    offset,
    limit,
    departments: DEPARTMENTS.length,
    roles_per_department: AGENT_ROLES.length,
    items: filtered.slice(offset, offset + limit),
    catalog_only: true,
  }, { headers: { "Cache-Control": "no-store" } });
}
