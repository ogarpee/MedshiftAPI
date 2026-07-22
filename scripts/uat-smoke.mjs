import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const checks = [
  {
    name: "public marketing waitlist posts to API",
    file: "apps/web/app/page.tsx",
    includes: ["/waitlist", "UserRole.Worker", "UserRole.Facility", "medshift.authUser", "nav-profile-menu", "Go to dashboard", "Logout"]
  },
  {
    name: "worker portal includes realtime matching and review flow",
    file: "apps/web/app/worker/page.tsx",
    includes: ["/matching/open-shifts", "socket.io-client", "/reviews/shifts/", "worker-review-form", "ShiftMap", "NEXT_PUBLIC_MAPBOX_TOKEN", "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN"],
    excludes: ["label: \"Facility portal\""]
  },
  {
    name: "worker shift map loads Mapbox GL pins",
    file: "apps/web/app/worker/shift-map.tsx",
    includes: ["mapbox-gl-js", "mapbox://styles/mapbox/streets-v12", "shift-map-marker", "Select a pin to inspect a shift"]
  },
  {
    name: "facility portal includes posting and review flow",
    file: "apps/web/app/facility/page.tsx",
    includes: ["DashboardShell", "/shifts", "/reviews/shifts/", "review-inline-form", "facility-profiles/onboarding-status", "/facility/onboarding"]
  },
  {
    name: "facility onboarding captures profile billing readiness and review submission",
    file: "apps/web/app/facility/onboarding/page.tsx",
    includes: ["onboarding-standalone-page", "MedShiftLogo", "onboarding-status-chip", "draftKey", "NEXT_PUBLIC_MAPBOX_TOKEN", "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "OnboardingMap", "Save and continue", "billingContactEmail", "paymentMethodLabel", "staffingContactConfirmed", "facility-profiles"],
    excludes: ["DashboardShell", "onboarding-standalone-topbar", ">Roster<"]
  },
  {
    name: "shared onboarding map loads Mapbox GL with fallback",
    file: "apps/web/app/onboarding-map.tsx",
    includes: ["mapbox-gl-js", "mapbox://styles/mapbox/streets-v12", "Click or drag the pin", "Mapbox could not load"]
  },
  {
    name: "worker credential upload uses Cloudinary",
    file: "apps/web/app/cloudinary-upload-field.tsx",
    includes: ["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET", "api.cloudinary.com", "secure_url", "upload_preset"]
  },
  {
    name: "web next config exposes monorepo public env values",
    file: "apps/web/next.config.ts",
    includes: ["loadPublicEnvFiles", "repoRoot", "NEXT_PUBLIC_MAPBOX_TOKEN", "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "env: getPublicEnv()"]
  },
  {
    name: "admin portal includes live overview and credential review",
    file: "apps/admin/app/page.tsx",
    includes: ["DashboardShell", "/admin/overview", "/credentials/", "facilityQueue", "queueFilter", "reviewWorkerOnboarding", "reviewFacilityOnboarding", "health-bar"]
  },
  {
    name: "api supports admin worker and facility onboarding reviews",
    file: "apps/api/src/admin/admin.controller.ts",
    includes: ["worker-profiles/:workerId/onboarding", "facility-profiles/:facilityId/onboarding", "ReviewOnboardingDto"]
  },
  {
    name: "admin onboarding review updates status and sends emails",
    file: "apps/api/src/admin/admin.service.ts",
    includes: ["reviewWorkerOnboarding", "reviewFacilityOnboarding", "OnboardingStatus.Approved", "OnboardingStatus.Rejected", "sendOnboardingReviewResult"]
  },
  {
    name: "notification service sends onboarding review result emails",
    file: "apps/api/src/notifications/notification.service.ts",
    includes: ["sendOnboardingReviewResult", "MedShift onboarding approved", "MedShift onboarding needs updates"]
  },
  {
    name: "api exposes auth, shifts, matching, notifications, reviews, and admin modules",
    file: "apps/api/src/app.module.ts",
    includes: ["AuthModule", "ShiftsModule", "MatchingModule", "NotificationModule", "ReviewsModule", "AdminModule"]
  },
  {
    name: "auth recovery and toast feedback are implemented",
    file: "apps/web/app/auth/password-recovery-panel.tsx",
    includes: ["forgot-password", "reset-password", "useToast", "Reset password"]
  },
  {
    name: "api supports forgot and reset password endpoints",
    file: "apps/api/src/auth/auth.controller.ts",
    includes: ["forgot-password", "reset-password", "ForgotPasswordDto", "ResetPasswordDto"]
  },
  {
    name: "registration uses email OTP and completion endpoints",
    file: "apps/api/src/auth/auth.controller.ts",
    includes: ["register/start", "register/verify-otp", "register/complete"]
  },
  {
    name: "registration enforces facility work email and development OTP",
    file: "apps/api/src/auth/auth.service.ts",
    includes: ["FACILITY_WORK_EMAIL_REQUIRED", "NODE_ENV", "123456", "createRegistrationOtp"]
  },
  {
    name: "completed registration sends welcome email",
    file: "apps/api/src/auth/auth.service.ts",
    includes: ["async completeRegistration", "deleteOne({ _id: attempt._id })", "sendWelcomeEmail(user.email, user.role)"]
  },
  {
    name: "shared types expose onboarding verification statuses",
    file: "packages/shared-types/src/index.ts",
    includes: ["OnboardingStatus", "INCOMPLETE", "PENDING_REVIEW", "APPROVED", "REJECTED", "OnboardingState"]
  },
  {
    name: "profile APIs expose authenticated onboarding status routes",
    file: "apps/api/src/profiles/worker-profiles.controller.ts",
    includes: ["onboarding-status", "getOnboardingStatus", "UserRole.Worker"]
  },
  {
    name: "facility profile API exposes authenticated onboarding status route",
    file: "apps/api/src/profiles/facility-profiles.controller.ts",
    includes: ["onboarding-status", "getOnboardingStatus", "UserRole.Facility"]
  },
  {
    name: "shift actions require approved onboarding",
    file: "apps/api/src/shifts/shifts.service.ts",
    includes: ["ONBOARDING_APPROVAL_REQUIRED", "Facility onboarding must be approved before posting shifts", "Worker onboarding must be approved before accepting shifts"]
  },
  {
    name: "web registration includes OTP input step",
    file: "apps/web/app/auth/auth-form.tsx",
    includes: ["registrationStep", "otpDigits", "Verify code", "register/complete"]
  },
  {
    name: "web login redirects users by role",
    file: "apps/web/app/auth/auth-form.tsx",
    includes: ["getPostLoginHref", "onboarding-status", "UserRole.Facility", "UserRole.Admin", "NEXT_PUBLIC_ADMIN_URL", "medshift.authUser", "window.location.replace", "Opening your workspace...", "mode !== \"login\""]
  },
  {
    name: "web responsive polish and reduced motion support exists",
    file: "apps/web/app/styles.css",
    includes: ["dashboard-sidebar", "dashboard-topbar", "dashboard-avatar", "dashboard-icon-button", "onboarding-wizard-shell", "grid-template-rows: minmax(0, 1fr) auto", "onboarding-status-chip", "column-gap: 16px", ".step-list button.completed", "padding: 2px 6px 2px 2px", "margin-top: auto", "background: rgba(255, 255, 255, 0.94)", "min-height: min(620px, calc(100vh - 250px))", "@media (max-width: 480px)", "prefers-reduced-motion", "backdrop-filter", "softPulse"]
  },
  {
    name: "worker portal uses shared dashboard shell",
    file: "apps/web/app/worker/page.tsx",
    includes: ["DashboardShell", "navItems", "Shift board", "Nearby shifts", "worker-profiles/onboarding-status", "dashboard-onboarding-banner", "Continue onboarding", "/worker/onboarding"],
    excludes: ["label: \"Onboarding\"", "label: \"Reviews\"", "label: \"Facility portal\""]
  },
  {
    name: "worker onboarding captures profile credentials and consent",
    file: "apps/web/app/worker/onboarding/page.tsx",
    includes: ["onboarding-standalone-page", "MedShiftLogo", "onboarding-status-chip", "getStepButtonClass", "draftKey", "NEXT_PUBLIC_MAPBOX_TOKEN", "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "OnboardingMap", "CloudinaryUploadField", "Save and continue", "availableDays", "preferredShiftTypes", "credentialUrl", "backgroundConsent", "worker-profiles"],
    excludes: ["DashboardShell", "onboarding-standalone-topbar", ">Shift board<"]
  },
  {
    name: "registration sends workers to onboarding profile completion",
    file: "apps/web/app/auth/auth-form.tsx",
    includes: ["/worker/onboarding", "/facility/onboarding", "Proceed to worker profile", "Proceed to facility profile"]
  },
  {
    name: "admin responsive polish and reduced motion support exists",
    file: "apps/admin/app/styles.css",
    includes: ["@media (max-width: 480px)", "prefers-reduced-motion", "backdrop-filter", "health-bar"]
  },
  {
    name: "manual UAT checklist is documented",
    file: "docs/uat_checklist.md",
    includes: ["Worker Portal", "Facility Portal", "Admin Portal", "Review System", "Verification queue filters", "Onboarding approval/rejection"]
  }
];

const failures = [];

for (const check of checks) {
  const path = join(root, check.file);

  if (!existsSync(path)) {
    failures.push(`${check.name}: missing ${check.file}`);
    continue;
  }

  const contents = readFileSync(path, "utf8");
  const missing = check.includes.filter((item) => !contents.includes(item));
  const forbidden = check.excludes?.filter((item) => contents.includes(item)) ?? [];

  if (missing.length) {
    failures.push(`${check.name}: missing ${missing.join(", ")}`);
  }

  if (forbidden.length) {
    failures.push(`${check.name}: forbidden ${forbidden.join(", ")}`);
  }
}

if (failures.length) {
  console.error("UAT smoke failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`UAT smoke passed: ${checks.length} checks`);
