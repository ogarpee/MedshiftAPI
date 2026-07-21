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
- [/] Implement JWT Auth module in NestJS.
- [/] Create Role-Based Access Control (RBAC) guards for WORKER, FACILITY, ADMIN.
- [/] Create login and registration endpoints.

### Story 2.2: User Profiles
- [/] Create `WorkerProfile` CRUD endpoints (including GeoJSON location fields).
- [/] Create `FacilityProfile` CRUD endpoints (including GeoJSON location fields).
- [/] Build Frontend Registration/Login forms (Next.js).

## Sprint 3: Shift Management (Facility Side)
**Goal**: Facilities can create, update, and list their shifts.

### Story 3.1: Shift API
- [ ] Implement Shift CRUD endpoints in NestJS.
- [ ] Enforce business rules (required fields: `roleRequired`, `startTime`, `endTime`, `hourlyRate`).

### Story 3.2: Facility Dashboard UI
- [ ] Build UI modal to post a new shift (Role dropdown, Date/Time picker).
- [ ] Build Dashboard UI to list active and upcoming shifts.
- [ ] Display dashboard metrics (fill times, active shifts).

## Sprint 4: Matching Engine & Real-Time Communications
**Goal**: Broadcast shifts in real-time and allow workers to accept them based on proximity.

### Story 4.1: Geospatial Matching API
- [ ] Implement `2dsphere` query in NestJS to find shifts near a worker's location.
- [ ] Create endpoint for workers to browse open shifts in their designated radius.

### Story 4.2: Real-time Socket.io Integration
- [ ] Setup Socket.io Gateway in NestJS (`WebSocket` module).
- [ ] Emit `shift.created` event when a facility posts a shift to nearby workers.
- [ ] Emit `shift.accepted` event to the facility when a worker accepts.
- [ ] Implement WebSocket client in Next.js.

### Story 4.3: Worker Dashboard UI
- [ ] Build UI for workers to browse shifts (List/Map view toggle).
- [ ] Build detailed Shift Card UI.
- [ ] Build UI and flow for "Accept Shift" button.

## Sprint 5: Notifications & Admin Dashboard
**Goal**: Send transactional emails and provide oversight tools for admins.

### Story 5.1: Email Notifications
- [ ] Integrate Resend API in a `NotificationModule`.
- [ ] Send welcome emails upon waitlist/registration.
- [ ] Send shift confirmation emails.

### Story 5.2: Admin Dashboard
- [ ] Build UI data tables to view all Users, Facilities, and Shifts.
- [ ] Build UI for verifying Worker credentials (approve/reject documents).
- [ ] Add system health charts (e.g., active socket connections, shift fulfillment rates).

## Sprint 6: Reviews, Polish & Launch Prep
**Goal**: Implement the dual-review system and finalize UI/UX.

### Story 6.1: Review System
- [ ] Implement Review endpoints (Facility rates Worker, Worker rates Facility).
- [ ] Build UI for submitting ratings after a shift is completed.
- [ ] Update worker/facility average rating calculations.

### Story 6.2: Final UI Polish
- [ ] Apply MedShift design system (Navy/Gold palette, Playfair/Poppins fonts).
- [ ] Add glassmorphism effects and micro-animations to components.
- [ ] Ensure mobile responsiveness across all portals, especially Worker app.
- [ ] End-to-end user acceptance testing.
