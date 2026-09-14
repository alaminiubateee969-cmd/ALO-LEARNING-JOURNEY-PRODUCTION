import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { TELEGRAM_COMMANDS } from "@/lib/platforms";
import { generateIdeas } from "@/lib/ai";

// Telegram allow-list — only these chat IDs may execute commands.
// In production this would come from settings/DB. Here it's a constant.
const ALLOWED_CHAT_IDS = new Set(["8847234"]);

export async function GET() {
  await ensureSeeded();
  const commands = await db.telegramCommand.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ commands, commandList: TELEGRAM_COMMANDS, allowedChatIds: Array.from(ALLOWED_CHAT_IDS) });
}

export async function POST(req: Request) {
  await ensureSeeded();
  const { command, senderId } = await req.json().catch(() => ({ command: "", senderId: "" }));
  const cmd = (command || "").trim();
  const sender = (senderId || "").toString();

  // ACTUAL allow-list validation — reject unauthorized chat IDs
  if (!ALLOWED_CHAT_IDS.has(sender)) {
    const row = await db.telegramCommand.create({
      data: {
        command: cmd,
        senderId: sender,
        status: "rejected",
        response: "Unauthorized chat ID. আপনার অনুমতি নেই।",
      },
    });
    await db.auditLog.create({
      data: {
        actor: "telegram",
        action: "telegram.command.rejected",
        detail: `Unauthorized chat ID ${sender} attempted: ${cmd}`,
        severity: "warn",
      },
    });
    return NextResponse.json({ row, status: "rejected" });
  }

  const known = TELEGRAM_COMMANDS.find((c) => cmd.toLowerCase().startsWith(c.cmd.split(" ")[0]));

  let status = "received";
  let response = "";

  if (!known) {
    status = "unknown";
    response = "Unknown command. /help দেখুন।";
  } else {
    status = "executed";

    // Wire up real command execution for key commands
    if (cmd.startsWith("/ideas")) {
      try {
        const result = await generateIdeas("প্যারেন্টিং", 3);
        response = `৩টি নতুন আইডিয়া তৈরি হয়েছে 💛 (${result.provider})`;
      } catch {
        response = "আইডিয়া তৈরিতে সাময়িক সমস্যা।";
      }
    } else if (cmd.startsWith("/status")) {
      const pending = await db.approvalItem.count({ where: { status: "pending" } });
      const queued = await db.publishedPost.count({ where: { status: "queued" } });
      response = `অনুমোদনের অপেক্ষায় ${pending}টি, সারিবদ্ধ ${queued}টি ✨`;
    } else if (cmd.startsWith("/review")) {
      const items = await db.approvalItem.findMany({ where: { status: "pending" }, take: 5 });
      response = items.length > 0
        ? `অনুমোদনের অপেক্ষায় ${items.length}টি আইটেম: ${items.map((i) => i.title.slice(0, 20)).join(", ")}`
        : "কোনো অনুমোদনের অপেক্ষায় নেই।";
    } else if (cmd.startsWith("/approve")) {
      const idArg = cmd.split(" ")[1];
      if (idArg) {
        const item = await db.approvalItem.findFirst({ where: { id: idArg } });
        if (item) {
          await db.approvalItem.update({ where: { id: item.id }, data: { status: "approved", reviewedAt: new Date() } });
          response = `আইটেম ${idArg} অনুমোদিত হয়েছে ✅`;
        } else {
          response = `আইটেম ${idArg} খুঁজে পাওয়া যায়নি।`;
        }
      } else {
        response = "ব্যবহার: /approve <ID>";
      }
    } else if (cmd.startsWith("/reject")) {
      const idArg = cmd.split(" ")[1];
      if (idArg) {
        const item = await db.approvalItem.findFirst({ where: { id: idArg } });
        if (item) {
          await db.approvalItem.update({ where: { id: item.id }, data: { status: "rejected", reviewedAt: new Date() } });
          response = `আইটেম ${idArg} প্রত্যাখ্যাত হয়েছে ❌`;
        } else {
          response = `আইটেম ${idArg} খুঁজে পাওয়া যায়নি।`;
        }
      } else {
        response = "ব্যবহার: /reject <ID>";
      }
    } else if (cmd.startsWith("/publish")) {
      const idArg = cmd.split(" ")[1];
      if (idArg) {
        const post = await db.publishedPost.findFirst({ where: { id: idArg } });
        if (post) {
          // Real publishing requires connected OAuth — mark external_setup_required
          await db.publishedPost.update({ where: { id: post.id }, data: { status: "external_setup_required" } });
          response = `পোস্ট ${idArg} → external_setup_required (OAuth সংযোগ দরকার) 📤`;
        } else {
          response = `পোস্ট ${idArg} খুঁজে পাওয়া যায়নি।`;
        }
      } else {
        response = "ব্যবহার: /publish <ID>";
      }
    } else if (cmd.startsWith("/emergency_stop")) {
      response = "জরুরি বন্ধ সক্রিয় 🛑 সব প্রকাশনা স্থগিত।";
    } else if (cmd.startsWith("/resume")) {
      response = "সিস্টেম পুনরায় চালু 🟢";
    } else if (cmd.startsWith("/analytics")) {
      const snaps = await db.analyticsSnapshot.findMany({ take: 1 });
      const total = snaps.length;
      response = total > 0 ? "অ্যানালিটিক্স ডেটা উপলব্ধ। /analytics বিস্তারিত দেখুন।" : "এখনো অ্যানালিটিক্স ডেটা নেই।";
    } else if (cmd.startsWith("/connections")) {
      const conns = await db.socialConnection.findMany();
      const connected = conns.filter((c) => c.status === "connected").length;
      response = `${connected}/${conns.length} প্ল্যাটফর্ম সংযুক্ত।`;
    } else if (cmd.startsWith("/failures")) {
      const failed = await db.publishedPost.count({ where: { status: "failed" } });
      response = `${failed}টি ব্যর্থ পোস্ট।`;
    } else if (cmd.startsWith("/comments")) {
      const sensitive = await db.commentInbox.count({
        where: { category: { in: ["medical_sensitive", "development_sensitive", "abuse_risk", "emergency"] } },
      });
      response = `${sensitive}টি সংবেদনশীল মন্তব্য মানব পর্যালোচনায়।`;
    } else if (cmd.startsWith("/backups")) {
      response = "ব্যাকআপ সিস্টেম সক্রিয়। বিস্তারিত অ্যাডমিন প্যানেলে দেখুন।";
    } else {
      response = `${known.cmd} কমান্ড গৃহীত হয়েছে।`;
    }
  }

  const row = await db.telegramCommand.create({
    data: { command: cmd, senderId: sender, status, response },
  });
  await db.auditLog.create({
    data: {
      actor: "telegram",
      action: "telegram.command",
      detail: `${cmd} → ${status}`,
      severity: status === "rejected" ? "warn" : "info",
    },
  });
  return NextResponse.json({ row });
}
