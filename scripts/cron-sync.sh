#!/bin/bash

# Cron wrapper for deadline-sync
# Usage: Add to crontab: 0 */6 * * * /path/to/cron-sync.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOCK_FILE="/tmp/deadline-sync.lock"
LOG_FILE="$PROJECT_DIR/data/cron.log"

# Ensure log directory exists
mkdir -p "$PROJECT_DIR/data"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $1" >> "$LOG_FILE"
}

# Check for lock file (prevent concurrent runs)
if [ -f "$LOCK_FILE" ]; then
  PID=$(cat "$LOCK_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    log "Another sync is already running (PID: $PID)"
    exit 0
  else
    log "Removing stale lock file"
    rm -f "$LOCK_FILE"
  fi
fi

# Create lock file
echo $$ > "$LOCK_FILE"

cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

log "Starting sync"

cd "$PROJECT_DIR"
npm run cli sync >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

case $EXIT_CODE in
  0)
    log "Sync completed successfully"
    ;;
  2)
    log "Session expired - sending notification"
    osascript -e 'display notification "Please run deadline-sync login" with title "Deadline Sync" subtitle "Session Expired"'
    ;;
  *)
    log "Sync failed with exit code $EXIT_CODE"
    osascript -e 'display notification "Sync failed - check logs" with title "Deadline Sync" subtitle "Error"'
    ;;
esac

exit $EXIT_CODE
