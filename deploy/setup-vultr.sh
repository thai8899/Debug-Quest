#!/usr/bin/env bash
# One-time Vultr VPS bootstrap (Ubuntu 22.04/24.04). Run as root.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/thai8899/Debug-Quest.git}"
BRANCH="${DEPLOY_BRANCH:-main}"
APP_DIR="${APP_DIR:-/opt/debug-quest}"
APP_USER="${APP_USER:-deploy}"
APP_NAME="${PM2_APP_NAME:-debug-quest}"
NODE_MAJOR="${NODE_MAJOR:-22}"

export DEBIAN_FRONTEND=noninteractive

echo "[setup] installing system packages..."
apt-get update -y
apt-get install -y curl git build-essential ca-certificates nginx ufw

if ! command -v node >/dev/null 2>&1; then
  echo "[setup] installing Node.js ${NODE_MAJOR}.x..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y nodejs
fi

npm install -g pm2

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash "$APP_USER"
fi

mkdir -p "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$APP_USER" git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
else
  echo "[setup] repo already present at $APP_DIR"
  sudo -u "$APP_USER" bash -lc "cd '$APP_DIR' && git fetch origin && git checkout '$BRANCH' && git reset --hard origin/$BRANCH"
fi

if [ ! -f "$APP_DIR/.env" ] && [ ! -f "$APP_DIR/.env.local" ] && [ ! -f "$APP_DIR/.env.production" ]; then
  cat > "$APP_DIR/.env.production" <<'EOF'
NODE_ENV=production
PORT=3000
APP_URL=http://YOUR_VULTR_IP
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3-flash-preview
GITHUB_TOKEN=
TIGER_DATABASE_URL=
MONGODB_URI=
NTFY_TOPIC=
DISCORD_WEBHOOK_URL=
EOF
  chown "$APP_USER:$APP_USER" "$APP_DIR/.env.production"
  echo "[setup] wrote $APP_DIR/.env.production — EDIT THIS before first start"
fi

cat > /etc/nginx/sites-available/debug-quest <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
EOF

ln -sfn /etc/nginx/sites-available/debug-quest /etc/nginx/sites-enabled/debug-quest
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable || true

# Every 2 minutes: pull branch and rebuild only if commit changed
cat > /etc/cron.d/debug-quest-autodeploy <<EOF
*/2 * * * * $APP_USER DEPLOY_BRANCH=$BRANCH APP_DIR=$APP_DIR PM2_APP_NAME=$APP_NAME /bin/bash $APP_DIR/deploy/update.sh >> /var/log/debug-quest-deploy.log 2>&1
EOF
chmod 644 /etc/cron.d/debug-quest-autodeploy
touch /var/log/debug-quest-deploy.log
chown "$APP_USER:$APP_USER" /var/log/debug-quest-deploy.log

echo
echo "[setup] DONE."
echo "1) nano $APP_DIR/.env.production   # set APP_URL + API keys"
echo "2) sudo -u $APP_USER FORCE_DEPLOY=1 bash $APP_DIR/deploy/update.sh"
echo "3) sudo -u $APP_USER pm2 startup systemd -u $APP_USER --hp /home/$APP_USER"
echo "   (run the command it prints, then: sudo -u $APP_USER pm2 save)"
echo "Live updates: cron polls GitHub branch '$BRANCH' every 2 minutes."
