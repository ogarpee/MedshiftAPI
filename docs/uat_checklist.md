# MedShift User Acceptance Checklist

Use this checklist for launch-readiness passes after `pnpm typecheck`, `pnpm build`, and `pnpm uat:smoke` pass.

## Public Site
- [ ] Landing page loads with visible MedShift logo, favicon, hero copy, and waitlist form.
- [ ] Worker/facility waitlist tabs switch cleanly on mobile and desktop.
- [ ] Waitlist submission posts to the API when available and still gives clear fallback feedback.

## Authentication
- [ ] Login and registration pages have distinct layouts and preserve the 50/50 auth brand/form split on desktop.
- [ ] Form labels, inputs, and buttons remain readable on mobile widths.
- [ ] Successful login stores `medshift.accessToken`.

## Worker Portal
- [ ] Worker dashboard loads preview shifts without auth and live nearby shifts with a worker token.
- [ ] List/map toggle does not resize or overlap the shift detail panel.
- [ ] Accept Shift posts to the API for live shifts and updates the UI state.
- [ ] Completed shifts show the facility review form and submit to `/reviews/shifts/:id`.
- [ ] Worker onboarding advances through logical steps and saves each step as a resumable draft.
- [ ] Worker onboarding location step shows an interactive Mapbox map when `NEXT_PUBLIC_MAPBOX_TOKEN` or `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is configured and a fallback map state otherwise.
- [ ] Worker onboarding credential upload sends files to Cloudinary when `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` are configured, then stores the returned secure URL.

## Facility Portal
- [ ] Facility dashboard loads preview shifts without auth and live shifts with a facility token.
- [ ] Post Shift modal validates required role, time window, rate, and location payload.
- [ ] Completed shifts show the worker review form and submit to `/reviews/shifts/:id`.
- [ ] Dashboard metrics update from the current shift list.
- [ ] Facility onboarding advances through logical steps and saves each step as a resumable draft.
- [ ] Facility onboarding service-address step shows an interactive Mapbox map when `NEXT_PUBLIC_MAPBOX_TOKEN` or `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is configured and a fallback map state otherwise.

## Admin Portal
- [ ] Admin dashboard loads preview data without a token and live data with an admin token.
- [ ] Users, facilities, and shifts tables switch without layout shift.
- [ ] Credential approve/reject controls call the admin credential endpoint.
- [ ] Verification queue filters switch between all, worker, and facility review items.
- [ ] Worker onboarding approve/reject controls update verification status and require a reason for rejection.
- [ ] Facility onboarding approve/reject controls update verification status and require a reason for rejection.
- [ ] Onboarding approval/rejection sends the appropriate notification email or logs the skipped email in local development.
- [ ] Health bars reflect open shifts, verification rate, and active socket connections.

## Review System
- [ ] Facility users can review only completed matched shifts they own.
- [ ] Worker users can review only completed matched shifts they worked.
- [ ] Duplicate reviews for the same shift/reviewer are rejected.
- [ ] Worker and facility average ratings recalculate after review submission.

## Responsive & Motion
- [ ] Web and admin portals are usable at 375px, 768px, and 1280px widths.
- [ ] Text does not overflow buttons, tables, cards, or auth panels.
- [ ] Glass effects and hover/focus states are visible but restrained.
- [ ] Reduced-motion settings disable nonessential animation.
