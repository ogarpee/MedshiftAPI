# MedShift Project Sprints & Tasks

## Sprint 1: Foundation & Infrastructure Setup
**Goal**: Set up the Monorepo, database connections, and core architecture.

### Story 1.1: Monorepo Setup
- [x] Initialize Nx or Turborepo for the project.
- [x] Setup `apps/api` (NestJS).
- [x] Setup `apps/web` (Next.js - Public/Worker/Facility).
- [x] Setup `apps/admin` (Next.js - Admin Dashboard).
- [x] Setup `packages/shared-types` (TypeScript interfaces/enums).
- [x] Setup `packages/ui-components` (React UI library).
- [x] Add a helper script to start the API and web development servers together.

### Story 1.2: Database & Core Config
- [x] Configure MongoDB connection in NestJS (Mongoose).
- [x] Setup environment variables (`.env`) for DB, JWT, and Resend.
- [x] Implement base database schemas (Users, Profiles, Shifts, Reviews).

## Sprint 2: Authentication & User Management
**Goal**: Allow workers, facilities, and admins to register, login, and manage profiles.

### Story 2.1: Authentication API (NestJS)
- [x] Implement JWT Auth module in NestJS.
- [x] Create Role-Based Access Control (RBAC) guards for WORKER, FACILITY, ADMIN.
- [x] Create login and registration endpoints.
- [x] Update authentication story to include email verification requirements.
- [x] Update authentication story to include forgot password and non-native action feedback requirements.

### Story 2.2: Email Verification
- [x] Add email verification fields to the user schema.
- [x] Generate and store hashed, expiring verification tokens during registration.
- [x] Send verification emails through the notification service.
- [x] Create endpoint to verify email tokens and activate eligible accounts.
- [x] Create endpoint to resend verification emails with token rotation.
- [x] Block login for unverified users with a verification-required response.
- [x] Build verification confirmation, resend, and result states in the web auth flow.

### Story 2.3: Forgot Password & Action Feedback
- [x] Add password reset fields to the user schema.
- [x] Generate and store hashed, expiring password reset OTPs.
- [x] Send password reset emails through the notification service.
- [x] Create endpoint to request a password reset with account-enumeration-safe response text.
- [x] Create endpoint to reset a password with OTP validation and token cleanup.
- [x] Build forgot-password and reset-password pages in the web auth flow.
- [x] Add a shared Next.js-compatible toast provider for web feedback.
- [x] Replace any native `alert()`, `confirm()`, or blocking browser prompts with toast and inline UI feedback.
- [x] Ensure all auth actions expose loading, success, and error states.
- [x] Add password visibility toggles and position forgot-password recovery near the password field.
- [x] Add the shared MedShift brand logo to all auth form-card brand headers.
- [x] Use icon-library controls for password visibility toggles.
- [x] Replace registration with email, OTP verification, and account-completion steps.
- [x] Auto-verify completed registration OTP input and hide alternate sign-in link during OTP entry.
- [x] Require facility work email during registration and use 123456 as non-production OTP.
- [x] Replace post-registration form repeat with congratulations and profile-completion guidance.
- [x] Convert forgot-password recovery to an email OTP reset flow.
- [x] Align registration account type selection with the public waitlist role cards.

### Story 2.4: User Profiles
- [x] Create `WorkerProfile` CRUD endpoints (including GeoJSON location fields).
- [x] Create `FacilityProfile` CRUD endpoints (including GeoJSON location fields).
- [x] Build Frontend Registration/Login forms (Next.js).

## Sprint 3: Shift Management (Facility Side)
**Goal**: Facilities can create, update, and list their shifts.

### Story 3.1: Shift API
- [x] Implement Shift CRUD endpoints in NestJS.
- [x] Enforce business rules (required fields: `roleRequired`, `startTime`, `endTime`, `hourlyRate`).

### Story 3.2: Facility Dashboard UI
- [x] Build UI modal to post a new shift (Role dropdown, Date/Time picker).
- [x] Build Dashboard UI to list active and upcoming shifts.
- [x] Display dashboard metrics (fill times, active shifts).
- [x] Convert facility active and upcoming shifts into an actionable table.
- [x] Remove the facility dashboard Ready to post side card.
- [x] Refine facility shifts table and make completed shifts clickable for review.
- [x] Open completed shift reviews in a modal and add edit action for open shifts.
- [x] Complete facility dashboard backend wiring for live cards, actions, shift posting, and realtime updates.
- [x] Remove onboarding and cross-portal links from the facility dashboard sidebar.
- [x] Make the facility active and upcoming shifts table span the full dashboard width.
- [x] Stop the facility side column from overlapping the full-width shifts table.
- [x] Restructure the facility dashboard into a cleaner operations layout.
- [x] Simplify the facility dashboard by removing chart clutter and tightening support panels.

## Sprint 4: Matching Engine & Real-Time Communications
**Goal**: Broadcast shifts in real-time and allow workers to accept them based on proximity.

### Story 4.1: Geospatial Matching API
- [x] Implement `2dsphere` query in NestJS to find shifts near a worker's location.
- [x] Create endpoint for workers to browse open shifts in their designated radius.

### Story 4.2: Real-time Socket.io Integration
- [x] Setup Socket.io Gateway in NestJS (`WebSocket` module).
- [x] Emit `shift.created` event when a facility posts a shift to nearby workers.
- [x] Emit `shift.accepted` event to the facility when a worker accepts.
- [x] Implement WebSocket client in Next.js.

### Story 4.3: Worker Dashboard UI
- [x] Build UI for workers to browse shifts (List/Map view toggle).
- [x] Build detailed Shift Card UI.
- [x] Build UI and flow for "Accept Shift" button.
- [x] Replace worker dashboard placeholder map with Mapbox shift pins and remove cross-portal navigation.
- [x] Integrate worker dashboard panels with live worker-owned shift, review, and realtime data.

## Sprint 5: Notifications & Admin Dashboard
**Goal**: Send transactional emails and provide oversight tools for admins.

### Story 5.1: Email Notifications
- [x] Integrate Resend API in a `NotificationModule`.
- [x] Send welcome emails upon waitlist/registration.
- [x] Wire the public landing waitlist form to send confirmation emails and surface delivery feedback.
- [x] Refine the public landing waitlist section with clearer role-specific early access messaging.
- [x] Capture role-specific waitlist details from workers and facilities.
- [x] Update waitlist fields and launch option sets for facility and worker audiences.
- [x] Sync waitlist and registered users into Resend campaign audiences by role.
- [x] Verify completed registrations send welcome emails before returning the session.
- [x] Send shift confirmation emails.
- [x] Implement persisted in-app notification center.
- [x] Refine transactional email templates and ensure configured Resend delivery works in development and production.

### Story 5.2: Admin Dashboard
- [x] Build UI data tables to view all Users, Facilities, and Shifts.
- [x] Build UI for verifying Worker credentials (approve/reject documents).
- [x] Add system health charts (e.g., active socket connections, shift fulfillment rates).
- [x] Add a repeatable seed command for a verified admin account.
- [x] Expand the admin dashboard into a management console for users, facilities, shifts, verification, and platform health.

## Sprint 6: Reviews, Polish & Launch Prep
**Goal**: Implement the dual-review system and finalize UI/UX.

### Story 6.1: Review System
- [x] Implement Review endpoints (Facility rates Worker, Worker rates Facility).
- [x] Build UI for submitting ratings after a shift is completed.
- [x] Update worker/facility average rating calculations.

### Story 6.2: Final UI Polish
- [x] Apply MedShift design system (Navy/Gold palette, Playfair/Poppins fonts).
- [x] Add glassmorphism effects and micro-animations to components.
- [x] Ensure mobile responsiveness across all portals, especially Worker app.
- [x] End-to-end user acceptance testing.
- [x] Improve the public site "How MedShift Works" section with an illustrative flow diagram.
- [x] Add placeholders and strengthen validation for all web form fields.
- [x] Replace public homepage login/join links with an authenticated profile menu when a user is signed in.
- [x] Refine the public site healthcare facilities section with stronger operational proof and CTA hierarchy.
- [x] Refine the public site healthcare professionals section with stronger shift-board proof and CTA hierarchy.
- [x] Reduce the public site healthcare professionals section content density.
- [x] Add balanced content to the healthcare professionals section and place the join CTA below it.
- [x] Fix healthcare professionals card formatting and balance the shift board preview content.
- [x] Stack waitlist form input fields one per line.
- [x] Widen waitlist form and align fields in a two-column desktop grid.
- [x] Polish worker dashboard facility review cards.
- [x] Refine general typography and use white text on gold-filled UI.

## Sprint 7: Role-Based Onboarding & Verification
**Goal**: Make registration actionable by routing users to the right dashboard and providing full onboarding for healthcare workers and facilities.

### Story 7.1: Role-Based Auth Routing
- [x] Redirect successful web sign-ins to the correct dashboard based on returned user role.
- [x] Remove transient success banner from login before dashboard/onboarding redirect.
- [x] Add configurable admin dashboard URL support for admin sign-in redirects.
- [x] Add regression coverage for worker, facility, and admin login route selection.
- [x] Document the standard dashboard shell with sidebar navigation, topbar, and main content area.
- [x] Implement the shared dashboard shell across worker, facility, and admin dashboards.
- [x] Refine dashboard shell with fixed sidebar, polished topbar, and modern content workspace.
- [x] Refine dashboard topbar with compact height, notification control, avatar, and contextual in-content controls.

### Story 7.2: Shared Onboarding Status
- [x] Add shared onboarding status types for `INCOMPLETE`, `PENDING_REVIEW`, `APPROVED`, and `REJECTED`.
- [x] Extend worker and facility profile schemas with onboarding completion and verification status fields.
- [x] Expose authenticated onboarding status endpoints for worker and facility users.
- [x] Gate shift acceptance and shift posting when onboarding is incomplete or not approved.

### Story 7.3: Worker Onboarding
- [x] Build worker profile completion UI for legal name, clinical role, location/radius, and availability preferences.
- [x] Build credential upload UI with document type, file metadata, and pending verification feedback.
- [x] Capture background-check consent and show review/approval status.
- [x] Route newly registered worker users from registration success to worker onboarding.
- [x] Route returning incomplete worker users to onboarding before the shift board.
- [x] Replace worker dashboard onboarding redirect/nav links with an in-content completion banner.
- [x] Add worker settings for updating profile, matching radius, availability, credentials, and onboarding setup data.
- [x] Polish worker settings layout into a clearer dashboard profile editor.
- [x] Remove outer padding from the worker settings content area.
- [x] Add balanced page-edge spacing around worker settings cards.
- [x] Replace worker settings summary cards with tabbed logical panels.
- [x] Simplify worker settings tabs to labels only.
- [x] Remove worker settings side card and refine form inputs/save placement.
- [x] Stack worker settings profile fields and fix input height.
- [x] Add placeholders to worker settings input fields.
- [x] Remove the Profile and matching banner from worker settings.
- [x] Stabilize the worker settings tab menu position.
- [x] Keep the worker settings save action visible with stable tabs.
- [x] Reduce dashboard onboarding banner height and show it across dashboard pages.

### Story 7.4: Facility Onboarding
- [x] Build facility profile completion UI for facility name, care setting, address/geolocation, and primary contact.
- [x] Build billing/readiness setup UI and status feedback.
- [x] Submit completed facility registrations into the admin verification queue.
- [x] Route newly registered facility users from registration success to facility onboarding.
- [x] Route returning incomplete facility users to onboarding before shift posting.
- [x] Add a repeatable verified facility seed for dashboard testing.

### Story 7.5: Admin Verification Operations
- [x] Add admin queue filters for worker credential review and facility registration review.
- [x] Add approve/reject actions that update onboarding verification status and rejected reason.
- [x] Send notification emails when onboarding verification is approved or rejected.
- [x] Add UAT coverage for complete worker and facility onboarding flows.

### Story 7.6: Onboarding Experience Refinement
- [x] Redesign worker and facility onboarding into distinct step-based layouts with logical completion flow.
- [x] Save each onboarding step as a draft so users can leave and resume later.
- [x] Add Mapbox-powered location preview/selection areas to onboarding location steps.
- [x] Update docs and UAT coverage for step drafts and Mapbox onboarding location UX.
- [x] Move onboarding out of the shared dashboard shell into standalone focused setup layouts.
- [x] Remove onboarding topbars and refine the setup flow into a full-screen professional layout.
- [x] Align onboarding rail and step card heights and pin step actions to the bottom.
- [x] Improve onboarding rail readability and pin only the rail save-draft button to the bottom.
- [x] Fix onboarding Mapbox rendering with a public-token Mapbox GL map and resilient fallback.
- [x] Add Cloudinary-backed worker credential file upload during onboarding.
- [x] Load web public env values from monorepo root and web app env files for Mapbox and Cloudinary.
- [x] Expand onboarding Mapbox panels to fill the available location-step container height.
- [x] Add Google Places address search to worker and facility location maps.
- [x] Polish location search visibility and provider-neutral address labels.
- [x] Prevent Google Places address suggestions from overlapping following inputs.
- [x] Route login directly to role onboarding when profile completion is required.
- [x] Polish onboarding left rail logo, status chip, and active step spacing.
- [x] Add green completed onboarding step states and improve step indicator spacing.

### Story 7.7: Launch Blocker Stabilization
- [x] Fix launch-blocking quality gates, approval-state handling, realtime auth, and live dashboard failure states.

### Story 7.8: Public Site Hero Polish
- [x] Make the hero shift preview card non-clickable.
- [x] Add Framer Motion reveal animations to landing page sections.
