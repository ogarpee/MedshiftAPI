# Hostinger VPS Deployment

This runbook deploys MedShift to a Hostinger VPS with Docker Compose, Nginx, MongoDB, the NestJS API, the public/worker/facility Next.js app, and the admin Next.js app.

## Target Topology

- `https://medshift.example.com` -> `apps/web`
- `https://admin.medshift.example.com` -> `apps/admin`
- `https://api.medshift.example.com` -> `apps/api`
- MongoDB runs inside the compose network with data persisted in the `medshift_mongo_data` Docker volume.

Replace the example domains with the real production domains before launch.

## 1. Point DNS at the VPS

In Hostinger DNS, create `A` records pointing at the VPS IPv4 address:

```text
medshift.example.com        A    <vps-ip>
www.medshift.example.com    A    <vps-ip>
admin.medshift.example.com  A    <vps-ip>
api.medshift.example.com    A    <vps-ip>
```

Wait for DNS propagation before requesting TLS certificates.

## 2. Prepare the VPS

SSH into the server as a sudo-capable user:

```bash
ssh root@<vps-ip>
```

Install Docker, Compose, Git, and Certbot:

```bash
apt update
apt install -y ca-certificates curl gnupg git ufw certbot python3-certbot-nginx
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Open web and SSH ports:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

## 3. Upload the App

Clone the repository on the VPS:

```bash
mkdir -p /opt/medshift
git clone <repo-url> /opt/medshift
cd /opt/medshift
```

If the repo is private, set up deploy keys or use a GitHub access token on the VPS.

## 4. Configure Production Values

Create the production env file:

```bash
cp .env.production.example .env.production
nano .env.production
```

Set these values at minimum:

- `WEB_ORIGIN=https://<web-domain>`
- `ADMIN_ORIGIN=https://<admin-domain>`
- `SOCKET_ORIGINS=https://<web-domain>,https://<admin-domain>`
- `NEXT_PUBLIC_API_URL=https://<api-domain>`
- `NEXT_PUBLIC_ADMIN_URL=https://<admin-domain>`
- `JWT_SECRET=<long random value>`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and segment IDs when email delivery is ready
- `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`, and Cloudinary values when those integrations are ready

Generate a strong JWT secret:

```bash
openssl rand -base64 48
```

Update `deploy/nginx/default.conf` and replace every `medshift.example.com` domain with the real domains.

## 5. Build and Start

Build the containers and start the stack:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Check container status:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
```

## 6. Enable HTTPS

After DNS points at the VPS and Nginx is serving HTTP, request certificates:

```bash
certbot --nginx \
  -d medshift.example.com \
  -d www.medshift.example.com \
  -d admin.medshift.example.com \
  -d api.medshift.example.com
```

Choose the redirect-to-HTTPS option. Certbot will update the active Nginx config on the host; keep a copy of any production TLS changes if you later replace `deploy/nginx/default.conf`.

Test renewal:

```bash
certbot renew --dry-run
```

## 7. Seed Admin Access

With `.env.production` configured, run the admin seed inside the API container:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec api pnpm --filter @medshift/api seed:admin
```

The seed reads `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` from `.env.production`.

## 8. Smoke Test

Verify the public app, admin app, API health, and realtime proxy:

```bash
curl -I https://medshift.example.com
curl -I https://admin.medshift.example.com
curl https://api.medshift.example.com/health
docker compose -f docker-compose.prod.yml logs --tail=100 api
```

Then complete these manual checks:

- Public waitlist form reaches the API and shows non-blocking feedback.
- Registration OTP emails are sent by Resend.
- Worker/facility login routes to onboarding when profiles are incomplete.
- Admin sign-in loads live API data.
- Creating a shift emits realtime updates without Socket.io connection errors.

## 9. Update an Existing Deployment

From `/opt/medshift`:

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker image prune -f
```

If any `NEXT_PUBLIC_*` value changes, rebuild the affected Next.js images because those values are bundled at build time.

Automated deploys are handled by GitHub Actions after CI succeeds on `main`. See `docs/ci-cd.md` for the required GitHub secrets and workflow behavior.

## 10. Backups

MongoDB data lives in the Docker volume `medshift_mongo_data`. Create a backup directory and dump the database:

```bash
mkdir -p /opt/medshift-backups
docker compose -f docker-compose.prod.yml exec mongo mongodump --archive=/tmp/medshift.archive
docker cp "$(docker compose -f docker-compose.prod.yml ps -q mongo)":/tmp/medshift.archive /opt/medshift-backups/medshift-$(date +%Y%m%d%H%M).archive
```

Copy backups off the VPS regularly before launch.
