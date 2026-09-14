import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import { parseNaturalCommand, generateIdeas, scoreContentOpportunity } from "@/lib/ai";

// Natural language command center — parses Bengali/English commands
// and triggers real agent operations
export async function POST(req: Request) {
  await ensureSeeded();
  const { command } = await req.json().catch(() => ({ command: "" }));

  if (!command?.trim()) {
    return NextResponse.json({ error: "command required" }, { status: 400 });
  }

  // Step 1: Parse the natural language command
  const parsed = await parseNaturalCommand(command);

  // Step 2: Execute the real operation based on intent
  let result: any = { parsed: parsed.data, provider: parsed.provider };

  switch (parsed.data.intent) {
    case "find_topics": {
      // Generate content ideas
      const count = parsed.data.quantity || 5;
      const ideas = await generateIdeas(parsed.data.topic || "প্যারেন্টিং", count);
      result.action = "ideas_generated";
      result.ideas = ideas.data;
      result.ideasProvider = ideas.provider;
      break;
    }

    case "score_topic": {
      // Score a topic for content opportunity
      if (parsed.data.topic) {
        const score = await scoreContentOpportunity(parsed.data.topic);
        result.action = "topic_scored";
        result.score = score.data;
        result.scoreProvider = score.provider;
      }
      break;
    }

    case "make_video": {
      // Return video generation parameters
      result.action = "video_params_ready";
      result.videoParams = {
        topic: parsed.data.topic || "Untitled",
        duration: parsed.data.duration || 50,
        platforms: parsed.data.platforms?.length > 0 ? parsed.data.platforms : ["youtube", "facebook"],
        characters: parsed.data.characters || [],
      };
      result.message = `Video generation ready. Call POST /api/video/cinematic with these params.`;
      break;
    }

    case "seo_article": {
      // Generate content brief
      result.action = "content_brief_ready";
      result.briefParams = {
        topic: parsed.data.topic || "Untitled",
        category: "parenting",
        ageGroup: "1-2y",
      };
      result.message = `Content brief generation ready. Call POST /api/content/brief with these params.`;
      break;
    }

    case "calendar": {
      // Return weekly calendar
      result.action = "calendar_ready";
      result.calendar = [
        { day: "Monday", theme: "Parenting tip", category: "parenting" },
        { day: "Tuesday", theme: "Teacher activity", category: "teacher-tips" },
        { day: "Wednesday", theme: "Baby learning", category: "baby-learning" },
        { day: "Thursday", theme: "Family story", category: "family-activities" },
        { day: "Friday", theme: "Expert advice", category: "expert-interviews" },
        { day: "Saturday", theme: "Family activity", category: "family-activities" },
        { day: "Sunday", theme: "Q&A", category: "parenting-questions" },
      ];
      break;
    }

    case "analytics": {
      // Return analytics summary
      const snaps = await db.analyticsSnapshot.findMany({ take: 10 });
      result.action = "analytics_summary";
      result.totalViews = snaps.filter((s) => s.metric === "views").reduce((s, x) => s + x.value, 0);
      result.totalReach = snaps.filter((s) => s.metric === "reach").reduce((s, x) => s + x.value, 0);
      result.totalShares = snaps.filter((s) => s.metric === "shares").reduce((s, x) => s + x.value, 0);
      result.dataPoints = snaps.length;
      break;
    }

    case "publish": {
      // Check publishing readiness
      const pending = await db.approvalItem.count({ where: { status: "pending" } });
      result.action = "publish_check";
      result.pendingApprovals = pending;
      result.message = pending > 0
        ? `${pending} items pending approval. Approve them first.`
        : "No items pending. Create content first.";
      break;
    }

    default: {
      result.action = "create_content";
      result.message = `Content creation ready. Topic: ${parsed.data.topic || "general parenting"}. Call POST /api/content/generate.`;
      break;
    }
  }

  // Audit log
  await db.auditLog.create({
    data: {
      actor: "CommandCenter",
      action: "command.parse",
      detail: `"${command.slice(0, 80)}" → intent: ${parsed.data.intent}, via ${parsed.provider}`,
      severity: "info",
    },
  });

  return NextResponse.json(result);
}
