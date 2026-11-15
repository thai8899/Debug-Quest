# Vultr deploy

Branch tracked by the server: **`jayavarapu/vultr-deploy`**

Auto-update: every 2 minutes the VPS runs `deploy/update.sh`  
→ if GitHub moved → `npm ci` + `npm run build` + `pm2 restart`

## Vultr console (one-time)

See the chat / steps from the team: Deploy Ubuntu 24.04, ≥1 GB RAM, attach SSH key, copy public IP, then SSH and run `deploy/setup-vultr.sh`.
