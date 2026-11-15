#!/usr/bin/env bash
# Pull latest GitHub code; only reinstall/rebuild/restart when the commit changed.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/debug-quest}"
BRANCH="${DEPLOY_BRANCH:-jayavarapu/vultr-deploy}"
APP_NAME="${PM2_APP_NAME:-debug-quest}"
FORCE="${FORCE_DEPLOY:-0}"

cd "$APP_DIR"

echo "[deploy] $(date -u +%Y-%m-%dT%H:%M:%SZ) checking $APP_DIR (branch=$BRANCH)"

BEFORE="$(git rev-parse HEAD)"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

AFTER="$(git rev-parse HEAD)"

if [ "$FORCE" != "1" ] && [ "$BEFORE" = "$AFTER" ]; then
  echo "[deploy] already up to date ($AFTER) — skip build"
  exit 0
fi

echo "[deploy] updating $BEFORE → $AFTER"

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

npm run build

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env
  else
    pm2 start npm --name "$APP_NAME" -- start
    pm2 save
  fi
else
  echo "[deploy] pm2 not found; build finished — start the app manually"
fi

echo "[deploy] done"
