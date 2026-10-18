import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

// Family-project drafts and historical media-generation records (unverified).
export async function GET() {
  await ensureSeeded();
  const projects = await db.familyProject.findMany({
    orderBy: { createdAt: "desc" },
    include: { profiles: { select: { id: true, personName: true, personType: true } } },
  });
  const generations = await db.mediaGeneration.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({
    projects: projects.map((project) => ({ ...project, executionVerified: false })),
    generations: generations.map((generation) => ({ ...generation, executionVerified: false })),
    pipelineStatus: "not_implemented",
    message: "No identity-aware family-media worker is configured. Persisted stages, scores, and completion labels are not verified by this application.",
  });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({}));

  if ((body.action === "start_pipeline" || body.action === "run_pipeline") && (body.projectId || body.id)) {
    const projectId = String(body.projectId || body.id);
    const project = await db.familyProject.findUnique({ where: { id: projectId } });
    if (!project) return NextResponse.json({ error: "project_not_found" }, { status: 404 });

    // Do not manufacture completed stages, scores, or media outputs. The
    // identity-aware family production pipeline is not implemented yet.
    return NextResponse.json(
      {
        error: "family_media_pipeline_not_implemented",
        status: "unavailable",
        projectId,
        message: "No family-media stages were started or marked complete. General local video rendering is separate and does not consume family profile assets.",
      },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (body.action === "update_stage") {
    return NextResponse.json(
      { error: "media_stage_updates_unavailable", message: "Stage status and quality scores can only be written by a verified media worker; no such family-media worker is configured." },
      { status: 409, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (body.action === "delete" && (body.projectId || body.id)) {
    const projectId = String(body.projectId || body.id);
    await db.mediaGeneration.deleteMany({ where: { projectId } });
    await db.familyProject.delete({ where: { id: projectId } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
