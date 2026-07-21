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
