import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { storeMemory, retrieveMemories } from '@/lib/ai-extensions';

// GET /api/ai/memory?agentType=lead_scorer&category=company_info
// POST /api/ai/memory — store a new memory
// Body: { agentType: string, category: string, content: string, metadata?: object }
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const agentType = searchParams.get('agentType') || 'general';
    const category = searchParams.get('category') || undefined;
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10));

    const memories = await retrieveMemories(payload.companyId, agentType, category, limit);

    return NextResponse.json({ data: memories });
  } catch (err) {
    console.error('[GET /api/ai/memory]', err);
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 401 });
    const payload = await verifyToken(token);
    if (!payload || !payload.companyId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const agentType = String(body.agentType || 'general');
    const category = String(body.category || 'general');
    const content = String(body.content || '').trim();
    if (!content) return NextResponse.json({ error: 'content is required' }, { status: 400 });

    await storeMemory(
      payload.companyId,
      agentType,
      category,
      content,
      body.metadata,
    );

    return NextResponse.json({ data: { stored: true, agentType, category } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ai/memory]', err);
    return NextResponse.json({ error: 'Failed to store memory' }, { status: 500 });
  }
}
