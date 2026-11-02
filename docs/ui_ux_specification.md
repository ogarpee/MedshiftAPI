# UI/UX Specification: MedShift

## 1. Design System & Brand Identity
The UI is designed to evoke trust, professionalism, and premium quality, aligning with the "Right Care. Right When It Matters" mission.

### 1.1 Typography
- **Headings & Display**: `Playfair Display` (Serif). Used to convey a premium, trustworthy, and established feel. (Weights: 700, 900)
- **Body & Interface Text**: `Poppins` (Sans-serif). Clean, highly legible, and modern for dashboards and data-heavy interfaces. (Weights: 300, 400, 500, 600, 700)

### 1.2 Color Palette
Derived from the MedShift marketing site:
- **Primary / Backgrounds**: Navy (`#0B1F3A`) - Trust, stability, professionalism.
- **Accents / CTAs**: Gold (`#D4AF37`) and Light Gold (`#F5D98C`) - Excellence, premium service.
- **Text & Contrast**: Dark (`#1C1C1C`) for main text, White (`#FFFFFF`) for dark-mode text and cards.
- **Backgrounds / Cards**: Off-White (`#F8F6F1`) for gentle contrast against pure white backgrounds.
- **Muted Text**: Text-Muted (`#6B7280`) for secondary information.
- **Success / Status**: Green (`#4ade80` with `rgba(34,197,94,0.2)` background) for "Available" or "Matched" statuses.

## 2. Shared Components

### 2.1 Buttons
- **Primary Button**: Solid Gold background (`#D4AF37`), White text (`#FFFFFF`). Bold Poppins font, 8px border-radius. Hover state: Light Gold with a slight upward translation (`translateY(-2px)`) and a soft gold shadow.
- **Secondary Button**: Transparent background, White/Navy border. Hover state: Border and text turn Gold.

### 2.2 Cards & Containers
- **Shift Cards**: Used for displaying open/upcoming shifts. 
  - Glassmorphism effect on dark backgrounds (`rgba(255,255,255,0.05)`, backdrop blur).
  - Clean borders (`1px solid rgba(212,175,55,0.2)`).
  - Micro-animations: Slight float or translation on hover.
- **Avatars**: Circular, utilizing Gold/Light Gold gradients for placeholders containing user initials.

### 2.3 Status Badges
- Capsule-shaped (`border-radius: 100px`), small font size (`0.7rem`), bold uppercase text.
- Used to indicate shift status (OPEN, MATCHED, COMPLETED) or worker availability.

### 2.4 Toasts & Action Feedback
- Use a shared Next.js-compatible toast system, such as `sonner`, `react-hot-toast`, or an equivalent in-house component, for non-blocking action feedback.
- Every user-triggered action must expose loading, success, and error states. Examples include registration, login, resend verification, forgot password, reset password, profile save, shift post, shift accept, credential approval, review submission, and waitlist signup.
- Auth surfaces use toasts for transient validation, success, and API error results. Keep only structural step instructions, loading labels, and persistent success/recovery actions in the card.
- Do not use native `alert()`, `confirm()`, or blocking browser prompts in product workflows.
- Toasts should use concise text, accessible live-region semantics, and MedShift visual styling aligned with the navy/gold palette.

### 2.5 Dashboard Shell
- Worker, facility, admin, and onboarding dashboards must use a standard modern application shell instead of standalone page stacks.
- **Sidebar navigation**: Persistent desktop sidebar with MedShift brand, primary navigation links, active state, secondary/support links, and account/logout controls. Collapse to a drawer or bottom navigation on small screens.
- **Topbar**: Compact horizontal topbar inside the content area with page title/breadcrumb on the left and global controls on the right, including notifications and user avatar/profile actions. Keep contextual controls such as list/map switches, table filters, and workflow-specific messages in the main content area near the data they affect.
- **Main content area**: Scrollable workspace for the current dashboard view. Use a restrained grid for metrics, tables, forms, and operational panels. Keep content dense, scannable, and task-oriented.
- **Responsive behavior**: Desktop uses `sidebar + topbar + main` layout. Tablet may use a narrower icon sidebar. Mobile hides the sidebar behind a menu button and keeps the topbar compact.
- **Visual treatment**: Use off-white or white main surfaces, navy sidebar, gold active accents, 8px card radius, clear dividers, and consistent spacing. Avoid marketing-style hero sections inside dashboards.
- **Navigation consistency**: Worker, facility, and admin dashboards should share the same shell anatomy even when their menu items differ.

## 3. Core User Journeys & Wireframe Specs

### 3.1 Authentication, Email Verification & Password Recovery
**Design Goal**: Keep sign-up fast while making the verification state clear and recoverable.

1. **Registration Confirmation**:
   - The first registration step asks for account type and email. Facility account type labels the field as work email and rejects personal email domains.
   - The second step shows six OTP input boxes for the email verification code and a resend action.
   - The final form step collects password, then completes the account and signs the user in.
   - After successful account creation, replace the form with a congratulations message, concise instructions for role-specific verification, and a primary button to continue to profile completion.
   - The completed registration flow sends a welcome email; the on-screen success state should not require the user to wait for email delivery.
2. **Login With Unverified Email**:
   - After correct credentials, the API automatically requests a new verification email when the 60-second cooldown allows it and continues to block sign-in.
   - Show the sent/recently-sent result as a toast. Do not add an inline verification notice, email card, or manual resend button to login.
   - Successful sign-in routes workers to the worker dashboard, facilities to the facility dashboard, and admins to the admin dashboard.
   - On the public homepage, signed-in users see a compact profile/avatar menu instead of Login and Join Now. The menu provides dashboard navigation and logout.
3. **Verification Result Page**:
   - Successful verification confirms the account is verified and provides a primary sign-in action.
   - Expired or invalid links explain the issue and provide a resend verification action.
   - Verification and resend API results appear as toasts rather than duplicate inline messages.
4. **Forgot Password**:
   - The login page includes a forgot-password link.
   - The forgot-password page accepts an email address and always shows a generic confirmation after submit to avoid account enumeration.
   - The recovery flow proceeds in three distinct steps: email, OTP, then set password.
   - The OTP step prompts only for the 6-digit code and verifies it with the API before showing password fields.
   - The confirmation state uses toast feedback to tell the user to check their inbox if the account exists.
5. **Reset Password**:
   - Reset recovery uses the same time-limited email OTP pattern as registration rather than a link token.
   - The form requires a new password that satisfies password policy and a matching confirmation field.
   - Successful reset shows a toast, clears the form, and provides a primary sign-in action.
   - Invalid or expired codes show toast feedback while retaining the resend-code action and structural recovery instructions.
6. **Visual Treatment**:
   - Use the existing auth page split layout, MedShift logo, navy/gold palette, and restrained form states.
   - Verification toasts should be concise and accessible; recovery actions remain in the relevant form.
   - Password reset messages should avoid revealing whether an email address belongs to an account.

### 3.2 Healthcare Professional (Worker) Portal
**Design Goal**: Mobile-first, extremely fast, focused on discovering and accepting shifts with minimal friction.

1. **Dashboard / Shift Board**:
   - Use the shared dashboard shell with worker-specific sidebar navigation, a compact topbar, and the shift board in the main content area.
   - Worker navigation must stay scoped to worker workflows and must not provide a portal-switch link to the facility portal.
   - **Header**: User profile summary, current earnings, upcoming shift reminder.
   - **Map/List Toggle**: View available shifts as a list of cards or pins on an interactive Mapbox map when `NEXT_PUBLIC_MAPBOX_TOKEN` or `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is configured, with a coordinate fallback if Mapbox is unavailable.
   - **Shift Card UI**: Displays Facility Name, Role, Date & Time, Location, and Hourly Rate.
   - **Operational Width**: Find Shifts and Reviews use the full dashboard workspace rather than inheriting the overview sidebar columns. Shift and review records render as full-width desktop rows and stack into compact cards on smaller screens.
   - **Search and Filters**: Find Shifts uses a full-width search field with a single Filters control. Web opens an accessible popover and Flutter opens a bottom sheet; both provide checked multi-select role, facility, and shift-period groups, compact numeric/sort controls, Apply/Clear actions, removable chips, retained results during refresh, and a 350 ms text-search debounce.
   - **Mobile Card Rhythm**: Flutter worker screens use consistent 16 px page padding and 12–14 px card gaps. Overview metrics use equal-width responsive columns and primary workflow cards always consume the available width without fixed-width leftovers.
   - **Shared Onboarding Guidance**: Flutter places the current onboarding status below the app bar across worker tabs other than Profile, with Continue, Update, or Review actions for incomplete, rejected, or pending profiles. Profile uses one clickable status card for every state, including approved, and routes to saved progress or the populated Review step without showing a duplicate banner.
2. **Shift Details View**:
   - Full-page modal or detailed view.
   - Prominent "Accept Shift" primary button.
   - Includes facility rating and map preview.
3. **Profile & Documents**:
   - Status indicators show document verification as Pending, Verified, or Rejected.
   - A required onboarding flow captures legal name, professional role, location/radius, availability, and private verification documents.
   - Onboarding should use a standalone focused setup layout rather than the shared dashboard shell.
   - Onboarding uses a step-based workflow with a progress rail and one primary task per step. Every field, selection, document, and active-step change saves immediately on the device and synchronizes to the authenticated worker's server draft, with visible Saving, Saved, device-only, and retry states.
   - Save and continue disables during its ordered save, stores the latest snapshot before advancing, and may continue with a Saved on this device state when the network is unavailable. The web progress rail shows concise save state only and never renders raw API/JSON errors or a Retry loading profile action.
   - Flutter onboarding uses a bounded skeleton during remote hydration, then renders the best available device, draft, or profile state. Optional synchronization failures use concise inline guidance; if an expected canonical profile cannot load, local editing remains available but final submission is disabled.
   - Location/radius steps use an interactive Mapbox map when configured and show editable coordinates beside the map. If `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` is configured, users can search an address to prefill coordinates and reposition the map pin. If Mapbox or Google Places cannot load, manual coordinate entry must remain available.
   - Step 4 is titled Documents and contains upload-only cards for government ID, professional certificate/licence, background-check document, and optional additional documents. It has no credential-type, manual URL, or consent inputs.
   - Upload cards support PDF/JPG/PNG/WEBP files up to 10 MB, progress, retry, replace, remove, and authorized preview states, with no more than 10 active documents.
   - The Review step shows complete Identity, Service Area, Availability, and Documents sections. Each section has an Edit action; documents show category, filename, format, size, upload date, verification status, rejection reason, and secure Preview action.
   - Existing incomplete, pending, rejected, and approved profiles reopen prefilled. When no unfinished draft exists, submitted profiles open directly on Review. Submission actions read Submit for review, Resubmit for review, or Save changes according to profile state.
   - Final submission is independent of cached profile IDs. If an expected profile cannot be hydrated, the form must show Retry and block blank/default submission. Draft synchronization errors display the API's message and a Retry sync action while preserving device progress; successful retries and final saves remain on the populated Review step.
   - Worker settings in the dashboard shell expose the same categorized document manager; changing required documents returns approved onboarding to pending review.
   - Flutter Profile renders canonical identity, service area, availability, documents, and verification status independently of draft synchronization, with skeleton, offline-device, incomplete, error/retry, and loaded states.
   - Flutter Profile and web worker Settings include independently loaded Notifications and Security sections. Optional notification categories use clear in-app/email switches with optimistic save and rollback; account and security alerts display Always on.
   - Security settings guide workers through authenticator QR/manual-key setup or email-code setup, show recovery codes once, list trusted devices, and require explicit confirmation credentials for method changes, disabling, and recovery-code regeneration. Flutter presents password, 2FA, recovery-code, device, and session actions in consistent keyboard-safe bottom drawers; one-time recovery codes cannot be dismissed until acknowledged.
   - Login replaces the password form with a focused second-factor step when required. It supports email resend, recovery-code entry, and a default-selected “Trust this device for 30 days” control without creating a session before verification.
   - The shift board should show an in-content onboarding banner with a Continue onboarding action while the worker profile is still incomplete. Once the worker has completed onboarding and entered review/approval, the banner should not show again.

### 3.3 Healthcare Facility Portal
**Design Goal**: Desktop-optimized, clear oversight of staffing needs, focus on rapid shift creation.

1. **Dashboard / Roster**:
   - Use the shared dashboard shell with facility-specific sidebar navigation, a compact topbar, and roster operations in the main content area.
   - **Metrics Bar**: Average fill time, active shifts, upcoming shifts.
   - **Active Shifts Table/Grid**: Displays current shifts and matching status. Real-time updates push new worker matches to the top.
2. **Post a Shift Modal**:
   - Streamlined form: Select Role, Date/Time picker, add optional description.
   - 1-click "Publish to Network" action.
3. **Worker Match View**:
   - When a worker accepts, facility views a concise "Worker Profile Card" (Avatar, Name, Role, Rating).
   - Worker search, roster, and review routes use the full dashboard workspace; review queues must not remain constrained to an unused half-width insight column.
4. **Facility Onboarding**:
   - A required onboarding flow captures facility name, care setting, service address/geolocation, primary contact details, and billing/readiness details.
   - Onboarding should use a standalone focused setup layout rather than the shared dashboard shell.
   - Onboarding uses a step-based workflow with draft saves after each step so facilities can pause and resume setup later.
   - Service address/geolocation steps use an interactive Mapbox map when configured and show editable coordinates beside the map. If `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` is configured, users can search an address to prefill service address fields, coordinates, and reposition the map pin. If Mapbox or Google Places cannot load, manual address and coordinate entry must remain available.
   - Shift posting should show an onboarding gate until the facility profile is complete and registration verification is approved.

### 3.4 Admin Dashboard
**Design Goal**: Data-dense, analytical, focused on moderation and platform health.

- Use the shared dashboard shell with admin-specific sidebar navigation, a moderation-focused topbar, and queue/table views in the main content area.
- **Data Tables**: Paginated, sortable tables for Users, Facilities, and Shifts.
- **Verification Queue**: Dedicated UI for admins to review uploaded worker credentials (PDF/Image viewer alongside approval/rejection buttons).
- **System Health**: Real-time charts showing shift fulfillment rates and Socket.io active connections.

## 4. Interaction & Motion Design
- **Transitions**: Smooth, fast fade-ins and slide-ups (`0.2s` to `0.3s` ease) for modals and page routing to make the app feel snappy.
- **Real-Time Feedback**: When a shift is matched, use subtle visual cues (e.g., a brief flash of success green or a toast notification) via Socket.io events.
