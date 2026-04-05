#!/bin/bash
# Kill any running next dev processes
echo "Stopping any existing Next.js processes..."
taskkill //F //IM node.exe //FI "WINDOWTITLE eq next*" 2>/dev/null || true

# Remove stale lock file if it exists
LOCK_FILE=".next/dev/lock"
if [ -f "$LOCK_FILE" ]; then
  echo "Removing stale lock file..."
  rm -f "$LOCK_FILE"
fi

# Find available port starting from 3000
PORT=3000
while true; do
  # Check if port is in use (netstat on Windows)
  if ! netstat -an 2>/dev/null | grep -q ":$PORT "; then
    break
  fi
  PORT=$((PORT + 1))
done

echo "Starting Next.js on port $PORT..."
npx next dev -p $PORT
