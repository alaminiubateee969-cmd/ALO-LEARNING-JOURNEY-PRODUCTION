import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads", "family");

async function ensureUploadDir(profileId: string) {
  const dir = path.join(UPLOAD_DIR, profileId);
  try { await fs.mkdir(dir, { recursive: true }); } catch {}
  return dir;
}

export async function GET(req: Request) {
  await ensureSeeded();
  const { searchParams } = new URL(req.url);
  const profileId = searchParams.get("profileId");

  if (profileId) {
    // Return a single profile with all its assets
    const profile = await db.familyProfile.findUnique({
      where: { id: profileId },
      include: { referenceAssets: { orderBy: { uploadedAt: "desc" } } },
    });
    if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ profile });
  }

  const profiles = await db.familyProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { referenceAssets: true } } },
  });
  return NextResponse.json({ profiles });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const contentType = req.headers.get("content-type") ?? "";

  // Handle multipart file upload (single or batch)
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await req.formData();
      const profileId = formData.get("profileId") as string;
      const assetType = (formData.get("assetType") as string) || "photo";
      const angleType = (formData.get("angleType") as string) || null;
      const context = (formData.get("context") as string) || null;
      const expression = (formData.get("expression") as string) || null;
      const lighting = (formData.get("lighting") as string) || null;
      const clothing = (formData.get("clothing") as string) || null;

      const profile = await db.familyProfile.findUnique({ where: { id: profileId } });
      if (!profile) return NextResponse.json({ error: "profile not found" }, { status: 404 });
      if (!profile.consentConfirmed) {
        return NextResponse.json({ error: "Profile consent not confirmed", status: "BLOCKED" }, { status: 403 });
      }
      // Check face/voice consent matches asset type
      if (assetType === "photo" && !profile.faceConsent) {
        return NextResponse.json({ error: "Face consent required for photo upload", status: "BLOCKED" }, { status: 403 });
      }
      if (assetType === "video" && !profile.faceConsent) {
        return NextResponse.json({ error: "Face consent required for video upload", status: "BLOCKED" }, { status: 403 });
      }
      if (assetType === "voice" && !profile.voiceConsent) {
        return NextResponse.json({ error: "Voice consent required for voice upload", status: "BLOCKED" }, { status: 403 });
      }

      const dir = await ensureUploadDir(profileId);
      const files = formData.getAll("files");
      const created: Awaited<ReturnType<typeof db.familyReferenceAsset.create>>[] = [];

      for (const fileEntry of files) {
        const file = fileEntry as File;
        if (!file || typeof file === "string") continue;

        const ext = file.name.split(".").pop() || "bin";
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filePath = path.join(dir, fileName);
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        const asset = await db.familyReferenceAsset.create({
          data: {
            profileId,
            assetType,
            angleType,
            context,
            expression,
            lighting,
            clothing,
            filePath: `/storage/uploads/family/${profileId}/${fileName}`,
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            qualityScore: 0.75, // placeholder — real detection needs ML
            isDuplicate: false,
            approved: false,
          },
        });
        created.push(asset);
      }

      await db.auditLog.create({
        data: {
          actor: "admin",
          action: "family_asset.batch_upload",
          detail: `Uploaded ${created.length} ${assetType} asset(s) to profile ${profileId}`,
          severity: "info",
        },
      });

      return NextResponse.json({ uploaded: created.length, assets: created });
    } catch (e) {
      return NextResponse.json({ error: "upload failed", detail: String(e) }, { status: 500 });
    }
  }

  // Handle JSON actions
  const body = await req.json().catch(() => ({}));

  if (body.action === "create") {
    if (!body.consentConfirmed) {
      return NextResponse.json(
        { error: "Consent must be confirmed before creating a profile.", status: "BLOCKED" },
        { status: 400 }
      );
    }
    if (body.personType === "child" && !body.guardianName) {
      return NextResponse.json(
        { error: "Guardian name required for child profiles.", status: "BLOCKED" },
        { status: 400 }
      );
    }
    const profile = await db.familyProfile.create({
      data: {
        personName: body.personName,
        personType: body.personType,
        consentConfirmed: true,
        consentDate: new Date(),
        guardianName: body.guardianName ?? null,
        voiceConsent: body.voiceConsent ?? false,
        faceConsent: body.faceConsent ?? false,
        appearanceJson: body.appearanceJson ?? null,
        voiceSettingsJson: body.voiceSettingsJson ?? null,
        active: true,
      },
    });
    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "family_profile.create",
        detail: `Created ${body.personType} profile "${body.personName}" with consent${body.guardianName ? ` (guardian: ${body.guardianName})` : ""}`,
        severity: "info",
      },
    });
    return NextResponse.json({ profile });
  }

  if (body.action === "approve_asset" && body.id) {
    const asset = await db.familyReferenceAsset.update({
      where: { id: body.id },
      data: { approved: true },
    });
    await db.auditLog.create({
      data: { actor: "admin", action: "family_asset.approve", detail: `Approved asset ${body.id}`, severity: "info" },
    });
    return NextResponse.json({ asset });
  }

  if (body.action === "delete_asset" && body.id) {
    const asset = await db.familyReferenceAsset.findUnique({ where: { id: body.id } });
    if (asset?.filePath) {
      const fullPath = path.join(process.cwd(), asset.filePath.replace(/^\//, ""));
      try { await fs.unlink(fullPath); } catch {}
    }
    await db.familyReferenceAsset.delete({ where: { id: body.id } });
    await db.auditLog.create({
      data: { actor: "admin", action: "family_asset.delete", detail: `Deleted asset ${body.id}`, severity: "warn" },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create_project") {
    // One-click workflow: create a family project from a prompt
    const castProfileIds = body.castProfileIds ?? [];
    // Verify all cast profiles exist and have consent
    for (const pid of castProfileIds) {
      const p = await db.familyProfile.findUnique({ where: { id: pid } });
      if (!p) return NextResponse.json({ error: `Profile ${pid} not found` }, { status: 404 });
      if (!p.consentConfirmed || !p.active) {
        return NextResponse.json({ error: `Profile ${p.personName} consent not confirmed or inactive`, status: "BLOCKED" }, { status: 403 });
      }
    }
    const project = await db.familyProject.create({
      data: {
        title: body.title || body.prompt?.slice(0, 40) || "Untitled Project",
        description: body.description ?? null,
        prompt: body.prompt || "",
        castProfileIds: JSON.stringify(castProfileIds),
        status: "draft",
        currentStage: "creative_director",
      },
      include: { profiles: true },
    });
    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "family_project.create",
        detail: `Created project "${project.title}" with ${castProfileIds.length} cast members`,
        severity: "info",
      },
    });
    return NextResponse.json({ project });
  }

  if (body.action === "revoke_consent" && body.id) {
    const profile = await db.familyProfile.update({
      where: { id: body.id },
      data: { active: false, consentConfirmed: false, faceConsent: false, voiceConsent: false },
    });
    // Un-approve all assets when consent is revoked
    await db.familyReferenceAsset.updateMany({
      where: { profileId: body.id },
      data: { approved: false },
    });
    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "family_profile.consent_revoked",
        detail: `Consent revoked for profile ${body.id} (${profile.personName}) — all assets un-approved`,
        severity: "warn",
      },
    });
    return NextResponse.json({ profile });
  }

  if (body.action === "delete" && body.id) {
    // Delete profile + all assets (GDPR-style right to erasure)
    const assets = await db.familyReferenceAsset.findMany({ where: { profileId: body.id } });
    for (const a of assets) {
      const fullPath = path.join(process.cwd(), a.filePath.replace(/^\//, ""));
      try { await fs.unlink(fullPath); } catch {}
    }
    await db.familyReferenceAsset.deleteMany({ where: { profileId: body.id } });
    await db.familyProfile.delete({ where: { id: body.id } });
    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "family_profile.delete",
        detail: `Deleted profile ${body.id} and ${assets.length} reference assets (files removed)`,
        severity: "warn",
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
