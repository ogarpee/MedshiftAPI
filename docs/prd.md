# Product Requirements Document (PRD): MedShift

## 1. Product Overview
**Name**: MedShift
**Tagline**: "The Right Care. Right When It Matters." / "Fill Shifts. Change Lives."
**Mission**: To connect healthcare professionals with facilities that need care — fast, reliable, and on-demand.
**Core Values**:
- **Compassion**: Every shift filled improves patient care and a professional's livelihood.
- **Reliability**: Facilities and workers can count on MedShift to deliver, every time.
- **Integrity**: Transparent pricing, honest matching, no hidden fees or surprises.
- **Excellence**: Holding professionals and facilities to the highest standard of care.
**Target Launch Location**: Alberta, Canada (e.g., Calgary) for early access.

## 2. Tech Stack Overview
- **Architecture**: Monorepo (sharing types and logic across frontend and backend)
- **Frontend / Public Site / Admin Dashboard**: Next.js
- **Backend / API**: NestJS
- **Database**: MongoDB
- **Real-Time Communications**: Socket.io (instant updates for shift matching and availability)
- **Transactional Emails**: Resend

## 3. Target Audience
### 3.1 Healthcare Facilities
- Long-term care, supportive living, retirement residence, and home care organizations looking to fill urgent staffing gaps quickly (in under 2 hours).
- Seeking verified, credentialed professionals without agency markups or middlemen.

### 3.2 Healthcare Professionals (Workers)
- Healthcare aides, personal support workers, and other care staff (e.g., Sarah J. - Healthcare Aide).
- Seeking flexible schedules, quick payouts, and direct connections to facilities without agency commitments.

## 4. Core Workflows & Features

### 4.1 "How It Works" Flow (Core Matching Engine)
1. **Post or Browse**: Facilities post open shifts in minutes. Workers browse available opportunities based on their area and specialty.
2. **Get Matched**: The system automatically surfaces the right fit—incorporating verified credentials, proximity, and real-time availability.
3. **Shift Filled**: Workers confirm the shift, show up, and deliver care. Facilities get immediate coverage.

### 4.2 Authentication, Email Verification & Password Recovery
- **Registration**: Workers and facilities start registration with account type and email, verify a time-limited one-time passcode (OTP), then complete registration with a password. Facility registrations require a work email address.
- **Registration Success**: After account creation succeeds, the web app replaces the registration form with a congratulations state that explains the next verification requirements and provides a primary action to continue into role-specific profile completion.
- **Verification Email**: New registrations receive a time-limited OTP by email before account details can be completed.
- **Verified Login**: Users must verify their email address before accessing authenticated worker, facility, or admin workflows.
- **Role-Based Login Routing**: Successful sign-in sends workers to the worker dashboard, facilities to the facility dashboard, and admins to the admin dashboard.
- **Verification Resend**: A correct-password login for an unverified account automatically sends a fresh verification link when the 60-second resend cooldown has elapsed. Expired or invalid verification links retain a manual recovery resend action.
- **Forgot Password**: Users can request a password reset OTP email from the login flow without revealing whether the email exists.
- **Reset Password**: Users enter the time-limited reset OTP, set a new password that satisfies password policy, and then sign in with the updated credentials.
- **Status Handling**: Unverified accounts remain `PENDING`; successful email verification records the verification timestamp and allows the account to progress toward `ACTIVE` after any role-specific approval requirements.
- **Action Feedback**: Every user-triggered auth action must provide loading state and concise toast feedback. Auth cards retain structural step instructions and success states but do not duplicate transient API results inline. Native browser alerts are not allowed.
- **Two-Factor Security**: Workers may enable either an authenticator app or email codes from web Settings or the Flutter Profile. A successful password check creates a temporary challenge rather than a session until the second factor succeeds. Recovery codes and revocable 30-day trusted devices provide safe recovery and lower-friction repeat sign-in.

### 4.3 Facility Portal Requirements
- **Dashboard Shell**: Facility dashboards must follow the modern app shell standard: persistent sidebar navigation, topbar, and task-focused main content area.
- **Facility Onboarding**: New facilities must complete facility name, facility type, service location, contact details, and billing/readiness details before live shift posting is enabled.
- **Shift Creation**: Ability to post urgent and future shifts with details (Role, Date & Time, Location).
- **Instant Matching & Notifications**: System uses Socket.io to notify facilities instantly when a worker matches and accepts a shift.
- **Worker Verification**: Guarantee that all workers presented have 100% verified credentials and passed background checks.
- **Direct Payments**: Transparent pricing model allowing facilities to pay workers directly through the platform (0 agency markups).
- **Dashboard Metrics**: 
  - Track average shift fill times (goal: < 2 hours).
  - Track credential verification statuses.
  - Review historical shift fulfillment and worker ratings.

### 4.4 Worker App/Portal Requirements
- **Dashboard Shell**: Worker dashboards must follow the modern app shell standard: persistent/sidebar-or-mobile-drawer navigation, topbar, and main content area for shift discovery and profile tasks.
- **Operational Workspace**: Find Shifts and Reviews must use the full available dashboard content width, with full-width desktop records and responsive stacked cards on smaller screens.
- **Worker Onboarding**: New workers must complete identity details, professional role, location/radius, availability preferences, and upload government ID, professional certification/licence, and background-check documents before live shift matching is enabled.
- **Private Document Uploads**: Web and mobile clients request short-lived signed upload parameters from the API, upload worker documents as private Cloudinary assets, and store only verified asset metadata. Manual document URLs and background-consent inputs are not part of the worker flow.
- **Resumable Profile Completion**: Authenticated workers save onboarding fields, documents, and the active step locally and to a user-scoped server draft so they can resume across web, mobile, and devices. Existing submitted profiles reopen prefilled on a complete Review step and remain editable through section-level actions.
- **Deterministic Step Saves**: Save and continue writes the latest worker fields and target step to device storage before navigation, immediately synchronizes the server draft, and prevents older autosaves from replacing newer progress. Empty draft responses represent a new onboarding flow rather than a profile-load failure.
- **Retry-Safe Submission**: Web and mobile submit the final onboarding payload through `PUT /worker-profiles/me`. The API creates or updates the authenticated worker's single profile, so a lost response or repeated submission cannot produce a conflict or duplicate profile. Synchronization failures retain the device draft and expose the server error with a Retry sync action.
- **Shift Browsing & Filtering**: Web and mobile expose one text search for facility, city, role, title, and description plus a checkable filter surface for multiple clinical roles, facility types, and Day/Evening/Night/Weekend periods. Radius, duration, pay, and sort remain available without crowding the primary shift board.
- **Mobile Profile State**: Every Flutter worker tab shows status-aware onboarding guidance until approval. The Profile tab loads canonical submitted data independently from draft synchronization and provides explicit loading, offline, empty, error/retry, and edit states. A single clickable status card resumes incomplete/rejected work or opens the populated Review step for pending/approved profiles.
- **Worker Account Preferences**: Web Settings and Flutter Profile expose independently loaded notification and security sections. Workers can configure optional in-app/email shift, assignment, schedule, timesheet, review, and dispute alerts; account and security alerts remain always enabled. Flutter password, 2FA, recovery-code, trusted-device, and session actions use keyboard-safe bottom drawers with explicit confirmation for destructive actions.
- **Mobile Onboarding Recovery**: Flutter recognizes sessions restored from secure storage, loads profile/status/draft requests concurrently, and treats draft/status failures as recoverable. A pending device draft renders before background synchronization; a failed canonical-profile load preserves local edits but blocks blank submission.
- **Flexible Scheduling**: No minimum shift obligations; workers choose when and where they work on their terms.
- **Shift Details View**: View detailed shift cards (e.g., Facility Name, Date/Time [e.g. May 24 · 7:00 AM – 3:00 PM], Location, Pay).
- **Fast Payouts**: Integration to ensure workers get paid quickly upon shift completion without waiting weeks.
- **Reputation System**: Earn ratings (e.g., ⭐ 4.9) and receive repeat requests from preferred facilities, helping to build a professional network.

### 4.5 Admin Dashboard Requirements
- **Dashboard Shell**: Admin screens must follow the modern app shell standard with sidebar navigation, topbar controls, and a dense main content area for tables, queues, and charts.
- **User Management**: Approve, background-check, and verify worker credentials and facility registrations.
- **Platform Monitoring**: Oversee active shifts, filled shifts, and resolve matching bottlenecks in real-time.
- **Support & Dispute Resolution**: Tools to manage cancellations, disputes, or payout issues.
- **Waitlist Management**: Manage early access signups generated from the public site.

### 4.6 Public Marketing Site
- **Landing Page**: Communicates the dual value proposition to Workers and Facilities.
- **Early Access / Waitlist Form**: Captures role-specific launch details. Facility signups collect facility name, work email, phone number, facility type, city, and province. Worker signups collect name, email, phone number, professional role, city, and preferred shift.
- **Automated Emails & Campaign Contacts**: Uses Resend to send confirmation emails and notifications upon waitlist signup, completed registration, and platform launch. Waitlist submissions are also added to the waitlist campaign group, while completed registrations are added to the general campaign group and their selected Worker or Facility role group.

## 5. Technical & Non-Functional Requirements
- **Real-Time Capabilities**: Socket.io must power real-time shift broadcasting, worker acceptance notifications, and live status updates to ensure shift fill times remain under 2 hours.
- **Database Architecture**: MongoDB must be structured to handle rapid geospatial queries (for proximity matching) and robust user profile management (credentials, ratings).
- **Security & Privacy**: Strict data protection for worker credentials, background checks, and payment information.
- **Performance & Responsiveness**: Public site and Worker portal must be highly optimized for mobile devices (as workers will likely browse shifts on the go).
- **User Feedback**: All portals must use consistent application UI feedback for actions such as submit, save, approve, reject, accept shift, resend email, and reset password. Use a Next.js-compatible toast library or equivalent app component; do not use native `alert()`, `confirm()`, or blocking browser prompts for product workflows.

## 6. Future Roadmap Considerations
- Payment processing, payout ledgers, refunds, reconciliation, and tax reporting. Launch earnings are estimates derived from approved timesheets; the MVP must not claim that money has been transferred.
- Background mobile push notifications. Launch uses persisted in-app notifications and foreground Socket.io refresh.
- Redis-backed realtime fan-out when the API scales beyond one process.
- Expansion beyond the initial Alberta launch to other provinces and regions.
- Advanced machine-learning matching algorithms incorporating historical worker reliability and facility preferences.
- In-app real-time messaging between workers and facilities (powered by Socket.io).
