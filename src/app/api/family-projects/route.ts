import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";

// Family projects + media generation pipeline tracking
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
  return NextResponse.json({ projects, generations });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const body = await req.json().catch(() => ({}));

  if (body.action === "start_pipeline" && body.projectId) {
    const project = await db.familyProject.findUnique({ where: { id: body.projectId } });
    if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Update project to running
    await db.familyProject.update({
      where: { id: body.projectId },
      data: { status: "running", currentStage: "creative_director" },
    });

    // Create media generation records for each pipeline stage
    // This is the structured pipeline: Creative Director → Script → Storyboard →
    // Scene → Casting → Identity → Image → Video → Motion → Voice → Lip-Sync →
    // Camera → Lighting → Audio → Editing → Upscaling → Quality Judge → Final Director
    const stages = [
      "creative_director", "script", "storyboard", "scene", "casting",
      "identity", "image", "video", "motion", "voice", "lip_sync",
      "camera", "lighting", "audio", "editing", "upscaling",
      "quality_judge", "final_director"
    ];

    const created: Awaited<ReturnType<typeof db.mediaGeneration.create>>[] = [];
    for (const stage of stages) {
      const gen = await db.mediaGeneration.create({
        data: {
          projectId: body.projectId,
          stage,
          status: "pending",
          maxAttempts: 3,
          provider: "local",
        },
      });
      created.push(gen);
    }

    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "family_project.start_pipeline",
        detail: `Started ${stages.length}-stage pipeline for project "${project.title}"`,
        severity: "info",
      },
    });

    return NextResponse.json({
      projectId: body.projectId,
      stagesCreated: created.length,
      stages,
      message: "Pipeline initialized. Real execution needs worker infrastructure (BLOCKED_EXTERNAL_SETUP for video/voice/lip-sync stages).",
    });
  }

  if (body.action === "update_stage" && body.generationId) {
    const gen = await db.mediaGeneration.update({
      where: { id: body.generationId },
      data: {
        status: body.status ?? "running",
        qualityScore: body.qualityScore ?? 0,
        identityScore: body.identityScore ?? 0,
        issuesJson: body.issues ? JSON.stringify(body.issues) : undefined,
        outputJson: body.output ? JSON.stringify(body.output) : undefined,
      },
    });
    return NextResponse.json({ generation: gen });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
