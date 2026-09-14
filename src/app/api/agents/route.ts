import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents";

export async function GET() {
  return NextResponse.json({ agents: AGENTS });
}
