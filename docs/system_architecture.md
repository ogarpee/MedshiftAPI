# System Architecture Specification: MedShift

## 1. Overview
MedShift is built as a **Monorepo** to promote code sharing, maintainability, and consistency across the stack. The application consists of Next.js frontends (Public/Facility/Worker portals and Admin dashboard) and a NestJS backend API, powered by a MongoDB database.

The architecture adheres to **SOLID** principles, ensuring that components are modular, decoupled, and easily testable.

## 2. High-Level Architecture Diagram
```mermaid
graph TD
    subgraph Frontends [Next.js Apps]
        Web[Web Portal: Public, Worker, Facility]
        Admin[Admin Dashboard]
    end

    subgraph Backend [NestJS API]
        API_GW[API Gateway / Controllers]
        Auth[Auth Service]
        Shift[Shift Management Service]
        Match[Matching Engine Service]
        Notify[Notification Service]
        WebSocket[Socket.io Gateway]
    end

    subgraph Data Layer
        DB[(MongoDB)]
        Redis[(Redis - Pub/Sub & Caching)]
    end

    subgraph External Services
        Resend[Resend - Emails]
        Maps[Mapbox - Maps]
        Cloudinary[Cloudinary - File Uploads]
    end

    Web <-->|REST / GraphQL| API_GW
    Web <-->|WebSocket| WebSocket
    Admin <-->|REST| API_GW

    API_GW --> Auth
    API_GW --> Shift
    API_GW --> Match
    
    Auth --> DB
    Auth --> Notify
    Shift --> DB
    Match --> DB
    Match --> Notify
    
    WebSocket --> Redis
    Notify --> Resend
    Web --> Cloudinary
    Notify --> WebSocket
```

## 3. Monorepo Structure (Nx / Turborepo)
```
medshift/
├── apps/
│   ├── web/               # Next.js: Public landing, Worker portal, Facility portal
│   ├── admin/             # Next.js: Admin dashboard
│   └── api/               # NestJS: Core backend services
├── packages/
│   ├── shared-types/      # TypeScript interfaces, enums shared across stack
│   ├── ui-components/     # Reusable React components (Design System)
│   └── utils/             # Shared validation, formatting utilities
└── package.json
```

## 4. Backend Architecture (NestJS)
The NestJS application follows a strict modular and layered architecture to enforce SOLID principles.

### Layered Approach
1. **Controllers / Gateways (Interface Layer)**: Handle HTTP requests and WebSocket connections. Route data to services.
2. **Services (Business Logic Layer)**: Contain the core business logic (e.g., Shift Matching). Single Responsibility Principle (SRP) is enforced by keeping services focused (e.g., `ShiftService` handles CRUD, `MatchingService` handles the algorithm).
3. **Repositories (Data Access Layer)**: Abstract Mongoose/MongoDB interactions. Dependency Inversion Principle (DIP) is applied by depending on repository interfaces rather than concrete database implementations.

### Core Modules
- **`AuthModule`**: Handles registration, login, JWT authentication, email verification token creation/validation, verification resend flows, password reset token creation/validation, password updates, and RBAC (Role-Based Access Control) for Workers, Facilities, and Admins.
- **`UserModule`**: Manages user profiles, credentials, and background check statuses.
- **`FacilityModule`**: Manages facility profiles, billing setup, and locations.
- **`ShiftModule`**: Manages shift lifecycle (creation, publishing, completion, cancellation).
- **`MatchingModule`**: Uses geospatial queries (MongoDB `$near`) and worker availability to find matches.
- **`NotificationModule`**: Adapters for Email (Resend) and Real-time (Socket.io), including registration verification emails, password reset emails, welcome emails, and shift notifications. Open/Closed Principle (OCP) applies here: new notification channels (e.g., SMS) can be added without modifying existing code.

### Authentication Flow
1. **Start Registration**: The API accepts account type and email, requires a work email for facility registrations, stores a hashed six-digit OTP with an expiration timestamp, and asks `NotificationModule` to send the code through Resend. Non-production environments use `123456` as the OTP; production generates a random code.
2. **Verify Registration OTP**: The API validates the OTP hash and expiration, marks the registration attempt verified, and returns a short-lived registration completion token.
3. **Complete Registration**: The API validates the completion token, creates the user with password and account type, marks `emailVerified` as `true`, clears the registration attempt, sends a welcome email through `NotificationModule`, and returns a JWT session. The web client stores the session and transitions to a non-form success state with role-specific verification instructions and a profile-completion call to action.
4. **Legacy Email Links**: Existing email verification token handling remains available for pending accounts created before the OTP flow.
5. **Login Gate**: Login rejects unverified users with a verification-required response so the web app can show a resend option instead of a generic failure.
6. **Resend Verification**: The API rotates the token and sends a new verification email without exposing whether an email belongs to an account.
7. **Forgot Password**: The API accepts an email address, returns a generic success response, and if the account exists, stores a hashed reset token with an expiration timestamp and asks `NotificationModule` to send a reset link.
8. **Reset Password**: The API validates the reset token hash and expiration, updates the stored password hash, clears reset token fields, and returns a success response without issuing a session automatically.
9. **Feedback Contract**: Auth endpoints should return stable machine-readable error codes for expected states such as `EMAIL_VERIFICATION_REQUIRED`, `REGISTRATION_OTP_INVALID`, `PASSWORD_RESET_INVALID`, and `PASSWORD_RESET_EXPIRED` so the web app can show specific inline and toast feedback.
10. **Role-Based Redirect**: After successful login, the web client stores the JWT, checks role-specific onboarding status for worker and facility accounts, and navigates directly to the final destination. Incomplete worker accounts go to `/worker/onboarding`, incomplete facility accounts go to `/facility/onboarding`, approved users go to their role dashboard, and admins go to the configured admin dashboard origin.

### Onboarding Flow
1. **Onboarding Status**: Worker and facility profile APIs should expose whether the authenticated user has completed the required onboarding fields and whether admin verification is pending, approved, or rejected.
   - Worker clients read `GET /worker-profiles/onboarding-status`.
   - Facility clients read `GET /facility-profiles/onboarding-status`.
   - Both endpoints return `INCOMPLETE` for authenticated users who have not created a profile yet, allowing the frontend to route directly to profile completion instead of treating missing profile data as an error.
2. **Worker Onboarding**: The worker flow captures identity details, clinical role, location/radius, availability preferences, credential uploads, and background-check consent before enabling live shift matching.
3. **Facility Onboarding**: The facility flow captures organization details, facility type, service address/geolocation, primary contact details, and billing/readiness information before enabling live shift posting.
   - Onboarding clients use standalone full-screen focused setup layouts, not the shared dashboard shell and not a dashboard-style topbar. The pages should keep users in a guided profile-completion context before they enter role dashboards.
   - Onboarding clients use a step-based wizard. Each step saves a local draft immediately so users can leave and resume incomplete onboarding later without creating a partial profile record.
   - Final submission sends the consolidated profile payload to the role-specific profile API and transitions complete submissions to `PENDING_REVIEW`.
   - Location steps render an interactive Mapbox GL map when `NEXT_PUBLIC_MAPBOX_TOKEN` or `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is configured, falling back to a static coordinate grid when a public token is unavailable or the map script fails to load.
   - Worker credential upload steps use Cloudinary unsigned uploads from the browser. The web app requires `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, stores the returned `secure_url` in the local onboarding draft, and submits that URL as the credential `documentUrl`.
   - Because the app runs inside a monorepo, the web Next.js config loads browser-safe `NEXT_PUBLIC_*` values from both the repository root env files and `apps/web` env files. App-specific env files override root values, and the dev server must be restarted after env changes.
4. **Access Gates**: Worker shift acceptance and facility shift posting should detect incomplete onboarding and route users to the relevant profile completion flow with inline guidance.
5. **Admin Verification**: Uploaded worker credentials and completed facility registrations enter the admin verification queue; approval unlocks production matching/posting capabilities.
   - Admins can filter the queue by worker credential reviews or facility registration reviews.
   - Approval updates onboarding verification status to `APPROVED`, activates the account, and sends an approval email.
   - Rejection updates onboarding verification status to `REJECTED`, stores the rejected reason, keeps the account pending, and sends an update-required email.

## 5. Frontend Architecture (Next.js)
- **App Router & Server Components**: Leverages React Server Components (RSC) for initial page loads (SEO, performance) and Client Components for interactive pieces (e.g., Real-time shift boards).
- **State Management**: React Query (for server state and caching) and Zustand/Context (for lightweight client state like UI toggles).
- **Component Design**: 
  - Dumb/Presentational components in `packages/ui-components`.
  - Smart/Container components in `apps/web/features/*`.
- **Dashboard Shell**: Role dashboards should compose a shared application shell with sidebar navigation, topbar, and main content slots. Shell components should live in the shared UI layer when possible, with role-specific navigation models supplied by the consuming app. Onboarding screens are intentionally separate guided setup layouts and should not use the dashboard shell until the user reaches an approved role dashboard.
- **Action Feedback**: Frontends must expose a shared toast/notification provider that works in Next.js client components. Use it for non-blocking success/error feedback and pair it with inline form messages for auth actions. Native browser `alert()`, `confirm()`, and blocking prompts are not permitted in product workflows.

## 6. Real-Time Infrastructure (Socket.io)
- **Namespaces & Rooms**: Connections are organized by namespaces (e.g., `/shifts`) and rooms (e.g., `facility_123` or `geo_calgary`).
- **Events**:
  - `shift.created`: Broadcasted to qualified workers in the geographical area.
  - `shift.accepted`: Notifies the facility immediately when a worker accepts.
  - `worker.status_update`: Updates worker availability in real-time.
