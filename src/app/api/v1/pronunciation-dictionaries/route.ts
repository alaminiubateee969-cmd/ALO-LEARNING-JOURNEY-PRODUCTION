/**
 * GET  /api/v1/pronunciation-dictionaries   — list per-tenant dictionaries
 * POST /api/v1/pronunciation-dictionaries   — create a new dictionary
 *
 * Body for POST:
 *   { "name": "Brand Names", "language": "bn-BD",
 *     "entries": [
 *       { "word": "আলো ল্যাবস", "phonetic": "alo labs", "type": "proper_noun" },
 *       { "word": "Grameenphone", "phonetic": "gra-min-phone", "type": "brand" }
 *     ] }
 *
 * Entries are passed to the TTS provider as a phoneme override list.
 */
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getSessionContext, unauthorized, badRequest, ok } from '@/lib/v1-middleware';
import { emitEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const dicts = await db.pronunciationDictionary.findMany({
    where: { companyId: ctx.companyId },
    orderBy: { createdAt: 'desc' },
  });

  return ok({
    dictionaries: dicts.map((d) => ({
      ...d,
      entries: JSON.parse(d.entries || '[]'),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext(request);
  if (!('authenticated' in ctx && ctx.authenticated)) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || !body.name) return badRequest('name is required');

  const entries = Array.isArray(body.entries) ? body.entries : [];

  const created = await db.pronunciationDictionary.create({
    data: {
      companyId: ctx.companyId,
      name: String(body.name),
      language: body.language || 'bn-BD',
      entries: JSON.stringify(entries),
      status: body.status || 'active',
    },
  });

  await emitEvent({
    type: 'pronunciation_dictionary.created',
    companyId: ctx.companyId,
    userId: ctx.userId,
    resource: 'pronunciation_dictionary',
    resourceId: created.id,
    title: 'Pronunciation dictionary created',
    description: `Dictionary "${created.name}" created with ${entries.length} entries`,
    metadata: { language: created.language, entryCount: entries.length },
  });

  return ok({
    dictionary: {
      ...created,
      entries: JSON.parse(created.entries || '[]'),
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
}
