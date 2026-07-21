import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const checks = [
  {
    name: "public marketing waitlist posts to API",
    file: "apps/web/app/page.tsx",
    includes: ["/waitlist", "UserRole.Worker", "UserRole.Facility"]
  },
  {
    name: "worker portal includes realtime matching and review flow",
    file: "apps/web/app/worker/page.tsx",
    includes: ["/matching/open-shifts", "socket.io-client", "/reviews/shifts/", "worker-review-form"]
  },
  {
    name: "facility portal includes posting and review flow",
    file: "apps/web/app/facility/page.tsx",
    includes: ["/shifts", "/reviews/shifts/", "review-inline-form"]
  },
  {
    name: "admin portal includes live overview and credential review",
    file: "apps/admin/app/page.tsx",
    includes: ["/admin/overview", "/credentials/", "health-bar"]
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
    name: "web responsive polish and reduced motion support exists",
    file: "apps/web/app/styles.css",
    includes: ["@media (max-width: 480px)", "prefers-reduced-motion", "backdrop-filter", "softPulse"]
  },
  {
    name: "admin responsive polish and reduced motion support exists",
    file: "apps/admin/app/styles.css",
    includes: ["@media (max-width: 480px)", "prefers-reduced-motion", "backdrop-filter", "health-bar"]
  },
  {
    name: "manual UAT checklist is documented",
    file: "docs/uat_checklist.md",
    includes: ["Worker Portal", "Facility Portal", "Admin Portal", "Review System"]
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

  if (missing.length) {
    failures.push(`${check.name}: missing ${missing.join(", ")}`);
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
