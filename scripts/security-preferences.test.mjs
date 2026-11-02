import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("two-factor login creates no session before the challenge is consumed", () => {
  const auth = source("apps/api/src/auth/auth.service.ts");
  const factors = source("apps/api/src/auth/two-factor.service.ts");
  assert.match(
    auth,
    /prepareLogin[\s\S]*if \(factor\.required\) return factor\.response[\s\S]*toAuthResponse/,
  );
  assert.match(auth, /consumeLoginChallenge[\s\S]*toAuthResponse/);
  assert.match(factors, /maxAttempts = 5/);
  assert.match(factors, /challengeLifetimeMs = 10 \* 60 \* 1000/);
  assert.match(factors, /resendCooldownMs = 60 \* 1000/);
  assert.match(factors, /timingSafeEqual/);
  assert.match(factors, /recoveryCodeHashes\.splice/);
});

test("two-factor secrets and trusted device tokens use protected storage", () => {
  const schema = source("apps/api/src/database/schemas/two-factor.schema.ts");
  const factors = source("apps/api/src/auth/two-factor.service.ts");
  assert.match(schema, /collection: "two_factor_credentials"/);
  assert.match(schema, /collection: "trusted_devices"/);
  assert.match(factors, /aes-256-gcm/);
  assert.match(factors, /tokenHash: this\.hash\(token\)/);
  assert.match(
    factors,
    /trustedDeviceLifetimeMs = 30 \* 24 \* 60 \* 60 \* 1000/,
  );
  assert.doesNotMatch(schema, /trustedDeviceToken!/);
});

test("notification preferences default on and keep security alerts mandatory", () => {
  const preferences = source(
    "apps/api/src/notifications/notification-preferences.service.ts",
  );
  const notifications = source(
    "apps/api/src/notifications/notification.service.ts",
  );
  assert.match(preferences, /AccountAndSecurity.*inApp: true, email: true/s);
  assert.match(
    preferences,
    /category === NotificationCategory\.AccountAndSecurity\) return true/,
  );
  assert.match(
    notifications,
    /preferences\.permits\(payload\.userId, payload\.type, "inApp"\)/,
  );
});

test("worker web and mobile expose notification and two-factor management", () => {
  const web = source("apps/web/app/worker/settings/page.tsx");
  const webStyles = source("apps/web/app/styles.css");
  const webSecurity = source(
    "apps/web/app/worker/settings/security-settings.tsx",
  );
  const login = source("apps/web/app/auth/auth-form.tsx");
  const mobile = source(
    "apps/mobile/lib/src/features/settings/presentation/settings_screen.dart",
  );
  const mobileSecurity = source(
    "apps/mobile/lib/src/features/settings/presentation/account_preferences_sections.dart",
  );
  assert.match(web, /id: "notifications"/);
  assert.match(web, /setActiveTab\("notifications"\)/);
  assert.match(web, /needsOnboarding && !isAccountTab/);
  assert.match(
    webStyles,
    /\.dashboard-shell \.worker-settings-tabs button \{[\s\S]*?color: var\(--dashboard-muted-strong\)/,
  );
  assert.match(webSecurity, /QRCodeSVG/);
  assert.match(webSecurity, /Trusted devices/);
  assert.match(login, /Trust this device for 30 days/);
  assert.match(mobile, /NotificationPreferencesSection/);
  assert.match(mobile, /AccountSecuritySection/);
  assert.match(mobile, /_AccountSettingsShortcuts/);
  assert.match(mobile, /Security & 2FA/);
  assert.match(mobile, /WorkerOnboardingProfileCard/);
  assert.match(mobileSecurity, /showModalBottomSheet/);
  assert.match(mobileSecurity, /SecurityCredentialsSheet/);
  assert.match(mobileSecurity, /RecoveryCodesSheet/);
  assert.match(mobileSecurity, /PopScope\([\s\S]*?canPop: false/);
  assert.doesNotMatch(mobileSecurity, /showDialog|AlertDialog/);
});
