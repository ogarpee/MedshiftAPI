# MedShift

MedShift is a healthcare shift marketplace monorepo with a NestJS API, Next.js public/worker/facility portal, Next.js admin dashboard, and shared TypeScript packages.

## Getting Started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Useful scripts:

- `pnpm api:dev` starts the NestJS API.
- `pnpm web:dev` starts the public/worker/facility portal.
- `pnpm admin:dev` starts the admin dashboard.
- `pnpm typecheck` checks TypeScript across workspaces.
- `pnpm deploy:build`, `pnpm deploy:up`, and `pnpm deploy:logs` operate the production Docker Compose stack after `.env.production` is configured.

Resend campaign contact sync is configured with segment IDs in `.env`: `RESEND_WAITLIST_SEGMENT_ID`, `RESEND_GENERAL_SEGMENT_ID`, `RESEND_WORKER_SEGMENT_ID`, and `RESEND_FACILITY_SEGMENT_ID`. If your account still uses deprecated Resend audiences, use the matching `RESEND_*_AUDIENCE_ID` variables instead. Set `RESEND_SYNC_CONTACT_PROPERTIES=true` only after creating the MedShift custom properties in Resend.

## Deployment

Hostinger VPS deployment is documented in [docs/hostinger-vps-deployment.md](docs/hostinger-vps-deployment.md). Copy `.env.production.example` to `.env.production`, replace the example domains/secrets, update `deploy/nginx/default.conf`, then run the production Docker Compose commands from the runbook.

CI/CD setup is documented in [docs/ci-cd.md](docs/ci-cd.md). Pull requests run tests, type checks, builds, and Compose config validation; successful `main` builds deploy to the Hostinger VPS through GitHub Actions.
