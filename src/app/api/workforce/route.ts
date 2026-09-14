import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { DEPARTMENTS, DEPARTMENT_FAMILIES, LOOP_PHASES } from "@/lib/departments";
import { AGENTS } from "@/lib/agents";

// Ensures the 100 departments are seeded (idempotent by name)
async function ensureDepartments() {
  const count = await db.department.count();
  if (count >= 100) return;
  // Clear and reseed (safe on first run)
  for (const d of DEPARTMENTS) {
    const existing = await db.department.findFirst({ where: { name: d.name } });
    if (!existing) {
      await db.department.create({
        data: {
          name: d.name,
          family: d.family,
          description: d.description,
          agentCount: d.agentCount,
          active: true,
        },
      });
    }
  }
}

export async function GET() {
  await ensureSeeded();
  await ensureDepartments();

  const departments = await db.department.findMany({ orderBy: { family: "asc" } });
  const employees = await db.agentEmployee.count();
  const loopCycles = await db.loopCycle.findMany({ orderBy: { startedAt: "desc" }, take: 10 });

  // Aggregate by family
  const byFamily: Record<string, { count: number; agents: number }> = {};
  for (const d of departments) {
    if (!byFamily[d.family]) byFamily[d.family] = { count: 0, agents: 0 };
    byFamily[d.family].count++;
    byFamily[d.family].agents += d.agentCount;
  }

  const totalAgents = departments.reduce((s, d) => s + d.agentCount, 0);
  const totalDepartments = departments.length;

  // Active loop cycle (most recent running one, or null)
  const activeCycle = loopCycles.find((c) => c.status === "running") ?? null;

  return NextResponse.json({
    stats: {
      totalDepartments,
      totalAgents,
      totalEmployees: employees,
      activeCycles: loopCycles.filter((c) => c.status === "running").length,
      completedCycles: loopCycles.filter((c) => c.status === "completed").length,
      failedCycles: loopCycles.filter((c) => c.status === "failed").length,
    },
    departments,
    byFamily,
    families: DEPARTMENT_FAMILIES,
    loopPhases: LOOP_PHASES,
    loopCycles,
    activeCycle,
    // Also include the 40 core agents from the static roster
    coreAgents: AGENTS.length,
  });
}
