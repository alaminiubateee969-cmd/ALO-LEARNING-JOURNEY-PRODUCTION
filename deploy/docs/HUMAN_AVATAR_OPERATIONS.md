# Human Avatar Operations Runbook

## Daily Operations

### Health check
```bash
curl https://your-domain/api/health
```

### Check stuck jobs
```bash
# Cron every 5 min (auto-recovers)
curl -X POST -H "x-cron-secret: $CRON_SECRET" \
  "https://your-domain/api/recovery/sweep?timeoutMinutes=10"

# Manual dry-run (no mutation)
curl https://your-domain/api/recovery/sweep
```

### Monitor generation logs
Structured JSON to stdout. Each entry has `jobId` for correlation:
```json
{"ts":"2026-10-07T21:01:57Z","level":"info","message":"ffmpeg-compose-complete","jobId":"job_...","durationSec":81.32,"hasVideo":true,"hasAudio":true}
```

Filter:
```bash
pm2 logs alo | grep -E 'pipeline-start|llm-script-complete|tts-complete|image-gen-complete|ffmpeg-compose|pipeline-complete|pipeline-failed|lipsync-'
```

### Verify a completed video
```bash
# Get video URL
curl https://your-domain/api/avatar-video | jq '.videos[0].videoUrl'
# ffprobe — MUST show video AND audio
ffprobe -show_streams <url> | grep codec_type
```

## Failure Diagnosis

### Video stuck in generating_images
1. Check z-ai image-gen: `curl https://your-domain/api/image-studio` (200?)
2. Check the record: `curl https://your-domain/api/avatar-video | jq '.videos[] | select(.status=="generating_images")'`
3. If stuck > 10 min, sweep auto-fails it. Or force: `curl -X POST 'https://your-domain/api/recovery/sweep?timeoutMinutes=1'`
4. User retries by POSTing to `/api/avatar-video` again.

### Lip-sync returns http_error
1. Check `LIPSYNC_SERVICE_URL` reachable from server
2. Check `LIPSYNC_API_KEY` if service requires auth
3. Increase `LIPSYNC_TIMEOUT_MS` (default 120s)
4. Check lip-sync service logs

### Lip-sync returns invalid_output
1. Provider returned non-video or stream-missing output
2. Verify field names: `LIPSYNC_IMAGE_FIELD`, `LIPSYNC_AUDIO_FIELD`
3. ffprobe the provider's raw response to diagnose

### Audio missing in final MP4
Pipeline validates output + refuses to mark `completed` if audio missing. If you see `failed` with `Output validation failed: video=true audio=false`:
- Check FFmpeg version supports `anullsrc` + `aac`
- Check DejaVu font path
- Check disk space in `storage/avatar-videos/`

## Disk Cleanup
```bash
ls -lh public/avatar-videos/ public/avatar-audio/ public/avatar-scenes/ public/avatars/
```
Deleting avatars/videos via API auto-cleans their files.

## Backup
```bash
cp db/custom.db "backups/custom-$(date +%Y%m%d).db"
tar czf "backups/media-$(date +%Y%m%d).tar.gz" public/avatars public/avatar-videos public/avatar-audio public/avatar-scenes public/avatar-thumbs
```
