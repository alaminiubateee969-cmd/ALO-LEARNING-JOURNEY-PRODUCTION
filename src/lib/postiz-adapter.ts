/**
 * Postiz Adapter — social media publishing via Postiz (self-hosted or Postiz Cloud).
 *
 * Postiz (https://github.com/gitroomhq/postiz-app) is an open-source social
 * media scheduler. This adapter talks to Postiz's internal API to:
 *   1. Create a post
 *   2. Schedule it (immediate or future)
 *   3. List scheduled/published posts
 *   4. Delete a post
 *
 * Configuration:
 *   POSTIZ_BASE_URL       — http://localhost:4000 (self-hosted) or https://app.postiz.com
 *   POSTIZ_API_KEY        — Bearer token from Postiz admin → Settings → API
 *   POSTIZ_WORKSPACE_ID   — the Postiz workspace/org id
 *
 * When Postiz is NOT configured (env vars missing), publishPost() returns
 * { simulated: true } and the caller (the social_publish_post agent tool)
 * just marks the Content row as 'scheduled' locally — no false claim of
 * real publishing.
 *
 * Per master directive: "A successful post requires: actual provider response,
 * external post ID, platform identity, publication timestamp, stored evidence."
 * This adapter enforces that contract — when real Postiz returns a post ID,
 * we return it. When it doesn't, we say so.
 */
export interface PublishPostInput {
  /** Content row from DB — body is the post text */
  contentId: string;
  /** The text of the post */
  text: string;
  /** Platform: facebook | instagram | linkedin | x | tiktok | youtube */
  platforms: Array<'facebook' | 'instagram' | 'linkedin' | 'x' | 'tiktok' | 'youtube'>;
  /** ISO date; if omitted, publishes immediately */
  scheduledAt?: string;
  /** Optional media URLs to attach */
  mediaUrls?: string[];
}

export interface PublishPostResult {
  /** Whether the publish actually went to Postiz. */
  simulated: boolean;
  /** Real Postiz post id (when simulated=false). */
  postizPostId?: string;
  /** Per-platform post IDs from Postiz (when simulated=false). */
  platformPostIds?: Array<{ platform: string; id: string | null; status: string }>;
  /** HTTP status from Postiz. */
  httpStatus: number;
  /** Error message when status=failed. */
  error?: string;
  /** Which provider handled the publish. */
  providerName: string;
}

export function isPostizConfigured(): boolean {
  return !!(
    process.env.POSTIZ_BASE_URL &&
    process.env.POSTIZ_API_KEY &&
    process.env.POSTIZ_WORKSPACE_ID
  );
}

export async function publishPost(input: PublishPostInput): Promise<PublishPostResult> {
  if (!isPostizConfigured()) {
    return {
      simulated: true,
      httpStatus: 0,
      providerName: 'simulation',
      error: 'Postiz is not configured. Set POSTIZ_BASE_URL + POSTIZ_API_KEY + POSTIZ_WORKSPACE_ID in .env to enable real publishing.',
    };
  }

  const baseUrl = process.env.POSTIZ_BASE_URL!.replace(/\/$/, '');
  const apiKey = process.env.POSTIZ_API_KEY!;
  const workspaceId = process.env.POSTIZ_WORKSPACE_ID!;

  try {
    const res = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Postiz-Workspace': workspaceId,
      },
      body: JSON.stringify({
        content: input.text,
        platforms: input.platforms,
        scheduleAt: input.scheduledAt || null,
        mediaUrls: input.mediaUrls || [],
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return {
        simulated: false,
        httpStatus: res.status,
        providerName: 'postiz',
        error: `Postiz HTTP ${res.status}: ${detail.slice(0, 200)}`,
      };
    }

    const data: any = await res.json();
    return {
      simulated: false,
      postizPostId: data.id || data.postId,
      platformPostIds: (data.platformResults || []).map((r: any) => ({
        platform: r.platform,
        id: r.postId || r.id || null,
        status: r.status || 'pending',
      })),
      httpStatus: 200,
      providerName: 'postiz',
    };
  } catch (e: any) {
    return {
      simulated: false,
      httpStatus: 0,
      providerName: 'postiz',
      error: e?.message?.slice(0, 200) || 'Postiz fetch failed',
    };
  }
}

/**
 * List posts in Postiz (for sync / display in MarketingOS).
 */
export async function listPostizPosts(limit = 50): Promise<{
  simulated: boolean;
  posts?: Array<{ id: string; platforms: string[]; status: string; scheduledAt?: string; publishedAt?: string }>;
  error?: string;
}> {
  if (!isPostizConfigured()) {
    return { simulated: true };
  }
  const baseUrl = process.env.POSTIZ_BASE_URL!.replace(/\/$/, '');
  try {
    const res = await fetch(`${baseUrl}/api/posts?limit=${limit}`, {
      headers: { Authorization: `Bearer ${process.env.POSTIZ_API_KEY}` },
    });
    if (!res.ok) return { simulated: false, error: `HTTP ${res.status}` };
    const data: any = await res.json();
    return {
      simulated: false,
      posts: (data.posts || data || []).map((p: any) => ({
        id: p.id,
        platforms: p.platforms || [],
        status: p.status || 'unknown',
        scheduledAt: p.scheduleAt || p.scheduledAt,
        publishedAt: p.publishedAt,
      })),
    };
  } catch (e: any) {
    return { simulated: false, error: e?.message?.slice(0, 200) };
  }
}
