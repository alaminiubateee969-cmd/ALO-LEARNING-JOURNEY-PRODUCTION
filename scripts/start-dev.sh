#!/bin/bash
# Auto-restart dev server wrapper for MarketingOS
cd /home/z/my-project/marketingos
while true; do
  echo "[$(date)] Starting dev server..."
  bun dev 2>&1
  EXIT=$?
  echo "[$(date)] Dev server exited with code $EXIT, restarting in 3s..."
  sleep 3
done
