# MedShift Launch MVP Review And Traceability

## Decision Record

The launch MVP includes authentication, role onboarding and approval, shift discovery and posting, applications, invitations, quick acceptance, multi-caregiver assignments, attendance, timesheets, disputes, reviews, persisted notifications, realtime refresh, and admin operations. Payments/payout processing, background push notifications, direct messaging, and horizontally scaled Redis realtime are deferred. Earnings shown in clients are estimates from approved timesheets.

## Gap Register

| Severity | Gap | Actors | Evidence | Remediation | Status |
| --- | --- | --- | --- | --- | --- |
| Critical | Browser bearer tokens survived suspension/password changes | All authenticated users | Browser auth previously persisted JWTs; guards trusted token claims alone | Persisted rotating sessions, active-user checks, cookie/origin-CSRF path, mobile refresh rotation | Implemented; Mongo journey pending CI evidence |
| Critical | Legacy quick accept bypassed assignments and multi-caregiver capacity | Worker, facility | `/shifts/:id/accept` wrote `matchedWorkerId` directly | Quick accept now calls the canonical assignment service | Implemented; Mongo journey pending CI evidence |
| Critical | Concurrent staffing could overfill a shift | Worker, facility | Capacity was calculated with a non-atomic count | Atomic `activeAssignmentCount` reservation, transaction path, safe standalone fallback, unique worker/shift assignment | Implemented; concurrent CI journey added |
| High | Workers could request other workers' application/invitation lists | Worker | Shift-level lists had no worker ownership filter | Role-scoped queries restrict records to the authenticated worker | Implemented |
| High | Attendance idempotency keys could overwrite another event | Worker, facility | Upsert semantics allowed identity fields to change | Immutable key ownership plus event identity, sequence, and timestamp validation | Implemented |
| High | Reviews assumed one `matchedWorkerId` | Worker, facility | Review target resolved from the legacy shift field | Reviews link to assignments with per-assignment uniqueness | Implemented |
| High | Disputes could be created without an owned marketplace record | Worker, facility, admin | Subject IDs and participant access were not resolved consistently | Subject resolution, participant capture, and admin-only resolution | Implemented |
| High | Canonical database documentation omitted marketplace data | Engineering, operations | Architecture/database docs omitted sessions and marketplace collections | Full ER model, collection documentation, and indexes | Complete |
| Medium | Mobile registration used the wrong completion-token field | Worker | Flutter sent `completionToken`; API expects `registrationToken` | Client/API contract aligned and rotating refresh retry added | Implemented; Flutter gates pass |
| Medium | Health check did not verify MongoDB | Operations | `/health` returned static process state | Database ping plus container health dependencies | Implemented; Compose config passes |
| Medium | Existing smoke tests inspected source strings | Engineering | `uat-smoke.mjs` remains a structural compatibility gate | Mongo-backed runtime journey added; Playwright and completed manual UAT remain required | Partial |

## Use Cases

```mermaid
flowchart LR
  Visitor((Visitor)) --> Waitlist[Join waitlist]
  Visitor --> Register[Register and verify email]
  Worker((Worker)) --> WorkerOnboarding[Complete worker onboarding]
  Worker --> Discover[Discover matching shifts]
  Worker --> Apply[Apply or quick accept]
  Worker --> InviteResponse[Respond to invitation]
  Worker --> Attendance[Clock in, break, clock out]
  Worker --> Timesheet[Submit timesheet]
  Worker --> WorkerReview[Review facility]
  Worker --> Dispute[Open dispute]
  Facility((Facility)) --> FacilityOnboarding[Complete facility onboarding]
  Facility --> PostShift[Post multi-caregiver shift]
  Facility --> Select[Review applications and assign]
  Facility --> Invite[Invite qualified worker]
  Facility --> ApproveTimesheet[Approve or request correction]
  Facility --> FacilityReview[Review each caregiver assignment]
  Admin((Admin)) --> Verify[Approve onboarding and credentials]
  Admin --> Moderate[Manage users and shifts]
  Admin --> Resolve[Resolve disputes]
  Admin --> Audit[Inspect audit events]
  Resend[(Resend)] --- Register
  Cloudinary[(Cloudinary)] --- WorkerOnboarding
  Maps[(Mapbox / Places)] --- Discover
```

## Authentication And Onboarding Flow

```mermaid
sequenceDiagram
  actor User
  participant Client as Web or Mobile
  participant API
  participant DB as MongoDB
  participant Email as Resend
  User->>Client: Submit role and email
  Client->>API: POST /auth/register/start
  API->>DB: Store hashed expiring OTP
  API->>Email: Send OTP
  User->>Client: Enter OTP and password
  Client->>API: Verify OTP, then complete registration
  API->>DB: Create pending user and revocable session
  API-->>Client: Cookie session or mobile access/refresh tokens
  Client->>API: Submit role profile
  API->>DB: Set PENDING_REVIEW
  Admin->>API: Approve onboarding
  API->>DB: Activate account/profile
  API->>Email: Send approval notice
```

## Staffing Flow

```mermaid
flowchart TD
  Post[Facility posts open shift] --> Broadcast[Match and notify qualified workers]
  Broadcast --> Choice{Worker action}
  Choice -->|Apply| Application[Application APPLIED]
  Choice -->|Quick accept| Reserve[Atomically reserve capacity]
  Choice -->|Invitation| Invitation[Invitation PENDING]
  Application --> Select[Facility selects application]
  Invitation --> AcceptInvite[Worker accepts invitation]
  Select --> Reserve
  AcceptInvite --> Reserve
  Reserve --> Assignment[Assignment CONFIRMED]
  Assignment --> Capacity{Capacity filled?}
  Capacity -->|No| Post
  Capacity -->|Yes| Assigned[Shift ASSIGNED]
  Assigned --> ClockIn[Assignment IN_PROGRESS]
  ClockIn --> ClockOut[Assignment COMPLETED]
  ClockOut --> Submit[Timesheet SUBMITTED]
  Submit --> Review{Facility review}
  Review -->|Correction| Submit
  Review -->|Approve all| Complete[Shift COMPLETED]
  Complete --> Ratings[Per-assignment reviews]
```

## Lifecycle States

```mermaid
stateDiagram-v2
  [*] --> OPEN
  OPEN --> ASSIGNED: capacity filled
  OPEN --> CANCELLED
  OPEN --> EXPIRED
  ASSIGNED --> IN_PROGRESS: first clock-in
  ASSIGNED --> CANCELLED
  ASSIGNED --> NO_SHOW
  IN_PROGRESS --> TIMESHEET_SUBMITTED: all active assignments complete and submitted
  IN_PROGRESS --> DISPUTED
  TIMESHEET_SUBMITTED --> COMPLETED: all timesheets approved
  TIMESHEET_SUBMITTED --> DISPUTED
  DISPUTED --> COMPLETED: admin resolves
  DISPUTED --> CANCELLED: admin cancels
```

```mermaid
stateDiagram-v2
  state Application {
    [*] --> APPLIED
    APPLIED --> UNDER_REVIEW
    APPLIED --> SELECTED
    APPLIED --> DECLINED
    APPLIED --> WITHDRAWN
    UNDER_REVIEW --> SELECTED
    UNDER_REVIEW --> DECLINED
    UNDER_REVIEW --> WITHDRAWN
    SELECTED --> CONFIRMED
  }
  state Invitation {
    [*] --> PENDING
    PENDING --> ACCEPTED
    PENDING --> DECLINED
    PENDING --> CANCELLED
    PENDING --> EXPIRED
  }
  state Assignment {
    [*] --> CONFIRMED
    CONFIRMED --> IN_PROGRESS
    CONFIRMED --> CANCELLED
    CONFIRMED --> NO_SHOW
    IN_PROGRESS --> COMPLETED
    IN_PROGRESS --> CANCELLED
  }
  state Timesheet {
    [*] --> SUBMITTED
    SUBMITTED --> APPROVED
    SUBMITTED --> CORRECTION_REQUESTED
    SUBMITTED --> DISPUTED
    CORRECTION_REQUESTED --> SUBMITTED
  }
```

## Attendance, Timesheet, Dispute, And Review Sequence

```mermaid
sequenceDiagram
  actor Worker
  actor Facility
  actor Admin
  participant API
  participant DB as MongoDB
  Worker->>API: Clock in (assignment + idempotency key)
  API->>DB: Validate ownership, sequence, time, optional GPS
  Worker->>API: Break events and clock out
  API->>DB: Complete assignment and recompute shift
  Worker->>API: Submit calculated timesheet
  API->>DB: Lock submitted timesheet
  alt Correction required
    Facility->>API: Request correction
    API-->>Worker: Persist notification
    Worker->>API: Correct and resubmit
  else Approved
    Facility->>API: Approve timesheet
    API->>DB: Recompute all-assignment completion
  end
  Worker->>API: Review facility for assignment
  Facility->>API: Review caregiver for assignment
  Worker->>API: Open dispute against accessible record
  API->>DB: Save participants and history context
  Admin->>API: Resolve or reject dispute
  API->>DB: Persist resolution and audit event
```

## Current Component Architecture

```mermaid
flowchart LR
  Web[Next.js public, worker, facility] -->|REST + secure cookies| API[NestJS API]
  Admin[Next.js admin] -->|REST + secure cookies| API
  Mobile[Flutter worker app] -->|REST + access/refresh tokens| API
  Web <-->|Socket.io| API
  Mobile <-->|Socket.io| API
  API --> Mongo[(MongoDB)]
  API --> Resend[Resend]
  Web --> Cloudinary[Cloudinary unsigned upload]
  Web --> Maps[Mapbox / Google Places]
  Mobile --> Maps
  Nginx[Nginx TLS proxy] --> Web
  Nginx --> Admin
  Nginx --> API
```

## Database ER Diagram

```mermaid
erDiagram
  USERS ||--o{ SESSIONS : owns
  USERS ||--o| WORKER_PROFILES : has
  USERS ||--o| FACILITY_PROFILES : has
  USERS ||--o{ NOTIFICATIONS : receives
  USERS ||--o{ AUDIT_EVENTS : performs
  FACILITY_PROFILES ||--o{ SHIFTS : posts
  SHIFTS ||--o{ SHIFT_APPLICATIONS : receives
  SHIFTS ||--o{ SHIFT_INVITATIONS : offers
  SHIFTS ||--o{ SHIFT_ASSIGNMENTS : staffs
  WORKER_PROFILES ||--o{ SHIFT_APPLICATIONS : submits
  WORKER_PROFILES ||--o{ SHIFT_INVITATIONS : receives
  WORKER_PROFILES ||--o{ SHIFT_ASSIGNMENTS : accepts
  SHIFT_ASSIGNMENTS ||--o{ ATTENDANCE_EVENTS : records
  SHIFT_ASSIGNMENTS ||--o| TIMESHEETS : produces
  SHIFT_ASSIGNMENTS ||--o{ REVIEWS : scopes
  SHIFT_ASSIGNMENTS ||--o{ DISPUTES : concerns
  SHIFTS ||--o{ DISPUTES : concerns
  TIMESHEETS ||--o{ DISPUTES : concerns
  REVIEWS ||--o{ DISPUTES : concerns
  USERS ||--o{ DISPUTES : opens
  REGISTRATION_ATTEMPTS }o--|| USERS : becomes
```

## Feature Traceability

| Use case | API | Client surfaces | Collections | Realtime/notification | Automated evidence |
| --- | --- | --- | --- | --- | --- |
| Registration/session | `/auth/register/*`, `/auth/login`, `/auth/refresh`, `/auth/logout*` | Web auth, admin auth, Flutter auth | users, sessions, registration_attempts | Registration/onboarding email | `launch-mvp.e2e.mjs`; Flutter auth tests |
| Onboarding approval | `/worker-profiles`, `/facility-profiles`, `/admin/*/onboarding` | Worker/facility setup, admin queue | users, worker_profiles, facility_profiles | Persisted + email review result | Mongo launch journey |
| Shift discovery/posting | `/shifts`, `/matching/*` | Worker shift board, facility shifts, mobile board | shifts, profiles | `shift.created`; match notification | Root regression tests; Mongo launch journey |
| Staffing | applications, invitations, assignments, quick accept | Worker/facility marketplace, mobile | shift_applications, shift_invitations, shift_assignments, shifts | application/invitation/assignment notifications; `shift.accepted` | Concurrent three-worker/two-capacity journey |
| Attendance/timesheet | `/attendance/*`, `/timesheets` | Worker work, facility marketplace, mobile work | attendance_events, timesheets, assignments | Attendance and timesheet notifications | Multi-caregiver completion journey |
| Reviews/disputes | `/reviews`, `/disputes` | Worker/facility/admin workflows | reviews, disputes, assignments | Review availability and dispute notifications | Per-assignment review/dispute journey |
| Notifications/realtime | `/notifications`, authenticated Socket.io | All dashboards, mobile center | notifications, sessions | Authenticated user/facility rooms | Root socket regression tests; Mongo launch journey |

## Deferred Roadmap

- Payment processor, payout ledger, reconciliation, refunds, tax reporting, and settlement webhooks.
- Background mobile push delivery; launch provides persisted notifications and foreground realtime refresh.
- Direct worker/facility messaging and moderation.
- Redis Socket.io adapter and cache layer when the API scales beyond one realtime process.
- Formal privacy, legal, accessibility, and security certification by qualified specialists.
