import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { FAMILY_CHARACTERS } from "@/lib/platforms";

export async function GET() {
  await ensureSeeded();
  const models = await db.familyModel.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ models, characters: FAMILY_CHARACTERS });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const { characterName, personType, consentConfirmed } = await req.json().catch(() => ({
    characterName: "",
    personType: "user_owned",
    consentConfirmed: false,
  }));
  if (!consentConfirmed) {
    return NextResponse.json(
      { error: "Consent must be confirmed before creating a character." },
      { status: 400 }
    );
  }
  const model = await db.familyModel.create({
    data: {
      characterName,
      personType,
      consentConfirmed: true,
      consentDate: new Date(),
      referenceImages: JSON.stringify([]),
      active: true,
    },
  });
  await db.auditLog.create({
    data: {
      actor: "admin",
      action: "family.create",
      detail: `Character "${characterName}" created with consent`,
      severity: "info",
    },
  });
  return NextResponse.json({ model });
}
