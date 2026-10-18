import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * ALO Image Studio Pro
 * Advanced image generation with:
 *  - Batch generation (multiple prompts in one call)
 *  - Preset styles (parenting, education, marketing, social)
 *  - All 7 supported sizes (square, portrait, landscape, wide, tall)
 *  - Cache by prompt+size hash
 *  - Style presets that enrich raw prompts
 */

const SUPPORTED_SIZES = [
  '1024x1024', // Square
  '768x1344', // Portrait
  '864x1152', // Portrait
  '1344x768', // Landscape
  '1152x864', // Landscape
  '1440x720', // Wide landscape
  '720x1440', // Tall portrait
] as const;

const SIZE_PURPOSES: Record<string, string> = {
  '1024x1024': 'Square — social posts, thumbnails, logos',
  '768x1344': 'Portrait — stories, posters',
  '864x1152': 'Portrait — blog featured image',
  '1344x768': 'Landscape — blog header, banner',
  '1152x864': 'Landscape — article illustration',
  '1440x720': 'Wide landscape — hero banner, cover',
  '720x1440': 'Tall portrait — mobile banner',
};

const STYLE_PRESETS: Record<string, (subject: string) => string> = {
  'parenting-warm': (s) =>
    `${s}, warm pastel colors, soft natural lighting, tender family moment, illustrated storybook style, gentle and reassuring mood, high quality, detailed`,
  'education-clean': (s) =>
    `${s}, clean modern educational illustration, flat design with subtle gradients, friendly and approachable, balanced composition, professional, high quality`,
  'marketing-bold': (s) =>
    `${s}, bold vibrant marketing visual, high contrast, eye-catching composition, professional commercial photography style, dramatic lighting, high quality`,
  'social-square': (s) =>
    `${s}, social media optimized, vibrant and engaging, centered composition, clear focal point, modern flat illustration, high quality`,
  'cinematic': (s) =>
    `${s}, cinematic dramatic lighting, film still aesthetic, shallow depth of field, rich color grading, atmospheric, high quality, detailed`,
  'minimal-line': (s) =>
    `${s}, minimalist line art, single weight strokes, ample negative space, monochrome with one accent color, elegant, high quality`,
  'watercolor-soft': (s) =>
    `${s}, soft watercolor painting, delicate washes, gentle bleeding edges, warm palette, handcrafted feel, high quality`,
  'isometric-3d': (s) =>
    `${s}, isometric 3D illustration, clean geometric shapes, soft shadows, pastel palette, modern tech aesthetic, high quality`,
};

function cacheKey(prompt: string, size: string): string {
  return crypto.createHash('md5').update(`${prompt}|${size}`).digest('hex');
}

// GET — list presets, sizes, recent gallery
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const gallery = url.searchParams.get('gallery') === 'true';

    const presets = Object.entries(STYLE_PRESETS).map(([key, fn]) => ({
      id: key,
      label: key.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      samplePrompt: fn('a Bengali parent reading to their child').slice(0, 120) + '...',
    }));

    const sizes = SUPPORTED_SIZES.map((s) => ({ size: s, purpose: SIZE_PURPOSES[s] }));

    let recentFiles: Array<{ name: string; url: string; size: number; mtime: string }> = [];
    const genDir = path.join(process.cwd(), 'public', 'generated');
    if (gallery && fs.existsSync(genDir)) {
      const files = fs
        .readdirSync(genDir)
        .filter((f) => /\.(png|jpg|svg)$/i.test(f))
        .map((f) => {
          const stat = fs.statSync(path.join(genDir, f));
          return {
            name: f,
            url: `/generated/${f}`,
            size: stat.size,
            mtime: stat.mtime.toISOString(),
          };
        })
        .sort((a, b) => (a.mtime < b.mtime ? 1 : -1))
        .slice(0, 24);
      recentFiles = files;
    }

    return NextResponse.json({
      presets,
      sizes,
      supportedSizes: SUPPORTED_SIZES,
      gallery: recentFiles,
      cacheSize: recentFiles.length,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// POST — single or batch image generation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompts, // string | string[]
      size = '1024x1024',
      preset, // optional style preset id
      batchId, // optional grouping label
    } = body as {
      prompts: string | string[];
      size?: string;
      preset?: string;
      batchId?: string;
    };

    if (!prompts) {
      return NextResponse.json({ ok: false, error: 'prompts is required' }, { status: 400 });
    }
    if (!SUPPORTED_SIZES.includes(size as (typeof SUPPORTED_SIZES)[number])) {
      return NextResponse.json(
        { ok: false, error: `size must be one of ${SUPPORTED_SIZES.join(', ')}` },
        { status: 400 }
      );
    }
    if (preset && !STYLE_PRESETS[preset]) {
      return NextResponse.json(
        { ok: false, error: `Unknown preset. Available: ${Object.keys(STYLE_PRESETS).join(', ')}` },
        { status: 400 }
      );
    }

    const promptList = Array.isArray(prompts) ? prompts : [prompts];
    if (promptList.length > 8) {
      return NextResponse.json(
        { ok: false, error: 'Max 8 images per batch' },
        { status: 400 }
      );
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const outDir = path.join(process.cwd(), 'public', 'generated');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const batch = batchId || `batch_${Date.now()}`;
    const results: Array<{
      index: number;
      prompt: string;
      enrichedPrompt?: string;
      url: string;
      size: string;
      bytes: number;
      cached: boolean;
      error?: string;
    }> = [];

    for (let i = 0; i < promptList.length; i++) {
      const rawPrompt = promptList[i].trim();
      if (!rawPrompt) {
        results.push({ index: i, prompt: '', url: '', size, bytes: 0, cached: false, error: 'empty prompt' });
        continue;
      }
      const enriched = preset ? STYLE_PRESETS[preset](rawPrompt) : rawPrompt;
      const key = cacheKey(enriched, size);
      const filename = `${key}.png`;
      const outPath = path.join(outDir, filename);

      try {
        // cache hit?
        if (fs.existsSync(outPath)) {
          const stat = fs.statSync(outPath);
          results.push({
            index: i,
            prompt: rawPrompt,
            enrichedPrompt: enriched,
            url: `/generated/${filename}`,
            size,
            bytes: stat.size,
            cached: true,
          });
          continue;
        }

        const response = await zai.images.generations.create({
          prompt: enriched,
          size: size as '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440',
        });
        const imageBase64 = response.data[0].base64;
        const buffer = Buffer.from(imageBase64, 'base64');
        fs.writeFileSync(outPath, buffer);

        results.push({
          index: i,
          prompt: rawPrompt,
          enrichedPrompt: enriched,
          url: `/generated/${filename}`,
          size,
          bytes: buffer.length,
          cached: false,
        });
      } catch (genErr) {
        results.push({
          index: i,
          prompt: rawPrompt,
          enrichedPrompt: enriched,
          url: '',
          size,
          bytes: 0,
          cached: false,
          error: (genErr as Error).message,
        });
      }
    }

    const succeeded = results.filter((r) => r.url).length;
    return NextResponse.json({
      ok: succeeded > 0,
      batchId: batch,
      preset: preset || null,
      size,
      total: promptList.length,
      succeeded,
      failed: promptList.length - succeeded,
      cached: results.filter((r) => r.cached).length,
      results,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
