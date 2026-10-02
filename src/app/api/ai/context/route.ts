import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/ai/context?conversationId=xxx — get conversation context
// POST /api/ai/context — update conversation context
// Inspired by mksglu/context-mode — manages AI conversation context window

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    // Get recent AI chat messages as context
    const messages = await db.aiChatMessage.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Build context summary
    const context = {
      messageCount: messages.length,
      recentMessages: messages.reverse().map((m) => ({
        role: m.role,
        content: m.content.slice(0, 200),
        createdAt: m.createdAt.toISOString(),
      })),
      // Include company context
      company: null as any,
      // Include relevant memories
      memoryCount: 0,
    };

    // Load company info
    const companyUser = await db.companyUser.findFirst({
      where: { userId: payload.userId },
      include: { company: true },
    });
    if (companyUser?.company) {
      context.company = {
        name: companyUser.company.name,
        industry: companyUser.company.industry,
        targetAudience: companyUser.company.targetAudience,
        marketingGoals: companyUser.company.marketingGoals,
      };
    }

    return NextResponse.json({ data: context });
  } catch (err) {
    console.error('[GET /api/ai/context]', err);
    return NextResponse.json({ error: 'Failed to fetch context' }, { status: 500 });
  }
}
