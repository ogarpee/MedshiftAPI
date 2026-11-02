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
  assert.match(workerProfiles, /existingRequired\.get\(category\) !== submittedRequired\.get\(category\)/);
  assert.match(facilityProfiles, /preserveApproved/);
  assert.match(facilityProfiles, /dto\.readiness !== undefined/);
  assert.match(facilityProfiles, /dto\.billingStatus !== undefined/);
});

test("worker profile final saves are idempotent and draft ownership is server-derived", () => {
  const controller = source("apps/api/src/profiles/worker-profiles.controller.ts");
  const profileService = source("apps/api/src/profiles/worker-profiles.service.ts");
  const draftDto = source("apps/api/src/profiles/dto/save-worker-onboarding-draft.dto.ts");
  const draftService = source("apps/api/src/profiles/worker-onboarding-drafts.service.ts");
  const webOnboarding = source("apps/web/app/worker/onboarding/page.tsx");
  const mobileRepository = source("apps/mobile/lib/src/features/worker/data/worker_repository.dart");
  const mobileController = source("apps/mobile/lib/src/features/onboarding/state/worker_onboarding_controller.dart");

  assert.match(controller, /@Put\("me"\)[\s\S]*saveMine/);
  assert.match(controller, /@Post\(\)[\s\S]*saveMine/);
  assert.match(profileService, /isDuplicateKeyError[\s\S]*racedProfile/);
  assert.match(profileService, /onboardingDrafts\.deleteOne/);
  assert.doesNotMatch(draftDto, /profileId/);
  assert.match(draftService, /profileId: profile\?\._id/);
  assert.doesNotMatch(draftService, /dto\.profileId/);
  assert.match(webOnboarding, /worker-profiles\/me[\s\S]*method: "PUT"/);
  assert.match(webOnboarding, /Retry sync/);
  assert.match(mobileRepository, /_dio\.put<Map<String, dynamic>>\([\s\S]*worker-profiles\/me/);
  assert.doesNotMatch(mobileRepository, /saveProfile\([\s\S]{0,150}profileId/);
  assert.match(mobileController, /syncError/);
});

test("worker documents use signed private Cloudinary uploads and upload-only clients", () => {
  const uploads = source("apps/api/src/uploads/uploads.service.ts");
  const profileService = source("apps/api/src/profiles/worker-profiles.service.ts");
  const onboarding = source("apps/web/app/worker/onboarding/page.tsx");
  const settings = source("apps/web/app/worker/settings/page.tsx");
  const mobileUpload = source("apps/mobile/lib/src/features/uploads/data/cloudinary_upload_service.dart");

  assert.match(uploads, /api_sign_request/);
  assert.match(uploads, /deliveryType = "authenticated"/);
  assert.match(uploads, /private_download_url/);
  assert.match(uploads, /expires_at:[\s\S]*\+ 300/);
  assert.match(profileService, /RequiredWorkerDocumentCategories\.every/);
  assert.match(profileService, /Manual worker document URLs are not allowed/);
  assert.match(onboarding, /title="Documents"/);
  assert.match(onboarding, /WorkerDocumentsField/);
  assert.doesNotMatch(onboarding, /Document link or reference|backgroundConsent|credentialType/);
  assert.match(settings, /WorkerDocumentsField/);
  assert.doesNotMatch(settings, /Document link or reference|backgroundConsent|credentialType/);
  assert.match(mobileUpload, /worker-documents\/sign/);
  assert.match(mobileUpload, /worker-documents\/complete/);
});

test("worker onboarding persists server drafts and exposes complete editable review sections", () => {
  const draftSchema = source("apps/api/src/database/schemas/worker-onboarding-draft.schema.ts");
  const draftService = source("apps/api/src/profiles/worker-onboarding-drafts.service.ts");
  const controller = source("apps/api/src/profiles/worker-profiles.controller.ts");
  const onboarding = source("apps/web/app/worker/onboarding/page.tsx");
  const mobileController = source("apps/mobile/lib/src/features/onboarding/state/worker_onboarding_controller.dart");
  const mobileScreen = source("apps/mobile/lib/src/features/onboarding/presentation/worker_onboarding_screen.dart");

  assert.match(draftSchema, /collection: "worker_onboarding_drafts"/);
  assert.match(draftSchema, /currentStep/);
  assert.match(draftSchema, /unique: true[\s\S]*userId!/);
  assert.match(draftService, /findOneAndUpdate/);
  assert.match(draftService, /medshift\/workers\/\$\{currentUser\.sub\}/);
  assert.match(controller, /@Get\("onboarding-draft"\)/);
  assert.match(controller, /@Put\("onboarding-draft"\)/);
  assert.match(controller, /@Delete\("onboarding-draft"\)/);
  assert.match(onboarding, /ServerDraft/);
  assert.match(onboarding, /ReviewSection title="Identity"/);
  assert.match(onboarding, /ReviewSection title="Documents"/);
  assert.match(onboarding, /formatDocumentMeta/);
  assert.match(mobileController, /Duration\(milliseconds: 700\)/);
  assert.match(mobileController, /syncNow/);
  assert.match(mobileScreen, /_ReviewSection/);
  assert.match(mobileScreen, /WidgetsBindingObserver/);
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
  assert.doesNotMatch(workerPage, /setIsPreviewMode/);
  assert.match(facilityPage, /Live facility dashboard data is unavailable/);
  assert.match(facilityPage, /setShifts\(\[\]\)/);
  assert.match(adminPage, /Live admin data is unavailable/);
  assert.match(adminPage, /setOverview\(emptyOverview\)/);
});

test("facility dashboard defaults to shifts and exposes settings without overview nav", () => {
  const facilityPage = source("apps/web/app/facility/page.tsx");
  const facilitySettingsPage = source("apps/web/app/facility/settings/page.tsx");
  const workerSettingsPage = source("apps/web/app/worker/settings/page.tsx");

  assert.doesNotMatch(facilityPage, /label:\s*"Overview"/);
  assert.match(facilityPage, /return "shifts"/);
  assert.match(facilityPage, /label:\s*"Settings"/);
  assert.match(facilitySettingsPage, /GET \/facility-profiles\/me|facility-profiles\/me/);
  assert.match(facilitySettingsPage, /facility-profiles\/\$\{profile\.id\}/);
  assert.match(workerSettingsPage, /label:\s*"Find Shifts"/);
  assert.match(workerSettingsPage, /id:\s*"security"/);
});

test("primary worker and facility dashboard routes use full-width operational workspaces", () => {
  const workerPage = source("apps/web/app/worker/page.tsx");
  const facilityPage = source("apps/web/app/facility/page.tsx");
  const styles = source("apps/web/app/styles.css");

  assert.match(workerPage, /activeSection === "shifts" \|\| activeSection === "reviews" \? " is-primary-workspace"/);
  assert.match(facilityPage, /className="facility-insight-grid"/);
  assert.match(styles, /\.worker-dashboard-grid\.is-primary-workspace[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.worker-shift-list\.compact[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.worker-review-card-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.facility-insight-grid[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});

test("worker shift discovery uses shared text search and checkable multi-select filters", () => {
  const dto = source("apps/api/src/matching/dto/browse-open-shifts.dto.ts");
  const matching = source("apps/api/src/matching/matching.service.ts");
  const sharedTypes = source("packages/shared-types/src/index.ts");
  const workerPage = source("apps/web/app/worker/page.tsx");
  const mobileRepository = source("apps/mobile/lib/src/features/shifts/data/shift_repository.dart");
  const mobileScreen = source("apps/mobile/lib/src/features/shifts/presentation/shift_board_screen.dart");
  const mobileProfile = source("apps/mobile/lib/src/features/settings/presentation/settings_screen.dart");
  const mobileShell = source("apps/mobile/lib/src/features/home/presentation/home_shell.dart");

  assert.match(dto, /search\?: string/);
  assert.match(dto, /roles\?: ClinicalRole\[\]/);
  assert.match(dto, /facilityTypes\?: FacilityType\[\]/);
  assert.match(dto, /shiftTypes\?: Array<"DAY" \| "EVENING" \| "NIGHT" \| "WEEKEND">/);
  assert.match(matching, /America\/Edmonton/);
  assert.match(matching, /escapeRegex/);
  assert.match(matching, /health care aide|registered nurse/);
  assert.match(sharedTypes, /ShiftSearchPeriod/);
  assert.match(workerPage, /Search facility, city, role, or description/);
  assert.match(workerPage, /FilterChecklist/);
  assert.match(workerPage, /Duration|350/);
  assert.match(mobileRepository, /filters\.roles\.map\(clinicalRoleToApi\)\.join/);
  assert.match(mobileScreen, /showModalBottomSheet<ShiftSearchFilters>/);
  assert.match(mobileScreen, /Duration\(milliseconds: 350\)/);
  assert.match(mobileProfile, /workerProfileSnapshotProvider/);
  assert.match(mobileShell, /WorkerOnboardingBanner/);
});

test("authenticated password changes require JWT and current password verification", () => {
  const authController = source("apps/api/src/auth/auth.controller.ts");
  const authService = source("apps/api/src/auth/auth.service.ts");
  const changePasswordDto = source("apps/api/src/auth/dto/change-password.dto.ts");
  const workerSettingsPage = source("apps/web/app/worker/settings/page.tsx");
  const facilitySettingsPage = source("apps/web/app/facility/settings/page.tsx");

  assert.match(authController, /@UseGuards\(JwtAuthGuard\)[\s\S]*@Patch\("password"\)/);
  assert.match(authController, /ChangePasswordDto/);
  assert.match(authService, /changePassword/);
  assert.match(authService, /passwordService\.verify\(dto\.currentPassword/);
  assert.match(authService, /passwordChangedAt\s*=\s*new Date\(\)/);
  assert.match(changePasswordDto, /@MinLength\(8\)[\s\S]*newPassword/);
  assert.match(workerSettingsPage, /auth\/password/);
  assert.match(facilitySettingsPage, /auth\/password/);
});

test("unverified login automatically resends verification and auth feedback is toast-only", () => {
  const authService = source("apps/api/src/auth/auth.service.ts");
  const authForm = source("apps/web/app/auth/auth-form.tsx");
  const passwordRecovery = source("apps/web/app/auth/password-recovery-panel.tsx");
  const verifyEmail = source("apps/web/app/auth/verify-email-panel.tsx");

  assert.match(authService, /verificationResendCooldownInSeconds\s*=\s*60/);
  assert.match(authService, /passwordService\.verify[\s\S]*resendVerificationIfAllowed/);
  assert.match(authService, /verificationEmailSent/);
  assert.match(authService, /retryAfterSeconds/);
  assert.match(authService, /findOneAndUpdate[\s\S]*emailVerificationSentAt/);
  assert.doesNotMatch(authForm, /verificationNotice|Resend verification email/);
  assert.doesNotMatch(authForm, /styles\.message/);
  assert.match(authForm, /notify\(formatAuthError\(result\), result\.verificationEmailSent \? "success" : "info"\)/);
  assert.match(authForm, /"Resend code"/);
  assert.doesNotMatch(passwordRecovery, /styles\.message/);
  assert.doesNotMatch(verifyEmail, /styles\.message/);
  assert.match(verifyEmail, /Resend verification email/);
});

test("web and admin API base URLs come from environment configuration", () => {
  const adminConfig = source("apps/admin/next.config.ts");
  const authForm = source("apps/web/app/auth/auth-form.tsx");
  const runtimeFiles = [
    "apps/admin/app/page.tsx",
    "apps/web/app/page.tsx",
    "apps/web/app/auth/auth-form.tsx",
    "apps/web/app/auth/password-recovery-panel.tsx",
    "apps/web/app/auth/verify-email-panel.tsx",
    "apps/web/app/facility/onboarding/page.tsx",
    "apps/web/app/facility/page.tsx",
    "apps/web/app/facility/settings/page.tsx",
    "apps/web/app/worker/onboarding/page.tsx",
    "apps/web/app/worker/page.tsx",
    "apps/web/app/worker/settings/page.tsx"
  ];

  for (const file of runtimeFiles) {
    const contents = source(file);
    assert.match(contents, /NEXT_PUBLIC_API_URL/);
    assert.doesNotMatch(contents, /http:\/\/localhost:4000/);
  }

  assert.match(adminConfig, /NEXT_PUBLIC_API_URL/);
  assert.match(adminConfig, /loadPublicEnvFiles/);
  assert.match(adminConfig, /repoRoot/);
  assert.match(authForm, /getMissingApiUrlMessage/);
  assert.match(authForm, /if \(!hasApiUrl\)/);
});

test("admin verification queue defaults to submitted profiles only", () => {
  const adminService = source("apps/api/src/admin/admin.service.ts");

  assert.match(adminService, /verificationStatus === OnboardingStatus\.PendingReview/);
  assert.doesNotMatch(adminService, /backgroundCheck\?\.status !== BackgroundCheckStatus\.Passed/);
});

test("marketplace core is additive across profiles, shifts, API routes, and dashboards", () => {
  const sharedTypes = source("packages/shared-types/src/index.ts");
  const workerProfileSchema = source("apps/api/src/database/schemas/worker-profile.schema.ts");
  const facilityProfileSchema = source("apps/api/src/database/schemas/facility-profile.schema.ts");
  const shiftSchema = source("apps/api/src/database/schemas/shift.schema.ts");
  const marketplaceSchema = source("apps/api/src/database/schemas/marketplace.schema.ts");
  const marketplaceController = source("apps/api/src/marketplace/marketplace.controller.ts");
  const marketplaceService = source("apps/api/src/marketplace/marketplace.service.ts");
  const appModule = source("apps/api/src/app.module.ts");
  const workerMarketplacePage = source("apps/web/app/worker/marketplace/page.tsx");
  const facilityMarketplacePage = source("apps/web/app/facility/marketplace/page.tsx");
  const adminPage = source("apps/admin/app/page.tsx");

  assert.match(sharedTypes, /ShiftApplicationStatus/);
  assert.match(sharedTypes, /AttendanceEventType/);
  assert.match(sharedTypes, /TimesheetStatus/);
  assert.match(sharedTypes, /DisputeStatus/);
  assert.match(workerProfileSchema, /professionalSummary/);
  assert.match(workerProfileSchema, /yearsExperience/);
  assert.match(workerProfileSchema, /reliabilityScore/);
  assert.match(facilityProfileSchema, /organizationName/);
  assert.match(facilityProfileSchema, /locations/);
  assert.match(shiftSchema, /caregiversRequired/);
  assert.match(shiftSchema, /requirements/);
  assert.match(marketplaceSchema, /ShiftApplication/);
  assert.match(marketplaceSchema, /ShiftInvitation/);
  assert.match(marketplaceSchema, /AttendanceEvent/);
  assert.match(marketplaceSchema, /Timesheet/);
  assert.match(marketplaceSchema, /AuditEvent/);
  assert.match(marketplaceController, /@Get\("shifts\/:id\/matches"\)/);
  assert.match(marketplaceController, /@Post\("attendance\/clock-in"\)/);
  assert.match(marketplaceController, /@Get\("audit-events"\)/);
  assert.match(marketplaceService, /findMatchingWorkerUserIdsForShift|calculateMatchScore/);
  assert.match(appModule, /MarketplaceModule/);
  assert.match(workerMarketplacePage, /\/matching\/open-shifts/);
  assert.match(workerMarketplacePage, /\/attendance\/clock-in/);
  assert.match(workerMarketplacePage, /\/timesheets/);
  assert.match(facilityMarketplacePage, /\/shifts\/\$\{shiftId\}\/matches/);
  assert.match(facilityMarketplacePage, /\/applications\/\$\{application\.id\}\/status/);
  assert.match(facilityMarketplacePage, /\/timesheets\/\$\{timesheet\.id\}/);
  assert.match(adminPage, /Marketplace oversight/);
  assert.match(adminPage, /\/audit-events/);
  assert.match(adminPage, /\/timesheets/);
  assert.match(adminPage, /\/disputes/);
});

test("marketplace gap closure exposes live me endpoints and mobile application workflow", () => {
  const sharedTypes = source("packages/shared-types/src/index.ts");
  const marketplaceController = source("apps/api/src/marketplace/marketplace.controller.ts");
  const marketplaceService = source("apps/api/src/marketplace/marketplace.service.ts");
  const marketplaceModule = source("apps/api/src/marketplace/marketplace.module.ts");
  const mobileModels = source("apps/mobile/lib/src/core/models/medshift_models.dart");
  const mobileRepository = source("apps/mobile/lib/src/features/shifts/data/shift_repository.dart");
  const mobileController = source("apps/mobile/lib/src/features/shifts/state/shift_board_controller.dart");
  const mobileShell = source("apps/mobile/lib/src/features/home/presentation/home_shell.dart");
  const workerMarketplacePage = source("apps/web/app/worker/marketplace/page.tsx");
  const facilityMarketplacePage = source("apps/web/app/facility/marketplace/page.tsx");
  const adminPage = source("apps/admin/app/page.tsx");

  assert.match(sharedTypes, /MarketplaceOverviewSummary/);
  assert.match(sharedTypes, /MarketplaceApplication/);
  assert.match(marketplaceController, /@Get\("applications\/me"\)/);
  assert.match(marketplaceController, /@Get\("invitations\/me"\)/);
  assert.match(marketplaceController, /@Get\("assignments\/me"\)/);
  assert.match(marketplaceController, /@Get\("attendance"\)/);
  assert.match(marketplaceController, /@Get\("marketplace\/overview"\)/);
  assert.match(marketplaceService, /assertApprovedWorker/);
  assert.match(marketplaceService, /assertNoScheduleConflict/);
  assert.match(marketplaceService, /findConfirmedAssignment/);
  assert.match(marketplaceService, /createAssignment/);
  assert.match(marketplaceService, /NotificationType\.MarketplaceAssignment/);
  assert.match(marketplaceModule, /NotificationModule/);
  assert.match(mobileModels, /ShiftApplicationSummary/);
  assert.match(mobileModels, /ShiftInvitationSummary/);
  assert.match(mobileRepository, /\/applications\/me/);
  assert.match(mobileRepository, /\/shifts\/\$shiftId\/applications/);
  assert.match(mobileRepository, /\/attendance\/clock-in/);
  assert.match(mobileRepository, /\/timesheets/);
  assert.match(mobileController, /applyToShift/);
  assert.doesNotMatch(mobileController, /acceptShift/);
  assert.match(mobileShell, /HomeOverviewScreen/);
  assert.match(mobileShell, /EarningsScreen/);
  assert.match(workerMarketplacePage, /\/applications\/me/);
  assert.match(workerMarketplacePage, /\/invitations\/me/);
  assert.match(facilityMarketplacePage, /\/assignments\/me/);
  assert.match(facilityMarketplacePage, /\/marketplace\/overview/);
  assert.match(adminPage, /\/marketplace\/overview/);
  assert.match(adminPage, /\/assignments\/me/);
  assert.match(adminPage, /\/attendance/);
});
