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
- [x] Generate and store hashed, expiring password reset tokens.
- [x] Send password reset emails through the notification service.
- [x] Create endpoint to request a password reset with account-enumeration-safe response text.
- [x] Create endpoint to reset a password with token validation and token cleanup.
- [x] Build forgot-password and reset-password pages in the web auth flow.
- [x] Add a shared Next.js-compatible toast provider for web feedback.
- [x] Replace any native `alert()`, `confirm()`, or blocking browser prompts with toast and inline UI feedback.
- [x] Ensure all auth actions expose loading, success, and error states.
- [x] Add password visibility toggles and position forgot-password recovery near the password field.

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

## Sprint 5: Notifications & Admin Dashboard
**Goal**: Send transactional emails and provide oversight tools for admins.

### Story 5.1: Email Notifications
- [x] Integrate Resend API in a `NotificationModule`.
- [x] Send welcome emails upon waitlist/registration.
- [x] Send shift confirmation emails.

### Story 5.2: Admin Dashboard
- [x] Build UI data tables to view all Users, Facilities, and Shifts.
- [x] Build UI for verifying Worker credentials (approve/reject documents).
- [x] Add system health charts (e.g., active socket connections, shift fulfillment rates).

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
