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

Resend campaign contact sync is configured with segment IDs in `.env`: `RESEND_WAITLIST_SEGMENT_ID`, `RESEND_GENERAL_SEGMENT_ID`, `RESEND_WORKER_SEGMENT_ID`, and `RESEND_FACILITY_SEGMENT_ID`. If your account still uses deprecated Resend audiences, use the matching `RESEND_*_AUDIENCE_ID` variables instead. Set `RESEND_SYNC_CONTACT_PROPERTIES=true` only after creating the MedShift custom properties in Resend.
