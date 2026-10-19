import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/family/clone — multipart/form-data: personName, personType, guardianName?, consentConfirmed=true, faceConsent, voiceConsent, photo (image), voiceSample (audio), scriptIdea?
// Creates FamilyProfile + 2 FamilyReferenceAssets (photo front + voice) + optional FamilyProject draft
export async function POST(request: NextRequest) {
  let ownerId: string;
  try {
    ownerId = (await requireOwner()).ownerId;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Use multipart/form-data with photo + voiceSample" }, { status: 400 });
  }

  const form = await request.formData();
  const personName = String(form.get("personName") || "").trim().slice(0, 120);
  const personType = String(form.get("personType") || "me").trim(); // me|wife|child
  const guardianName = String(form.get("guardianName") || "").trim().slice(0, 120);
  const consentConfirmed = String(form.get("consentConfirmed") || "").toLowerCase() === "true";
  const faceConsent = String(form.get("faceConsent") || "").toLowerCase() === "true";
  const voiceConsent = String(form.get("voiceConsent") || "").toLowerCase() === "true";
  const scriptIdea = String(form.get("scriptIdea") || "").trim().slice(0, 2000);

  if (!personName) return NextResponse.json({ error: "personName required" }, { status: 400 });
  if (!["me", "wife", "child"].includes(personType)) return NextResponse.json({ error: "personType must be me|wife|child" }, { status: 400 });
  if (personType === "child" && !guardianName) return NextResponse.json({ error: "guardianName required for child (consent by guardian)" }, { status: 400 });
  if (!consentConfirmed || !faceConsent || !voiceConsent) return NextResponse.json({ error: "consentConfirmed + faceConsent + voiceConsent must be true (written permission required)" }, { status: 400 });

  const photo = form.get("photo");
  const voiceSample = form.get("voiceSample");
  if (!(photo instanceof File) || !(voiceSample instanceof File)) {
    return NextResponse.json({ error: "photo (image) + voiceSample (audio) files required" }, { status: 400 });
  }
  if (!photo.type.startsWith("image/")) return NextResponse.json({ error: "photo must be image/*" }, { status: 400 });
  if (!voiceSample.type.startsWith("audio/") && !voiceSample.type.includes("webm") && !voiceSample.type.includes("ogg")) return NextResponse.json({ error: "voiceSample must be audio/* or webm/ogg from recorder" }, { status: 400 });
  if (photo.size > 10 * 1024 * 1024) return NextResponse.json({ error: "photo ≤10MB" }, { status: 400 });
  if (voiceSample.size > 20 * 1024 * 1024) return NextResponse.json({ error: "voiceSample ≤20MB (~60s)" }, { status: 400 });

  // Persist files to storage/uploads/family
  const uploadDir = path.join(process.cwd(), "storage", "uploads", "family");
  await fs.mkdir(uploadDir, { recursive: true });

  const photoExt = path.extname(photo.name) || ".jpg";
  const voiceExt = path.extname(voiceSample.name) || (voiceSample.type.includes("webm") ? ".webm" : ".wav");
  const base = crypto.randomUUID().slice(0, 8);
  const photoName = `${base}_photo${photoExt}`;
  const voiceName = `${base}_voice${voiceExt}`;
  const photoPath = path.join(uploadDir, photoName);
  const voicePath = path.join(uploadDir, voiceName);

  await fs.writeFile(photoPath, Buffer.from(await photo.arrayBuffer()));
  await fs.writeFile(voicePath, Buffer.from(await voiceSample.arrayBuffer()));

  // Determine MIME quality hint: image sharpness/size
  const photoQuality = photo.size > 500_000 ? 0.9 : 0.6;

  // Create FamilyProfile + assets in transaction
  const profile = await db.familyProfile.create({
    data: {
      personName,
      personType,
      consentConfirmed: true,
      consentDate: new Date(),
      guardianName: guardianName || null,
      voiceConsent: true,
      faceConsent: true,
      appearanceJson: JSON.stringify({ source: "uploaded-photo", fileName: photoName, mimeType: photo.type, size: photo.size }),
      voiceSettingsJson: JSON.stringify({ source: "uploaded-sample", fileName: voiceName, mimeType: voiceSample.type, size: voiceSample.size }),
      active: true,
    },
  });

  const photoAsset = await db.familyReferenceAsset.create({
    data: {
      profileId: profile.id,
      assetType: "photo",
      angleType: "front",
      context: "consent-verified-upload",
      filePath: path.join("storage/uploads/family", photoName),
      fileName: photo.name,
      fileSize: photo.size,
      mimeType: photo.type,
      qualityScore: photoQuality,
      approved: true,
    },
  });

  const voiceAsset = await db.familyReferenceAsset.create({
    data: {
      profileId: profile.id,
      assetType: "voice",
      filePath: path.join("storage/uploads/family", voiceName),
      fileName: voiceSample.name,
      fileSize: voiceSample.size,
      mimeType: voiceSample.type,
      qualityScore: 0.8,
      approved: true,
    },
  });

  // Optional: create FamilyProject draft from script idea → SEO + publish queue stub
  let project: any = null;
  if (scriptIdea) {
    project = await db.familyProject.create({
      data: {
        title: scriptIdea.slice(0, 80),
        prompt: scriptIdea,
        castProfileIds: JSON.stringify([profile.id]),
        status: "draft",
        outputJson: JSON.stringify({ seo: { keywords: [], hashtags: [], cta: "আলো — ভালোবাসা দিয়ে শেখার পথ" }, publishQueue: "scheduled-draft" }),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    profile: { id: profile.id, personName: profile.personName, personType: profile.personType, consentConfirmed: profile.consentConfirmed },
    assets: [photoAsset, voiceAsset].map(a => ({ id: a.id, assetType: a.assetType, filePath: a.filePath, fileSize: a.fileSize })),
    project: project ? { id: project.id, title: project.title, status: project.status } : null,
    nextSteps: {
      generateVideo: `Use Family Studio → profile ${profile.id} → script idea → POST /api/avatar-video with avatarId from mapped HumanAvatar`,
      seo: "Auto-filled via POST /api/content/brief + /api/content/package (Marketing Kits)",
      publishQueue: "Create PublishedPost status=scheduled → Calendar + PublishingQueue will publish when platform tokens connected (Buffer-style)"
    },
    ltxHint: "For LTX-2 sync audio+video, configure COMFYUI_BASE_URL to GPU worker (see deploy/gpu/WORKER_SETUP.md); local fallback uses faceDescription+voice sharing without GPU"
  });
}

export async function GET() {
  return NextResponse.json({
    endpoint: "POST /api/family/clone (multipart/form-data)",
    required: ["personName", "personType=me|wife|child", "photo (image ≤10MB)", "voiceSample (audio ≤20MB)", "consentConfirmed=true, faceConsent=true, voiceConsent=true"],
    optional: ["guardianName (required if child)", "scriptIdea (auto-creates FamilyProject draft)"],
    storage: "storage/uploads/family → FamilyReferenceAsset (photo front + voice)",
    sharing: "faceDescription+voiceProfile+consistencySeed shared across all videos (same-person)",
    guardrail: "No clone without written consent; child needs guardian"
  });
}
