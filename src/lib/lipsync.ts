/**
 * ALO Lip-Sync Adapter — REAL HTTP integration (no longer a stub).
 *
 * Reads LIPSYNC_SERVICE_URL. When set, performs an actual multipart POST
 * with portrait image + audio WAV. Validates the returned video with ffprobe.
 *
 * Provider abstraction: a registry of providers keyed by LIPSYNC_PROVIDER env
 * (default: wav2lip). Each provider implements the same contract.
 *
 * When LIPSYNC_SERVICE_URL is unset, returns a structured "not_configured"
 * result. The caller MUST NOT mark lipSyncUsed=true in that case.
 *
 * External runtime dependency: an actual deployed Wav2Lip/SadTalker service.
 * This adapter is production code; the external service is NOT testable here.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { log, newJobId } from '@/lib/observability';

export type LipSyncProvider = 'wav2lip' | 'sadtalker' | 'videoretalking';

export interface LipSyncRequest {
  portraitPath: string;
  audioPath: string;
  outPath: string;
  signal?: AbortSignal;
}

export interface LipSyncResult {
  used: boolean;
  reason: 'not_configured' | 'success' | 'http_error' | 'invalid_output' | 'timeout' | 'provider_error';
  outputPath?: string;
  durationSec?: number;
  error?: string;
}

function probeDuration(filePath: string): number | null {
  try {
    const out = execSync(`ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`, { encoding: 'utf-8' }).trim();
    return parseFloat(out) || null;
  } catch {
    return null;
  }
}

function probeHasVideoAndAudio(filePath: string): { video: boolean; audio: boolean } {
  try {
    const out = execSync(`ffprobe -v error -show_entries stream=codec_type -of csv=p=0 "${filePath}"`, { encoding: 'utf-8' }).trim();
    const lines = out.split('\n').map((s) => s.trim()).filter(Boolean);
    return {
      video: lines.includes('video'),
      audio: lines.includes('audio'),
    };
  } catch {
    return { video: false, audio: false };
  }
}

/**
 * Wav2Lip provider contract (the de-facto open-source standard):
 *   POST <url> multipart/form-data
 *     - field "image": portrait PNG
 *     - field "audio": audio WAV
 *     - field "pads" (optional): "0 10 0 0"
 *     - field "resize_factor" (optional): "1"
 *   Response: video/mp4 binary body
 *
 * SadTalker / VideoReTalking share a similar contract; only the field
 * names differ slightly. We accept a single generic contract and allow
 * LIPSYNC_PROVIDER to override field names via env if needed.
 */
async function callProvider(req: LipSyncRequest, provider: LipSyncProvider): Promise<LipSyncResult> {
  const url = process.env.LIPSYNC_SERVICE_URL!;
  const timeoutMs = parseInt(process.env.LIPSYNC_TIMEOUT_MS || '120000', 10);
  const jobId = newJobId();

  log('info', 'lipsync-start', { jobId, provider, url: url.replace(/\/\/.*@/, '//'), timeoutMs });

  const imageField = process.env.LIPSYNC_IMAGE_FIELD || (provider === 'sadtalker' ? 'source_image' : 'image');
  const audioField = process.env.LIPSYNC_AUDIO_FIELD || (provider === 'sadtalker' ? 'driven_audio' : 'audio');

  const formData = new FormData();
  const imgBuf = fs.readFileSync(req.portraitPath);
  const audBuf = fs.readFileSync(req.audioPath);
  formData.append(imageField, new Blob([imgBuf], { type: 'image/png' }), 'portrait.png');
  formData.append(audioField, new Blob([audBuf], { type: 'audio/wav' }), 'audio.wav');
  if (process.env.LIPSYNC_EXTRA_FIELDS) {
    try {
      const extra = JSON.parse(process.env.LIPSYNC_EXTRA_FIELDS);
      for (const [k, v] of Object.entries(extra)) formData.append(k, String(v));
    } catch {}
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (req.signal) req.signal.addEventListener('abort', () => controller.abort());

  let response: Response;
  try {
    const headers: Record<string, string> = {};
    if (process.env.LIPSYNC_API_KEY) headers['Authorization'] = `Bearer ${process.env.LIPSYNC_API_KEY}`;
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    const err = e as Error;
    if (err.name === 'AbortError') {
      log('error', 'lipsync-timeout', { jobId, provider, timeoutMs });
      return { used: false, reason: 'timeout', error: `Lip-sync timed out after ${timeoutMs}ms` };
    }
    log('error', 'lipsync-fetch-error', { jobId, provider, error: err.message });
    return { used: false, reason: 'http_error', error: err.message };
  }
  clearTimeout(timer);

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    log('error', 'lipsync-http-error', { jobId, provider, status: response.status, body: body.slice(0, 300) });
    return { used: false, reason: 'http_error', error: `Provider returned HTTP ${response.status}: ${body.slice(0, 200)}` };
  }

  // Save the response body to outPath
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('video') && !contentType.includes('octet-stream')) {
    log('error', 'lipsync-invalid-content-type', { jobId, provider, contentType });
    return { used: false, reason: 'invalid_output', error: `Provider returned non-video content-type: ${contentType}` };
  }
  const buf = Buffer.from(await response.arrayBuffer());
  if (buf.length < 1024) {
    log('error', 'lipsync-empty-response', { jobId, provider, bytes: buf.length });
    return { used: false, reason: 'invalid_output', error: 'Provider returned empty response' };
  }
  fs.writeFileSync(req.outPath, buf);

  // Validate output with ffprobe — MUST have both video and audio
  const streams = probeHasVideoAndAudio(req.outPath);
  const duration = probeDuration(req.outPath);
  if (!streams.video || !streams.audio || duration === null) {
    log('error', 'lipsync-output-invalid', { jobId, provider, streams, duration, bytes: buf.length });
    return { used: false, reason: 'invalid_output', error: `Output missing streams (video=${streams.video}, audio=${streams.audio}) or duration=null` };
  }

  log('info', 'lipsync-success', { jobId, provider, outputPath: req.outPath, durationSec: duration, bytes: buf.length });
  return { used: true, reason: 'success', outputPath: req.outPath, durationSec: duration };
}

export async function maybeLipSync(req: LipSyncRequest): Promise<LipSyncResult> {
  const url = process.env.LIPSYNC_SERVICE_URL;
  if (!url) {
    return { used: false, reason: 'not_configured' };
  }
  const provider = (process.env.LIPSYNC_PROVIDER as LipSyncProvider) || 'wav2lip';
  // ensure output dir exists
  fs.mkdirSync(path.dirname(req.outPath), { recursive: true });
  try {
    return await callProvider(req, provider);
  } catch (e) {
    log('error', 'lipsync-uncaught', { error: (e as Error).message });
    return { used: false, reason: 'provider_error', error: (e as Error).message };
  }
}
