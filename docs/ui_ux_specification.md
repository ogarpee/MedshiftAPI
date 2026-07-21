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
- **Primary Button**: Solid Gold background (`#D4AF37`), Navy text (`#0B1F3A`). Bold Poppins font, 8px border-radius. Hover state: Light Gold with a slight upward translation (`translateY(-2px)`) and a soft gold shadow.
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
- Pair toasts with inline form messages when the user must correct input or understand a persistent auth state.
- Do not use native `alert()`, `confirm()`, or blocking browser prompts in product workflows.
- Toasts should use concise text, accessible live-region semantics, and MedShift visual styling aligned with the navy/gold palette.

## 3. Core User Journeys & Wireframe Specs

### 3.1 Authentication, Email Verification & Password Recovery
**Design Goal**: Keep sign-up fast while making the verification state clear and recoverable.

1. **Registration Confirmation**:
   - The first registration step asks for email only.
   - The second step shows six OTP input boxes for the email verification code and a resend action.
   - The final step collects password and account type, then completes the account and signs the user in.
2. **Login With Unverified Email**:
   - When the API returns a verification-required response, show a clear inline message instead of a generic error.
   - Provide a resend verification action from the same form state.
3. **Verification Result Page**:
   - Successful verification confirms the account is verified and provides a primary sign-in action.
   - Expired or invalid links explain the issue and provide a resend verification action.
4. **Forgot Password**:
   - The login page includes a forgot-password link.
   - The forgot-password page accepts an email address and always shows a generic confirmation after submit to avoid account enumeration.
   - The confirmation state uses toast and inline feedback to tell the user to check their inbox if the account exists.
5. **Reset Password**:
   - Reset links open a dedicated reset-password page with token and email query parameters.
   - The form requires a new password that satisfies password policy and a matching confirmation field.
   - Successful reset shows a toast, clears the form, and provides a primary sign-in action.
   - Invalid or expired links show inline recovery copy and a forgot-password action.
6. **Visual Treatment**:
   - Use the existing auth page split layout, MedShift logo, navy/gold palette, and restrained form states.
   - Verification messages should be concise, accessible, and placed near the form action that resolves the issue.
   - Password reset messages should avoid revealing whether an email address belongs to an account.

### 3.2 Healthcare Professional (Worker) Portal
**Design Goal**: Mobile-first, extremely fast, focused on discovering and accepting shifts with minimal friction.

1. **Dashboard / Shift Board**:
   - **Header**: User profile summary, current earnings, upcoming shift reminder.
   - **Map/List Toggle**: View available shifts as a list of cards or pins on a map.
   - **Shift Card UI**: Displays Facility Name, Role, Date & Time, Location, and Hourly Rate.
2. **Shift Details View**:
   - Full-page modal or detailed view.
   - Prominent "Accept Shift" primary button.
   - Includes facility rating and map preview.
3. **Profile & Credentials**:
   - Status indicators for credential verification (Pending vs. Verified).

### 3.3 Healthcare Facility Portal
**Design Goal**: Desktop-optimized, clear oversight of staffing needs, focus on rapid shift creation.

1. **Dashboard / Roster**:
   - **Metrics Bar**: Average fill time, active shifts, upcoming shifts.
   - **Active Shifts Table/Grid**: Displays current shifts and matching status. Real-time updates push new worker matches to the top.
2. **Post a Shift Modal**:
   - Streamlined form: Select Role, Date/Time picker, add optional description.
   - 1-click "Publish to Network" action.
3. **Worker Match View**:
   - When a worker accepts, facility views a concise "Worker Profile Card" (Avatar, Name, Role, Rating).

### 3.4 Admin Dashboard
**Design Goal**: Data-dense, analytical, focused on moderation and platform health.

- **Data Tables**: Paginated, sortable tables for Users, Facilities, and Shifts.
- **Verification Queue**: Dedicated UI for admins to review uploaded worker credentials (PDF/Image viewer alongside approval/rejection buttons).
- **System Health**: Real-time charts showing shift fulfillment rates and Socket.io active connections.

## 4. Interaction & Motion Design
- **Transitions**: Smooth, fast fade-ins and slide-ups (`0.2s` to `0.3s` ease) for modals and page routing to make the app feel snappy.
- **Real-Time Feedback**: When a shift is matched, use subtle visual cues (e.g., a brief flash of success green or a toast notification) via Socket.io events.
