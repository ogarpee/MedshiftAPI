# CI/CD

MedShift uses GitHub Actions for pull request checks and Hostinger VPS deployment.

## Workflows

- `.github/workflows/ci.yml`
  - Runs on pull requests and pushes to `main`.
  - Installs dependencies with pnpm.
  - Runs `pnpm test`, `pnpm typecheck`, and `pnpm build`.
  - Validates `docker-compose.prod.yml` with `.env.production.example`.

- `.github/workflows/deploy-hostinger.yml`
  - Runs after the `CI` workflow succeeds on `main`.
  - Can also be started manually from GitHub Actions with `workflow_dispatch`.
  - SSHes into the Hostinger VPS, checks out the exact commit, builds the Docker Compose stack, starts it, prints service status, and prunes unused images.

## Required GitHub Secrets

Configure these in GitHub under `Settings -> Secrets and variables -> Actions`.

```text
HOSTINGER_HOST=<vps-ip-or-hostname>
HOSTINGER_USER=<ssh-user>
HOSTINGER_SSH_KEY=<private-ssh-key-for-that-user>
HOSTINGER_SSH_PORT=22
HOSTINGER_DEPLOY_PATH=/opt/medshift
```

`HOSTINGER_SSH_PORT` and `HOSTINGER_DEPLOY_PATH` can be omitted if the VPS uses port `22` and `/opt/medshift`.

## VPS Requirements

Before the first automated deploy, complete the Hostinger setup in `docs/hostinger-vps-deployment.md`:

- Docker and Docker Compose plugin installed.
- Repository cloned at `HOSTINGER_DEPLOY_PATH`.
- `.env.production` created on the VPS and filled with production values.
- `deploy/nginx/default.conf` domains set to the real production domains.
- SSH user can run `git` and `docker compose`.

For private repositories, the VPS also needs permission to fetch from GitHub. Use a deploy key, machine user, or HTTPS token setup that works non-interactively for `git fetch`.

## Deployment Flow

1. Open a pull request.
2. CI runs checks and production build validation.
3. Merge to `main`.
4. CI runs again on `main`.
5. When CI succeeds, the deploy workflow connects to Hostinger and runs:

```bash
git fetch origin "$DEPLOY_SHA"
git checkout --force "$DEPLOY_SHA"
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
docker image prune -f
```

## Rollback

Use the manual deploy workflow against a known-good commit, or SSH into the VPS and run:

```bash
cd /opt/medshift
git checkout --force <known-good-sha>
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```
