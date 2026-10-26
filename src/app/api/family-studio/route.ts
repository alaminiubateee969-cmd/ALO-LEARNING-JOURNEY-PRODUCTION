import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { promises as fs } from "fs";
import path from "path";
import { getFamilyUploadDir } from "@/lib/storage-paths";
import { BodyTooLargeError, readLimitedStream } from "@/lib/read-limited-stream.mjs";

const UPLOAD_DIR = getFamilyUploadDir();
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_BATCH_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BATCH_BYTES + 256 * 1024;
const MAX_UPLOAD_FILES = 10;

class InvalidMultipartBodyError extends Error {
  constructor() {
    super("invalid_multipart_form");
    this.name = "InvalidMultipartBodyError";
  }
}

async function parseLimitedMultipartFormData(req: Request): Promise<FormData> {
  const contentLengthHeader = req.headers.get("content-length")?.trim() ?? "";
  if (/^\d+$/.test(contentLengthHeader) && Number(contentLengthHeader) > MAX_UPLOAD_REQUEST_BYTES) {
    throw new BodyTooLargeError();
  }

  const body = await readLimitedStream(req.body, MAX_UPLOAD_REQUEST_BYTES);
  const requestBody = new ArrayBuffer(body.byteLength);
  new Uint8Array(requestBody).set(body);
  try {
    const boundedRequest = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: requestBody,
    });
    return await boundedRequest.formData();
  } catch {
    throw new InvalidMultipartBodyError();
  }
}

function detectFamilyUpload(buffer: Buffer, assetType: string): { mimeType: string; extension: string } | null {
  const bytes = buffer;
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isWebp = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const isMp4 = bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp";
  const isWebm = bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const isWav = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WAVE";
  const isOgg = bytes.length >= 4 && bytes.toString("ascii", 0, 4) === "OggS";
  const isFlac = bytes.length >= 4 && bytes.toString("ascii", 0, 4) === "fLaC";
  const isMp3 = bytes.length >= 3 && (
    bytes.toString("ascii", 0, 3) === "ID3" ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  );

  if (assetType === "photo") {
    if (isJpeg) return { mimeType: "image/jpeg", extension: "jpg" };
    if (isPng) return { mimeType: "image/png", extension: "png" };
    if (isWebp) return { mimeType: "image/webp", extension: "webp" };
  }
  if (assetType === "video") {
    if (isMp4) return { mimeType: "video/mp4", extension: "mp4" };
    if (isWebm) return { mimeType: "video/webm", extension: "webm" };
  }
  if (assetType === "voice") {
    if (isWav) return { mimeType: "audio/wav", extension: "wav" };
    if (isOgg) return { mimeType: "audio/ogg", extension: "ogg" };
    if (isFlac) return { mimeType: "audio/flac", extension: "flac" };
    if (isMp3) return { mimeType: "audio/mpeg", extension: "mp3" };
    if (isWebm) return { mimeType: "audio/webm", extension: "webm" };
    if (isMp4) return { mimeType: "audio/mp4", extension: "m4a" };
  }
  return null;
}

function formText(formData: FormData, name: string, maxLength = 160): string | null {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}

function resolveFamilyAssetPath(filePath: string): string | null {
  const match = /^\/storage\/uploads\/family\/([a-zA-Z0-9_-]{1,128})\/([a-zA-Z0-9_.-]{1,180})$/.exec(filePath);
  if (!match || match[2] === "." || match[2] === "..") return null;
  const resolved = path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, match[1], match[2]);
  const relative = path.relative(UPLOAD_DIR, resolved);
  return relative.startsWith("..") || path.isAbsolute(relative) ? null : resolved;
}

async function ensureUploadDir(profileId: string) {
  const dir = path.join(UPLOAD_DIR, profileId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
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

  // Handle multipart file upload (single or batch). Enforce the ceiling while
  // reading the stream so a missing or false Content-Length cannot bypass it.
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const writtenPaths: string[] = [];
    try {
      const formData = await parseLimitedMultipartFormData(req);
      const profileId = formText(formData, "profileId", 128);
      const assetType = formText(formData, "assetType", 20) ?? "photo";
      if (!profileId || !/^[a-zA-Z0-9_-]{1,128}$/.test(profileId)) {
        return NextResponse.json({ error: "invalid_profile_id" }, { status: 400 });
      }
      if (!["photo", "video", "voice"].includes(assetType)) {
        return NextResponse.json({ error: "invalid_asset_type" }, { status: 400 });
      }

      const profile = await db.familyProfile.findUnique({ where: { id: profileId } });
      if (!profile || !profile.active) return NextResponse.json({ error: "profile_not_found_or_inactive" }, { status: 404 });
      if (!profile.consentConfirmed) {
        return NextResponse.json({ error: "Profile consent not confirmed", status: "BLOCKED" }, { status: 403 });
      }
      if ((assetType === "photo" || assetType === "video") && !profile.faceConsent) {
        return NextResponse.json({ error: "Face consent required for image or video upload", status: "BLOCKED" }, { status: 403 });
      }
      if (assetType === "voice" && !profile.voiceConsent) {
        return NextResponse.json({ error: "Voice consent required for audio upload", status: "BLOCKED" }, { status: 403 });
      }

      const entries = formData.getAll("files").filter((entry): entry is File => typeof entry !== "string");
      if (entries.length === 0 || entries.length > MAX_UPLOAD_FILES) {
        return NextResponse.json({ error: `upload_must_contain_1_to_${MAX_UPLOAD_FILES}_files` }, { status: 400 });
      }

      const uploads: Array<{ originalName: string; buffer: Buffer; mimeType: string; extension: string }> = [];
      let totalBytes = 0;
      for (const file of entries) {
        if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE_BYTES) {
          return NextResponse.json({ error: "each_file_must_be_between_1_byte_and_10_mib" }, { status: 413 });
        }
        totalBytes += file.size;
        if (totalBytes > MAX_UPLOAD_BATCH_BYTES) {
          return NextResponse.json({ error: "upload_batch_too_large" }, { status: 413 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const detected = detectFamilyUpload(buffer, assetType);
        if (!detected) {
          return NextResponse.json({ error: "unsupported_or_mismatched_file_content" }, { status: 415 });
        }
        uploads.push({
          originalName: file.name.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f]/g, "").slice(0, 160),
          buffer,
          ...detected,
        });
      }

      const dir = await ensureUploadDir(profileId);
      for (const upload of uploads) {
        const fileName = `${randomUUID()}.${upload.extension}`;
        const diskPath = path.join(/*turbopackIgnore: true*/ dir, fileName);
        await fs.writeFile(diskPath, upload.buffer, { flag: "wx", mode: 0o600 });
        writtenPaths.push(diskPath);
      }

      const angleType = formText(formData, "angleType");
      const context = formText(formData, "context");
      const expression = formText(formData, "expression");
      const lighting = formText(formData, "lighting");
      const clothing = formText(formData, "clothing");
      const created = await db.$transaction(async (tx) => {
        const assets: Array<Awaited<ReturnType<typeof tx.familyReferenceAsset.create>>> = [];
        for (let index = 0; index < uploads.length; index++) {
          const upload = uploads[index];
          const fileName = path.basename(writtenPaths[index]);
          const asset = await tx.familyReferenceAsset.create({
            data: {
              profileId,
              assetType,
              angleType,
              context,
              expression,
              lighting,
              clothing,
              filePath: `/storage/uploads/family/${profileId}/${fileName}`,
              fileName: upload.originalName || fileName,
              fileSize: upload.buffer.length,
              mimeType: upload.mimeType,
              qualityScore: 0, // not evaluated; no quality/duplicate detector is configured
              isDuplicate: false,
              approved: false,
            },
          });
          assets.push(asset);
        }
        await tx.auditLog.create({
          data: {
            actor: "admin",
            action: "family_asset.batch_upload",
            detail: `Uploaded ${assets.length} ${assetType} asset(s) to profile ${profileId}`,
            severity: "info",
          },
        });
        return assets;
      });

      return NextResponse.json({ uploaded: created.length, assets: created });
    } catch (error) {
      await Promise.all(writtenPaths.map((filePath) => fs.unlink(filePath).catch(() => undefined)));
      if (error instanceof BodyTooLargeError) {
        return NextResponse.json({ error: "upload_batch_too_large" }, { status: 413 });
      }
      if (error instanceof InvalidMultipartBodyError) {
        return NextResponse.json({ error: "invalid_multipart_form" }, { status: 400 });
      }
      return NextResponse.json({ error: "upload_failed" }, { status: 500 });
    }
  }

  // Handle JSON actions
  const body = await req.json().catch(() => ({}));

  if (body.action === "create") {
    const personName = typeof body.personName === "string" ? body.personName.trim() : "";
    const guardianName = typeof body.guardianName === "string" ? body.guardianName.trim() : "";
    if (!personName || personName.length > 120 || !["me", "wife", "child"].includes(body.personType)) {
      return NextResponse.json({ error: "valid personName and personType are required" }, { status: 400 });
    }
    if (body.consentConfirmed !== true) {
      return NextResponse.json(
        { error: "Consent must be confirmed before creating a profile.", status: "BLOCKED" },
        { status: 400 }
      );
    }
    if (body.personType === "child" && !guardianName) {
      return NextResponse.json(
        { error: "Guardian name required for child profiles.", status: "BLOCKED" },
        { status: 400 }
      );
    }
    if (guardianName.length > 120 || typeof body.faceConsent !== "boolean" || typeof body.voiceConsent !== "boolean") {
      return NextResponse.json({ error: "invalid_consent_metadata" }, { status: 400 });
    }
    const profile = await db.familyProfile.create({
      data: {
        personName,
        personType: body.personType,
        consentConfirmed: true,
        consentDate: new Date(),
        guardianName: guardianName || null,
        voiceConsent: body.voiceConsent,
        faceConsent: body.faceConsent,
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

  if (body.action === "approve_asset" && typeof body.id === "string") {
    const existing = await db.familyReferenceAsset.findUnique({
      where: { id: body.id },
      include: { profile: true },
    });
    if (!existing) return NextResponse.json({ error: "asset_not_found" }, { status: 404 });
    if (!existing.profile.active || !existing.profile.consentConfirmed) {
      return NextResponse.json({ error: "profile_consent_inactive", status: "BLOCKED" }, { status: 403 });
    }
    if ((existing.assetType === "photo" || existing.assetType === "video") && !existing.profile.faceConsent) {
      return NextResponse.json({ error: "face_consent_inactive", status: "BLOCKED" }, { status: 403 });
    }
    if (existing.assetType === "voice" && !existing.profile.voiceConsent) {
      return NextResponse.json({ error: "voice_consent_inactive", status: "BLOCKED" }, { status: 403 });
    }
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
    const fullPath = asset?.filePath ? resolveFamilyAssetPath(asset.filePath) : null;
    if (fullPath) await fs.unlink(fullPath).catch(() => undefined);
    await db.familyReferenceAsset.delete({ where: { id: body.id } });
    await db.auditLog.create({
      data: { actor: "admin", action: "family_asset.delete", detail: `Deleted asset ${body.id}`, severity: "warn" },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "create_project") {
    // Create draft metadata only; no family-media generation is performed.
    if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.trim().length > 2_000) {
      return NextResponse.json({ error: "prompt must contain 1–2000 characters" }, { status: 400 });
    }
    const rawCastIds = body.castProfileIds ?? [];
    if (!Array.isArray(rawCastIds) || rawCastIds.length > 10 || rawCastIds.some((id) => typeof id !== "string")) {
      return NextResponse.json({ error: "castProfileIds must be an array of at most 10 profile ids" }, { status: 400 });
    }
    const castProfileIds = [...new Set(rawCastIds.map((id: string) => id.trim()).filter(Boolean))];
    for (const pid of castProfileIds) {
      const p = await db.familyProfile.findUnique({ where: { id: pid } });
      if (!p) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
      if (!p.consentConfirmed || !p.active) {
        return NextResponse.json({ error: "profile_consent_not_confirmed_or_inactive", status: "BLOCKED" }, { status: 403 });
      }
    }
    const suppliedTitle = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 1_000) : null;
    const prompt = body.prompt.trim();
    const project = await db.familyProject.create({
      data: {
        title: suppliedTitle || prompt.slice(0, 40) || "Untitled Project",
        description,
        prompt,
        castProfileIds: JSON.stringify(castProfileIds),
        status: "draft",
        currentStage: null,
        profiles: castProfileIds.length > 0 ? { connect: castProfileIds.map((id: string) => ({ id })) } : undefined,
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
    for (const asset of assets) {
      const fullPath = resolveFamilyAssetPath(asset.filePath);
      if (fullPath) await fs.unlink(fullPath).catch(() => undefined);
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
