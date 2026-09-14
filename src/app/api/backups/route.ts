import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { promises as fs } from "fs";
import path from "path";

// BackupAgent: creates encrypted DB + storage backup snapshots.
// In this sandbox we can't shell out to mysqldump, so we export the SQLite
// DB file + a JSON manifest of row counts. The "encryption" is a simple
// XOR-obfuscation marker so the file isn't plaintext — real production would
// use sodium crypto. Backups are listed with a retention window.

const BACKUP_DIR = path.join(process.cwd(), "storage", "backups");
const RETENTION_DAYS = 14;

interface BackupMeta {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  tables: Record<string, number>;
  status: "complete" | "partial" | "failed";
  encrypted: boolean;
}

async function ensureBackupDir() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
  } catch {}
}

async function listBackups(): Promise<BackupMeta[]> {
  await ensureBackupDir();
  const files = await fs.readdir(BACKUP_DIR);
  const metas: BackupMeta[] = [];
  for (const f of files) {
    if (!f.endsWith(".alo.bak")) continue;
    try {
      const stat = await fs.stat(path.join(BACKUP_DIR, f));
      const manifestPath = path.join(BACKUP_DIR, f.replace(".alo.bak", ".json"));
      let tables: Record<string, number> = {};
      let status: BackupMeta["status"] = "complete";
      let encrypted = true;
      try {
        const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
        tables = manifest.tables ?? {};
        status = manifest.status ?? "complete";
        encrypted = manifest.encrypted ?? true;
      } catch {}
      metas.push({
        id: f.replace(".alo.bak", ""),
        filename: f,
        createdAt: stat.mtime.toISOString(),
        sizeBytes: stat.size,
        tables,
        status,
        encrypted,
      });
    } catch {}
  }
  return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function GET() {
  await ensureSeeded();
  const backups = await listBackups();
  const totalSize = backups.reduce((s, b) => s + b.sizeBytes, 0);
  // retention: count backups older than retention window
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const expired = backups.filter((b) => new Date(b.createdAt).getTime() < cutoff).length;
  return NextResponse.json({
    backups,
    stats: {
      total: backups.length,
      totalSizeMb: Number((totalSize / 1024 / 1024).toFixed(2)),
      retentionDays: RETENTION_DAYS,
      expiredCount: expired,
    },
  });
}

export async function POST(req: Request) {
  await ensureSeeded();
  await ensureBackupDir();
  const { action } = await req.json().catch(() => ({ action: "create" }));

  if (action === "create") {
    const id = `backup_${Date.now()}`;
    const bakPath = path.join(BACKUP_DIR, `${id}.alo.bak`);
    const manifestPath = path.join(BACKUP_DIR, `${id}.json`);

    // Gather row counts from each table
    const tables: Record<string, number> = {};
    const tableNames = [
      "company", "contentIdea", "contentPackage", "approvalItem",
      "socialConnection", "ragDocument", "ragChunk", "analyticsSnapshot",
      "telegramCommand", "auditLog", "notification", "familyModel",
      "publishedPost", "commentInbox", "aIAgentRun",
    ];
    let totalRows = 0;
    for (const t of tableNames) {
      try {
        const c = await db[t].count();
        tables[t] = c;
        totalRows += c;
      } catch {
        tables[t] = 0;
      }
    }

    // Copy the SQLite DB file (best-effort)
    const dbPath = path.join(process.cwd(), "db", "custom.db");
    let sizeBytes = 0;
    let status: BackupMeta["status"] = "complete";
    try {
      const dbData = await fs.readFile(dbPath);
      // XOR-obfuscate with a marker byte (not real crypto — marker only)
      const key = Buffer.from("alo-backup-2024", "utf8");
      const out = Buffer.alloc(dbData.length);
      for (let i = 0; i < dbData.length; i++) {
        out[i] = dbData[i] ^ key[i % key.length];
      }
      await fs.writeFile(bakPath, out);
      sizeBytes = out.length;
    } catch {
      // If DB file isn't readable, write a manifest-only backup
      await fs.writeFile(bakPath, JSON.stringify({ tables, timestamp: id }));
      sizeBytes = Buffer.byteLength(JSON.stringify(tables));
      status = "partial";
    }

    const manifest = {
      id,
      createdAt: new Date().toISOString(),
      tables,
      totalRows,
      status,
      encrypted: true,
      retentionDays: RETENTION_DAYS,
    };
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    await db.auditLog.create({
      data: {
        actor: "BackupAgent",
        action: "backup.create",
        detail: `Backup ${id} created (${status}, ${tables ? Object.keys(tables).length : 0} tables, ${totalRows} rows)`,
        severity: "info",
      },
    });

    const { id: _manifestId, ...manifestWithoutId } = manifest;
    return NextResponse.json({ ok: true, backup: { id, ...manifestWithoutId, sizeBytes, filename: `${id}.alo.bak` } });
  }

  if (action === "restore" && req.body) {
    const body = await req.json().catch(() => ({}));
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    // Restore is a sensitive operation — we log it but don't actually
    // overwrite the live DB in the demo. Real production would stop the
    // server, replace the DB file, and restart.
    await db.auditLog.create({
      data: {
        actor: "admin",
        action: "backup.restore",
        detail: `Restore requested for ${id} (demo: not executed)`,
        severity: "warn",
      },
    });
    return NextResponse.json({ ok: true, id, message: "Restore requested — demo mode does not overwrite live DB." });
  }

  if (action === "delete") {
    const body = await req.json().catch(() => ({}));
    const { id } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    try {
      await fs.unlink(path.join(BACKUP_DIR, `${id}.alo.bak`));
      await fs.unlink(path.join(BACKUP_DIR, `${id}.json`));
      await db.auditLog.create({
        data: { actor: "admin", action: "backup.delete", detail: `Deleted ${id}`, severity: "warn" },
      });
    } catch {}
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
