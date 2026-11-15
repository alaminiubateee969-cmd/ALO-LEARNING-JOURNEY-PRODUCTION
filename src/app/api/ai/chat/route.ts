import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { generateChatReply } from '@/lib/ai';

const MAX_MESSAGE_CHARS = 4000;

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { message } = await req.json().catch(() => ({}) as Record<string, unknown>);
    const question = typeof message === 'string' ? message.trim() : '';
    if (!question) return NextResponse.json({ error: 'Message required' }, { status: 400 });
    if (question.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Message too long (max ${MAX_MESSAGE_CHARS} characters)` },
        { status: 400 },
      );
    }

    // Get recent conversation history
    const recentMessages = await db.aiChatMessage.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const history = recentMessages
      .reverse()
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')
      .slice(-4000);

    // Get company context for personalized responses
    const companyUser = await db.companyUser.findFirst({
      where: { userId: payload.userId },
      include: { company: true },
    });

    const systemPrompt = `You are the AI Command Center for MarketingOS, a comprehensive AI-powered marketing operating system. You help users with:
- Creating marketing plans and strategies
- Generating social media content, blogs, emails, and SMS campaigns
- SEO optimization and challenges
- Lead generation and CRM management
- Campaign planning and execution
- Content scheduling and publishing
- Analytics and performance insights
- Competitor analysis
- Brand strategy

${companyUser ? `The user's company: ${companyUser.company.name}, Industry: ${companyUser.company.industry || 'General'}` : ''}

Be specific, actionable, and provide concrete steps. Be enthusiastic and professional.
Reply with ONLY JSON in the form {"reply": "..."} where "reply" is your answer to the user.`;

    const userPrompt = history
      ? `Conversation so far:\n${history}\n\nNew message: ${question}`
      : question;

    const result = await generateChatReply(systemPrompt, userPrompt);
    const answer = (result.data?.reply ?? '').trim();

    if (!answer) {
      // The local model is unreachable and the built-in template cannot answer
      // free-form questions. Report that honestly instead of failing with 500.
      return NextResponse.json(
        {
          error: 'ai_unavailable',
          message:
            'No local AI model answered this request. Set OLLAMA_BASE_URL (and optionally OLLAMA_MODEL) to a reachable Ollama instance, or start Ollama on this server.',
          provider: result.provider,
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Persist the exchange only after a real answer was generated.
    await db.aiChatMessage.create({
      data: { role: 'user', content: question, userId: payload.userId },
    });
    await db.aiChatMessage.create({
      data: { role: 'assistant', content: answer, userId: payload.userId },
    });

    return NextResponse.json({
      response: answer,
      provider: result.provider,
      degraded: !result.ok,
    });
  } catch (err) {
    console.error('[POST /api/ai/chat]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const messages = await db.aiChatMessage.findMany({
      where: { userId: payload.userId },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    return NextResponse.json({ messages });
  } catch (err) {
    console.error('[GET /api/ai/chat]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
