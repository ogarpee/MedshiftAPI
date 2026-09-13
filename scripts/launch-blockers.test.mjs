import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("worker and facility registration remains pending until onboarding approval", () => {
  const authService = source("apps/api/src/auth/auth.service.ts");
  const adminService = source("apps/api/src/admin/admin.service.ts");

  assert.match(authService, /status:\s*AccountStatus\.Pending/);
  assert.doesNotMatch(authService, /completeRegistration[\s\S]*status:\s*AccountStatus\.Active/);
  assert.match(adminService, /user\.status\s*=\s*AccountStatus\.Active/);
});

test("approved onboarding is preserved unless sensitive profile fields change", () => {
  const workerProfiles = source("apps/api/src/profiles/worker-profiles.service.ts");
  const facilityProfiles = source("apps/api/src/profiles/facility-profiles.service.ts");

  assert.match(workerProfiles, /preserveApproved/);
  assert.match(workerProfiles, /dto\.credentials !== undefined/);
  assert.match(workerProfiles, /dto\.backgroundCheck !== undefined/);
  assert.match(facilityProfiles, /preserveApproved/);
  assert.match(facilityProfiles, /dto\.readiness !== undefined/);
  assert.match(facilityProfiles, /dto\.billingStatus !== undefined/);
});

test("realtime shift sockets require authentication and server-derived rooms", () => {
  const gateway = source("apps/api/src/realtime/shifts.gateway.ts");
  const workerPage = source("apps/web/app/worker/page.tsx");
  const facilityPage = source("apps/web/app/facility/page.tsx");

  assert.match(gateway, /jwtService\.verifyAsync/);
  assert.match(gateway, /client\.disconnect\(true\)/);
  assert.match(gateway, /worker-user:\$\{user\.sub\}/);
  assert.match(gateway, /facility:\$\{facility\.id\}/);
  assert.doesNotMatch(gateway, /payload\.id/);
  assert.match(workerPage, /auth:\s*\{\s*token\s*\}/);
  assert.match(facilityPage, /auth:\s*\{\s*token\s*\}/);
});

test("authenticated dashboard failures do not fall back to preview data", () => {
  const workerPage = source("apps/web/app/worker/page.tsx");
  const facilityPage = source("apps/web/app/facility/page.tsx");
  const adminPage = source("apps/admin/app/page.tsx");

  assert.match(workerPage, /Live worker dashboard data is unavailable/);
  assert.match(workerPage, /setIsPreviewMode\(false\)/);
  assert.match(facilityPage, /Live facility dashboard data is unavailable/);
  assert.match(facilityPage, /setShifts\(\[\]\)/);
  assert.match(adminPage, /Live admin data is unavailable/);
  assert.match(adminPage, /setOverview\(emptyOverview\)/);
});

test("admin verification queue defaults to submitted profiles only", () => {
  const adminService = source("apps/api/src/admin/admin.service.ts");

  assert.match(adminService, /verificationStatus === OnboardingStatus\.PendingReview/);
  assert.doesNotMatch(adminService, /backgroundCheck\?\.status !== BackgroundCheckStatus\.Passed/);
});
