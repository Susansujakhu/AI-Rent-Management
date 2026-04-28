#!/bin/bash
# Run this on the cPanel server to deploy latest code
# Usage: bash deploy.sh

set -e

APP_DIR="$HOME/easy-rent.xpertthemes.com"
NODE_ENV_ACTIVATE="$HOME/nodevenv/easy-rent.xpertthemes.com/20/bin/activate"

echo "==> Activating Node environment..."
source "$NODE_ENV_ACTIVATE"

echo "==> Pulling latest code..."
cd "$APP_DIR"
git fetch origin
git reset --hard origin/master

echo "==> Syncing Prisma client..."
node scripts/sync-prisma.js

echo "==> Restarting app..."
touch tmp/restart.txt

echo ""
echo "✓ Done. Wait ~30 seconds then test the site."
