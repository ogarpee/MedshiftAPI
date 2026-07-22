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
- Long-term care homes, clinics, and hospitals looking to fill urgent staffing gaps quickly (in under 2 hours).
- Seeking verified, credentialed professionals without agency markups or middlemen.

### 3.2 Healthcare Professionals (Workers)
- Healthcare Assistants (HCAs), Nurses, and other clinical staff (e.g., Sarah J. - HealthCare Assistant).
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
- **Resend Verification**: Users can request a new verification email when the original link expires or is lost.
- **Forgot Password**: Users can request a password reset email from the login flow without revealing whether the email exists.
- **Reset Password**: Users can open a time-limited reset link, set a new password that satisfies password policy, and then sign in with the updated credentials.
- **Status Handling**: Unverified accounts remain `PENDING`; successful email verification records the verification timestamp and allows the account to progress toward `ACTIVE` after any role-specific approval requirements.
- **Action Feedback**: Every user-triggered auth action must provide clear success, loading, and error feedback through inline states and/or an app-level toast system. Native browser alerts are not allowed.

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
- **Worker Onboarding**: New workers must complete identity details, clinical role, location/radius, availability preferences, credential uploads, and background-check consent before live shift matching is enabled.
- **Credential Uploads**: Worker credential files are uploaded to Cloudinary during onboarding before profile submission. The stored worker credential record keeps the returned secure Cloudinary URL for admin review.
- **Shift Browsing & Filtering**: Filter shifts by location, facility type, and shift length. Find opportunities nearby.
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
- **Early Access / Waitlist Form**: Captures email addresses, distinguishing between Workers and Facilities.
- **Automated Emails**: Uses Resend to send confirmation emails and notifications upon waitlist signup, completed registration, and platform launch.

## 5. Technical & Non-Functional Requirements
- **Real-Time Capabilities**: Socket.io must power real-time shift broadcasting, worker acceptance notifications, and live status updates to ensure shift fill times remain under 2 hours.
- **Database Architecture**: MongoDB must be structured to handle rapid geospatial queries (for proximity matching) and robust user profile management (credentials, ratings).
- **Security & Privacy**: Strict data protection for worker credentials, background checks, and payment information.
- **Performance & Responsiveness**: Public site and Worker portal must be highly optimized for mobile devices (as workers will likely browse shifts on the go).
- **User Feedback**: All portals must use consistent application UI feedback for actions such as submit, save, approve, reject, accept shift, resend email, and reset password. Use a Next.js-compatible toast library or equivalent app component; do not use native `alert()`, `confirm()`, or blocking browser prompts for product workflows.

## 6. Future Roadmap Considerations
- Expansion beyond the initial Alberta launch to other provinces and regions.
- Advanced machine-learning matching algorithms incorporating historical worker reliability and facility preferences.
- In-app real-time messaging between workers and facilities (powered by Socket.io).
