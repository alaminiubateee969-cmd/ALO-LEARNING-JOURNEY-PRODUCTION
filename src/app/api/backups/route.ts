import { NextResponse } from "next/server";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { MODEL_NAMES } from "@/lib/local-db-fallback";
import { ensureSeeded } from "@/lib/seed";
import { getBackupStorageDir } from "@/lib/storage-paths";

const BACKUP_DIR = getBackupStorageDir();
const LOCAL_KEY_FILE = path.join(process.cwd(), "storage", ".backup-key");
const RETENTION_DAYS = 14;
const MAGIC_HEADER = Buffer.from("ALO256GCM1", "utf8"); // 10-byte format magic

interface BackupMeta {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  tables: Record<string, number | null>;
  status: "complete" | "partial" | "failed";
  encrypted: boolean;
  failedModels: string[];
  excludedModels: string[];
}

async function ensureBackupDir() {
  await fs.mkdir(BACKUP_DIR, { recursive: true, mode: 0o700 });
  await fs.chmod(BACKUP_DIR, 0o700);
}

async function getBackupKey(): Promise<Buffer> {
  const dedicatedKey = process.env.BACKUP_ENCRYPTION_KEY?.trim() ?? "";
  if (process.env.NODE_ENV === "production") {
    if (dedicatedKey.length < 32) {
      throw new Error("BACKUP_ENCRYPTION_KEY must be configured with at least 32 characters in production.");
    }
    return scryptSync(dedicatedKey, "alo-backup-aes256gcm-salt", 32);
  }

  const configured = dedicatedKey || process.env.NEXTAUTH_SECRET?.trim() || "";
  if (configured) return scryptSync(configured, "alo-backup-aes256gcm-salt", 32);

  try {
    const existing = (await fs.readFile(LOCAL_KEY_FILE, "utf8")).trim();
    if (existing.length >= 32) return scryptSync(existing, "alo-backup-aes256gcm-salt", 32);
  } catch {}

  await fs.mkdir(path.dirname(LOCAL_KEY_FILE), { recursive: true, mode: 0o700 });
  const generated = randomBytes(32).toString("hex");
  await fs.writeFile(LOCAL_KEY_FILE, generated, { mode: 0o600, flag: "wx" });
  return scryptSync(generated, "alo-backup-aes256gcm-salt", 32);
}

async function encryptPayload(plaintext: Buffer): Promise<Buffer> {
  const key = await getBackupKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([MAGIC_HEADER, iv, authTag, encrypted]);
}

async function verifyEncryptedPayload(blob: Buffer): Promise<boolean> {
  if (blob.length < MAGIC_HEADER.length + 12 + 16) return false;
  if (!blob.subarray(0, MAGIC_HEADER.length).equals(MAGIC_HEADER)) return false;
  const key = await getBackupKey();
  const iv = blob.subarray(MAGIC_HEADER.length, MAGIC_HEADER.length + 12);
  const authTag = blob.subarray(MAGIC_HEADER.length + 12, MAGIC_HEADER.length + 28);
  const ciphertext = blob.subarray(MAGIC_HEADER.length + 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const parsed = JSON.parse(decrypted.toString("utf8")) as Record<string, unknown>;
  return Boolean(
    parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      typeof parsed.schemaModels === "number" &&
      parsed.data &&
      typeof parsed.data === "object" &&
      !Array.isArray(parsed.data),
  );
}

async function listBackups(): Promise<BackupMeta[]> {
  await ensureBackupDir();
  const files = await fs.readdir(BACKUP_DIR);
  const metas: BackupMeta[] = [];
  for (const filename of files) {
    if (!filename.endsWith(".alo.bak")) continue;
    try {
      const stat = await fs.stat(path.join(BACKUP_DIR, filename));
      const manifestPath = path.join(BACKUP_DIR, filename.replace(".alo.bak", ".json"));
      let tables: Record<string, number | null> = {};
      let status: BackupMeta["status"] = "failed";
      let encrypted = false;
      let failedModels: string[] = [];
      let excludedModels: string[] = [];
      try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as Record<string, unknown>;
        if (manifest.tables && typeof manifest.tables === "object" && !Array.isArray(manifest.tables)) {
          tables = Object.fromEntries(
            Object.entries(manifest.tables).map(([name, count]) => [name, typeof count === "number" ? count : null]),
          );
        }
        if (["complete", "partial", "failed"].includes(String(manifest.status))) {
          status = manifest.status as BackupMeta["status"];
        }
        encrypted = manifest.encrypted === true && manifest.cipher === "aes-256-gcm";
        failedModels = Array.isArray(manifest.failedModels)
          ? manifest.failedModels.filter((model): model is string => typeof model === "string")
          : [];
        excludedModels = Array.isArray(manifest.excludedModels)
          ? manifest.excludedModels.filter((model): model is string => typeof model === "string")
          : [];
      } catch {
        // A backup without a readable manifest is not a verified complete backup.
      }
      metas.push({
        id: filename.replace(".alo.bak", ""),
        filename,
        createdAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        tables,
        status,
        encrypted,
        failedModels,
        excludedModels,
      });
    } catch {
      // An unreadable directory entry is omitted rather than presented as valid.
    }
  }
  return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function safeBackupId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  return /^backup_[a-zA-Z0-9_-]{1,64}$/.test(id) ? id : null;
}

export async function GET() {
  await ensureSeeded();
  const backups = await listBackups();
  const totalSize = backups.reduce((s, b) => s + b.sizeBytes, 0);
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const expired = backups.filter((b) => new Date(b.createdAt).getTime() < cutoff).length;
  return NextResponse.json(
    {
      backups,
      stats: {
        total: backups.length,
        totalSizeMb: Number((totalSize / 1024 / 1024).toFixed(2)),
        retentionDays: RETENTION_DAYS,
        expiredCount: expired,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(req: Request) {
  await ensureSeeded();
  await ensureBackupDir();
  const parsedBody = await req.json().catch(() => null) as unknown;
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: "invalid_json_object" }, { status: 400 });
  }
  const body = parsedBody as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "create";

  if (action === "create") {
    if (process.env.NODE_ENV === "production" && (process.env.BACKUP_ENCRYPTION_KEY?.trim().length ?? 0) < 32) {
      return NextResponse.json({ error: "backup_encryption_key_not_configured" }, { status: 503 });
    }

    const id = `backup_${Date.now()}_${randomBytes(16).toString("hex")}`;
    const bakPath = path.join(BACKUP_DIR, `${id}.alo.bak`);
    const manifestPath = path.join(BACKUP_DIR, `${id}.json`);
    const tables: Record<string, number | null> = {};
    const snapshotData: Record<string, unknown[]> = {};
    const failedModels: string[] = [];
    const excludedModels: string[] = ["adminOtpChallenge"];
    let totalRows = 0;

    // This UI snapshot deliberately excludes short-lived OTP challenge rows.
    // It is not a substitute for a mysqldump and cannot restore a live DB.
    for (const model of MODEL_NAMES) {
      if (excludedModels.includes(model)) continue;
      try {
        const delegate = (db as unknown as Record<string, any>)[model];
        const rows = await delegate.findMany();
        tables[model] = rows.length;
        snapshotData[model] = rows;
        totalRows += rows.length;
      } catch {
        tables[model] = null;
        snapshotData[model] = [];
        failedModels.push(model);
      }
    }

    const createdAt = new Date().toISOString();
    const status: BackupMeta["status"] = failedModels.length || excludedModels.length ? "partial" : "complete";
    const payloadBuffer = Buffer.from(
      JSON.stringify({
        id,
        createdAt,
        schemaModels: MODEL_NAMES.length,
        tables,
        totalRows,
        failedModels,
        excludedModels,
        data: snapshotData,
      }),
      "utf8",
    );

    const encryptedBuffer = await encryptPayload(payloadBuffer);
    const manifest = {
      id,
      createdAt,
      tables,
      totalRows,
      failedModels,
      excludedModels,
      status,
      encrypted: true,
      cipher: "aes-256-gcm",
      retentionDays: RETENTION_DAYS,
    };
    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
    try {
      await fs.writeFile(bakPath, encryptedBuffer, { mode: 0o600, flag: "wx" });
      await fs.writeFile(manifestPath, manifestBytes, { mode: 0o600, flag: "wx" });
    } catch (error) {
      await fs.unlink(bakPath).catch(() => undefined);
      await fs.unlink(manifestPath).catch(() => undefined);
      throw error;
    }
    const sizeBytes = encryptedBuffer.byteLength;


    await db.auditLog.create({
      data: {
        actor: "BackupAgent",
        action: "backup.create",
        detail: `Backup ${id} created (${status}, AES-256-GCM, ${Object.keys(tables).length} tables, ${totalRows} rows)`,
        severity: status === "complete" ? "info" : "warn",
      },
    });

    const { id: _manifestId, ...manifestWithoutId } = manifest;
    return NextResponse.json(
      { ok: true, backup: { id, ...manifestWithoutId, sizeBytes, filename: `${id}.alo.bak` } },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (action === "verify" || action === "restore") {
    const id = safeBackupId(body.id);
    if (!id) return NextResponse.json({ error: "valid backup id required" }, { status: 400 });
    const bakPath = path.join(BACKUP_DIR, `${id}.alo.bak`);
    let blob: Buffer;
    try {
      blob = await fs.readFile(bakPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return NextResponse.json({ error: code === "ENOENT" ? "backup_not_found" : "backup_unreadable" }, { status: code === "ENOENT" ? 404 : 500 });
    }

    let verified = false;
    try {
      verified = await verifyEncryptedPayload(blob);
    } catch {
      verified = false;
    }
    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "backup.verify",
        detail: `Integrity check for ${id}: ${verified ? "AES-256-GCM payload valid" : "verification failed"}; no database restore was performed.`,
        severity: verified ? "info" : "warn",
      },
    });
    return NextResponse.json(
      {
        ok: verified,
        id,
        integrityVerified: verified,
        restorePerformed: false,
        message: verified
          ? "AES-256-GCM payload integrity verified. This endpoint does not restore a database."
          : "Backup integrity verification failed. No database restore was performed.",
      },
      { status: verified ? 200 : 422, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (action === "delete") {
    const id = safeBackupId(body.id);
    if (!id) return NextResponse.json({ error: "valid backup id required" }, { status: 400 });
    try {
      await fs.unlink(path.join(BACKUP_DIR, `${id}.alo.bak`));
      await fs.unlink(path.join(BACKUP_DIR, `${id}.json`)).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return NextResponse.json({ error: code === "ENOENT" ? "backup_not_found" : "backup_delete_failed" }, { status: code === "ENOENT" ? 404 : 500 });
    }
    await db.auditLog.create({
      data: { actor: "admin", action: "backup.delete", detail: `Deleted ${id}`, severity: "warn" },
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
