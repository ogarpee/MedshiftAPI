# MedShift User Acceptance Checklist

Use this checklist for launch-readiness passes after `pnpm typecheck`, `pnpm build`, and `pnpm uat:smoke` pass.

## Public Site
- [ ] Landing page loads with visible MedShift logo, favicon, hero copy, and waitlist form.
- [ ] Worker/facility waitlist tabs switch cleanly on mobile and desktop.
- [ ] Worker and facility waitlist submissions show the correct role-specific fields and persist the submitted details.
- [ ] Waitlist submission posts to the API when available and still gives clear fallback feedback.
- [ ] Waitlist submissions sync to the configured Resend waitlist campaign group, and completed registrations sync to general plus worker/facility role groups.

## Authentication
- [ ] Login and registration pages have distinct layouts and preserve the 50/50 auth brand/form split on desktop.
- [ ] Form labels, inputs, and buttons remain readable on mobile widths.
- [ ] Successful web/admin login uses HttpOnly session cookies, exposes no JWT to browser storage or the URL, and rejects unsafe cookie requests without trusted-origin/CSRF validation.
- [ ] Correct-password login for an unverified legacy account automatically sends or reuses a recently sent verification link, creates no session, and reports the outcome through a toast only.
- [ ] Login has no inline verification card or resend button; registration keeps Resend code and the invalid/expired verification-link page keeps its recovery resend form.
- [ ] Login, registration, password recovery, and verification actions do not duplicate transient toast results as inline card messages.
- [ ] Authenticator and email 2FA enrollment each produce usable recovery codes; challenged login creates no session until a valid factor or unused recovery code is entered.
- [ ] Trusted-device selection skips only the second factor after a correct password for up to 30 days, and individual/all-device revocation takes effect immediately.

## Worker Portal
- [ ] Worker dashboard rejects expired/unauthorized sessions and loads only worker-owned live data after authentication.
- [ ] Worker dashboard metrics, earnings, weekly schedule, and review cards derive from worker-owned shifts and submitted reviews.
- [ ] Realtime `shift.created` refreshes nearby open matches and realtime `shift.accepted` removes unavailable open shifts.
- [ ] List/map toggle does not resize or overlap the shift detail panel.
- [ ] Accept Shift posts to the API for live shifts and updates the UI state.
- [ ] Completed shifts show the facility review form and submit to `/reviews/shifts/:id`.
- [ ] Worker Find Shifts and Reviews fill the dashboard workspace, use full-width readable records on desktop, and stack without horizontal overflow on tablet/mobile; facility worker search, roster, and review queues also fill their available workspace.
- [ ] Web and Flutter Find Shifts search facility, city, role, title, and description after a 350 ms debounce; checked multi-role, facility-type, and Alberta-time shift-period filters produce equivalent results and retain the current result list while refreshing.
- [ ] Filter surfaces expose Apply, Clear all, active count, removable chips, empty/error/retry states, and preserve legacy singular API query compatibility.
- [ ] Flutter Home, Find Shifts, Schedule, Earnings, Profile, and Notifications use consistent full-width card spacing with equal overview metric columns and no overflow at narrow widths or large text scale.
- [ ] Every Flutter worker tab shows the correct Continue, Update, or Review onboarding action until approval; the Profile tab independently renders canonical profile data or an explicit skeleton, offline, empty, or retry state.
- [ ] Flutter Profile shows one clickable onboarding card for incomplete, rejected, pending-review, and approved states; it resumes saved edits or opens populated Review and does not duplicate the shared dashboard banner.
- [ ] Worker onboarding saves every field, document, and active-step change locally and server-side, resumes the last step across web and mobile, and preserves device progress during an offline/API failure.
- [ ] Save and continue stores the latest snapshot before navigation, prevents duplicate clicks and stale autosave overwrites, and restores the same data and step after browser/app restart.
- [ ] A new worker with an empty onboarding-draft response loads Step 1 without a JSON/profile error; the web progress rail has no dynamic technical paragraph or Retry loading profile button.
- [ ] A restored Flutter session preserves an onboarding deep link, and an offline or failed server-draft request renders saved device progress without waiting for synchronization.
- [ ] If Flutter cannot hydrate a known submitted profile, local onboarding fields remain visible but blank/default submission is blocked until canonical data can be loaded.
- [ ] Find Shifts renders its search and Filters control at narrow mobile widths without infinite-width layout exceptions.
- [ ] Existing pending, rejected, and approved worker profiles reopen prefilled on Review rather than restarting; approved-sensitive edits explain and trigger pending review.
- [ ] A lost first-submission response followed by repeated `PUT /worker-profiles/me` or legacy POST updates the same worker profile without `409` or duplicates, including simultaneous first saves.
- [ ] Draft sync ignores cached client profile IDs, retains unsynchronized device changes, and succeeds through automatic or explicit Retry sync; an expected profile hydration failure blocks blank submission without exposing raw API data.
- [ ] Worker Review displays all identity, service-area, availability, and document details, reports invalid sections, previews private documents, and returns to the correct step through Edit actions.
- [ ] Worker onboarding location step shows an interactive Mapbox map when `NEXT_PUBLIC_MAPBOX_TOKEN` or `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is configured and a fallback map state otherwise.
- [ ] Worker onboarding and worker settings location search prefill coordinates and reposition the Mapbox pin when `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` is configured.
- [ ] Worker onboarding Step 4 shows no credential-type, document-URL, or background-consent inputs and blocks submission until government ID, professional certificate/licence, and background-check documents are uploaded.
- [ ] Web and mobile request signed uploads, send PDF/JPG/PNG/WEBP files under 10 MB to private Cloudinary storage, validate completion, and support progress, retry, preview, replacement, removal, and up to 10 documents.
- [ ] Worker settings loads `/worker-profiles/me`, lets workers update profile, matching radius/location, availability, and categorized documents, and returns approved profiles to pending review after document changes.
- [ ] Workers can access only their own document previews, admins can access review documents, and generated access URLs expire after five minutes.
- [ ] Worker web Settings and Flutter Profile independently load and save in-app/email notification preferences without hiding canonical profile content when the preference request fails.
- [ ] Account/security alerts remain visibly always on; optional shift, assignment, schedule/timesheet, review, and dispute channels honor the saved preference.
- [ ] Worker web and Flutter security sections support password change, both 2FA methods, recovery-code regeneration, trusted-device removal, and sign-out-all with user-friendly loading and error feedback.
- [ ] Flutter security actions use keyboard-safe bottom drawers, validate password confirmation and six-digit setup codes, require confirmation for destructive device/session actions, and keep one-time recovery codes visible until acknowledged.

## Facility Portal
- [ ] Facility dashboard rejects expired/unauthorized sessions and loads only facility-owned live data after authentication.
- [ ] Post Shift modal validates required role, time window, rate, and location payload.
- [ ] Completed shifts show the worker review form and submit to `/reviews/shifts/:id`.
- [ ] Dashboard metrics update from the current shift list.
- [ ] Facility onboarding advances through logical steps and saves each step as a resumable draft.
- [ ] Facility onboarding service-address step shows an interactive Mapbox map when `NEXT_PUBLIC_MAPBOX_TOKEN` or `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is configured and a fallback map state otherwise.
- [ ] Facility onboarding Google Places search prefills street, city, province, postal code, coordinates, and repositions the Mapbox pin when `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` is configured.

## Admin Portal
- [ ] Admin dashboard requires an active admin cookie session and never receives credentials through a URL fragment.
- [ ] Users, facilities, and shifts tables switch without layout shift.
- [ ] Credential approve/reject controls call the admin credential endpoint.
- [ ] Verification queue filters switch between all, worker, and facility review items.
- [ ] Worker onboarding approve/reject controls update verification status and require a reason for rejection.
- [ ] Facility onboarding approve/reject controls update verification status and require a reason for rejection.
- [ ] Onboarding approval/rejection sends the appropriate notification email or logs the skipped email in local development.
- [ ] Platform health panel reflects open shifts, verification rate, and active socket connections.

## Review System
- [ ] Facility users can review only completed matched shifts they own.
- [ ] Worker users can review only completed matched shifts they worked.
- [ ] Duplicate reviews for the same assignment/reviewer are rejected.
- [ ] Worker and facility average ratings recalculate after review submission.

## Launch MVP Lifecycle And Sessions
- [ ] Web/admin sessions use secure cookies and CSRF protection without URL or local-storage token transfer.
- [ ] Mobile access expiry rotates the refresh token and retries the original request once.
- [ ] Password change, logout-all, and suspension revoke existing HTTP and Socket.io access.
- [ ] Concurrent quick accepts never exceed `caregiversRequired`.
- [ ] Worker history, attendance, timesheets, and reviews show every caregiver assignment on a multi-caregiver shift.
- [ ] Workers cannot read or mutate another worker's application, invitation, attendance, timesheet, or dispute.
- [ ] Attendance idempotency cannot overwrite an existing event and invalid sequences are rejected.
- [ ] A shift completes only after every active assignment is complete and every timesheet is approved.
- [ ] Facilities can review each caregiver once; workers can review the facility once per assignment.
- [ ] Only admins can resolve or reject disputes.

## Responsive & Motion
- [ ] Web and admin portals are usable at 375px, 768px, and 1280px widths.
- [ ] Text does not overflow buttons, tables, cards, or auth panels.
- [ ] Glass effects and hover/focus states are visible but restrained.
- [ ] Reduced-motion settings disable nonessential animation.
