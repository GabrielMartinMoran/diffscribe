#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────
# wait-for-dev-server.sh — Readiness probe for the dev server
# ──────────────────────────────────────────────────────────
#
# Polls GET / until the server responds with HTTP 200.
# Exits 0 on success, 1 on timeout.
#
# Usage:
#   wait-for-dev-server.sh [--url <URL>] [--timeout <seconds>]
#
# Defaults:
#   URL:     http://127.0.0.1:56823
#   Timeout: 30 seconds
# ──────────────────────────────────────────────────────────

URL="http://127.0.0.1:56823"
TIMEOUT=30
POLL_INTERVAL=0.2

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      URL="$2"
      shift 2
      ;;
    --timeout)
      TIMEOUT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

# Use bash built-in SECONDS for portable timeout tracking
START_TIME=$SECONDS

while true; do
  # Check timeout
  ELAPSED=$((SECONDS - START_TIME))
  if [[ $ELAPSED -ge $TIMEOUT ]]; then
    echo "Timeout: server at $URL did not respond with HTTP 200 after ${TIMEOUT}s" >&2
    exit 1
  fi

  # Attempt HTTP GET — curl may fail (connection refused, timeout, etc.)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$URL" 2>/dev/null || echo "000")

  if [[ "$STATUS" == "200" ]]; then
    exit 0
  fi

  sleep "$POLL_INTERVAL"
done
