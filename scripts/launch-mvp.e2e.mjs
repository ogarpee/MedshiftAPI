import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";

process.loadEnvFile?.(".env");

const requireFromApi = createRequire(new URL("../apps/api/package.json", import.meta.url));
const { createConnection, Types } = requireFromApi("mongoose");

const port = Number(process.env.E2E_PORT ?? 4100);
const baseUrl = `http://127.0.0.1:${port}`;
const password = "LaunchMvp123!";
const runId = Date.now();
const api = spawn(process.execPath, ["apps/api/dist/main.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: String(port), NODE_ENV: "test", ALLOW_DEV_OTPS: "true" },
  stdio: ["ignore", "pipe", "pipe"]
});
let serverOutput = "";
api.stdout.on("data", (chunk) => (serverOutput += chunk));
api.stderr.on("data", (chunk) => (serverOutput += chunk));

try {
  await waitForApi();
  await verifyAutomaticVerificationResend();
  const admin = await login(process.env.ADMIN_SEED_EMAIL ?? "admin@medshift.ca", process.env.ADMIN_SEED_PASSWORD ?? "Admin123456!");
  const facility = await register(`facility-${runId}@launch-mvp.test`, "FACILITY");
  const workers = await Promise.all([1, 2, 3].map((index) => register(`worker${index}-${runId}@launch-mvp.test`, "WORKER")));

  const facilityProfile = await request("/facility-profiles", {
    method: "POST",
    token: facility.accessToken,
    body: {
      name: "Launch MVP Care Centre",
      facilityType: "LONG_TERM_CARE",
      address: { street: "10 Test Street", city: "Toronto", province: "ON", postalCode: "M1M 1M1", country: "Canada" },
      location: point(),
      contactPerson: { name: "Test Coordinator", phone: "+14165550100", email: "coordinator@launch-mvp.test" },
      billingStatus: "ACTIVE",
      readiness: {
        billingContactEmail: "billing@launch-mvp.test",
        paymentMethodLabel: "Invoice account",
        staffingContactConfirmed: true,
        acceptedTermsAt: new Date().toISOString()
      }
    }
  });
  const workerProfiles = [];
  for (let index = 0; index < workers.length; index += 1) {
    const documents = await createTestDocuments(workers[index]);
    const workerProfilePayload = {
      firstName: `Worker${index + 1}`,
      lastName: "Launch",
      title: "PSW",
      yearsExperience: 3,
      documents,
      location: point(),
      preferences: { maxDistanceKm: 25, availableDays: ["MONDAY", "TUESDAY"], preferredShiftTypes: ["DAY"] }
    };
    if (index === 0) {
      await request("/worker-profiles/onboarding-draft", {
        method: "PUT",
        token: workers[index].accessToken,
        body: { currentStep: 3, data: workerProfilePayload, profileId: admin.user.id }
      });
      const resumedDraft = await request("/worker-profiles/onboarding-draft", { token: workers[index].accessToken });
      assert.equal(resumedDraft.currentStep, 3, "worker onboarding resumes its saved step");
      assert.equal(resumedDraft.profileId, null, "draft association ignores client-supplied profile IDs");
      assert.equal(resumedDraft.data.documents.length, 3, "worker onboarding draft keeps uploaded documents");
      const draftAccess = await request(`/uploads/worker-documents/${documents[0].id}/access-url`, { token: workers[index].accessToken });
      assert.equal(draftAccess.expiresInSeconds, 300, "draft documents have owner-only signed previews");
      await request(`/uploads/worker-documents/${documents[0].id}/access-url`, { token: workers[1].accessToken, expected: 404 });
    }
    if (index === 0) {
      const firstSave = await request("/worker-profiles/me", {
        method: "PUT",
        token: workers[index].accessToken,
        body: workerProfilePayload
      });
      const lostResponseRetry = await request("/worker-profiles/me", {
        method: "PUT",
        token: workers[index].accessToken,
        body: { ...workerProfilePayload, firstName: "Worker1 Retry" }
      });
      assert.equal(lostResponseRetry.id, firstSave.id, "repeated canonical saves update one profile");
      const legacyRetry = await request("/worker-profiles", {
        method: "POST",
        token: workers[index].accessToken,
        body: workerProfilePayload
      });
      assert.equal(legacyRetry.id, firstSave.id, "legacy POST retries are idempotent");
      workerProfiles.push(legacyRetry);
    } else if (index === 2) {
      const simultaneous = await Promise.all([
        request("/worker-profiles/me", { method: "PUT", token: workers[index].accessToken, body: workerProfilePayload }),
        request("/worker-profiles/me", { method: "PUT", token: workers[index].accessToken, body: workerProfilePayload })
      ]);
      assert.equal(simultaneous[0].id, simultaneous[1].id, "simultaneous first saves converge on one profile");
      workerProfiles.push(simultaneous[0]);
    } else {
      workerProfiles.push(await request("/worker-profiles", {
        method: "POST",
        token: workers[index].accessToken,
        body: workerProfilePayload
      }));
    }
    if (index === 0) {
      assert.equal(await request("/worker-profiles/onboarding-draft", { token: workers[index].accessToken }), null, "successful submission clears the server draft");
    }
  }
  await assertSingleWorkerProfiles(workers);

  const workerAccess = await request(`/uploads/worker-documents/${workerProfiles[0].id}/${workerProfiles[0].documents[0].id}/access-url`, { token: workers[0].accessToken });
  assert.ok(workerAccess.url && workerAccess.expiresInSeconds === 300, "workers receive short-lived access to their own document");
  await request(`/uploads/worker-documents/${workerProfiles[0].id}/${workerProfiles[0].documents[0].id}/access-url`, { token: workers[1].accessToken, expected: 403 });
  await request(`/uploads/worker-documents/${workerProfiles[0].id}/${workerProfiles[0].documents[0].id}/access-url`, { token: admin.accessToken });

  await request(`/admin/facility-profiles/${facilityProfile.id}/onboarding`, { method: "PATCH", token: admin.accessToken, body: { approved: true } });
  for (const profile of workerProfiles) {
    for (const document of profile.documents) {
      await request(`/admin/worker-profiles/${profile.id}/documents/${document.id}`, { method: "PATCH", token: admin.accessToken, body: { approved: true } });
    }
    await request(`/admin/worker-profiles/${profile.id}/onboarding`, { method: "PATCH", token: admin.accessToken, body: { approved: true } });
  }

  const startTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + 8 * 60 * 60 * 1000);
  const shift = await request("/shifts", {
    method: "POST",
    token: facility.accessToken,
    body: {
      roleRequired: "PSW",
      title: "Concurrent capacity test",
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      hourlyRate: 32,
      caregiversRequired: 2,
      visibility: "OPEN",
      location: point()
    }
  });

  const attempts = await Promise.all(workers.map((worker) => request(`/shifts/${shift.id}/accept`, { method: "POST", token: worker.accessToken, expected: [201, 400] })));
  assert.equal(attempts.filter((result) => result.status === 201).length, 2, "exactly two concurrent quick accepts must succeed");
  assert.equal(attempts.filter((result) => result.status === 400).length, 1, "capacity must reject the third quick accept");

  const assignedWorkers = [];
  for (const worker of workers) {
    const assignments = await request("/assignments/me", { token: worker.accessToken });
    if (assignments.length) assignedWorkers.push({ ...worker, assignment: assignments[0] });
  }
  assert.equal(assignedWorkers.length, 2);

  for (const worker of assignedWorkers) {
    const clockInAt = new Date(Date.now() - 10 * 60 * 1000);
    const clockOutAt = new Date(Date.now() - 60 * 1000);
    await request("/attendance/clock-in", {
      method: "POST",
      token: worker.accessToken,
      body: { shiftId: shift.id, idempotencyKey: `clock-in-${worker.user.id}`, occurredAt: clockInAt.toISOString() }
    });
    await request("/attendance/clock-out", {
      method: "POST",
      token: worker.accessToken,
      body: { shiftId: shift.id, idempotencyKey: `clock-out-${worker.user.id}`, occurredAt: clockOutAt.toISOString() }
    });
    worker.timesheet = await request("/timesheets", { method: "POST", token: worker.accessToken, body: { shiftId: shift.id, breakMinutes: 0 } });
  }
  for (const worker of assignedWorkers) {
    await request(`/timesheets/${worker.timesheet.id}`, { method: "PATCH", token: facility.accessToken, body: { status: "APPROVED" } });
  }
  const completedShift = await request(`/shifts/${shift.id}`, { token: facility.accessToken });
  assert.equal(completedShift.status, "COMPLETED", "all active assignment timesheets must be approved before completion");

  for (const worker of assignedWorkers) {
    await request(`/reviews/shifts/${shift.id}`, { method: "POST", token: facility.accessToken, body: { assignmentId: worker.assignment.id, rating: 5, comment: "Verified caregiver journey" } });
    await request(`/reviews/shifts/${shift.id}`, { method: "POST", token: worker.accessToken, body: { assignmentId: worker.assignment.id, rating: 5, comment: "Verified facility journey" } });
  }
  const dispute = await request("/disputes", {
    method: "POST",
    token: assignedWorkers[0].accessToken,
    body: { assignmentId: assignedWorkers[0].assignment.id, reason: "Automated participant-access verification" }
  });
  await request(`/disputes/${dispute.id}`, { method: "PATCH", token: admin.accessToken, body: { status: "RESOLVED", resolutionNotes: "E2E verified" } });

  const refreshed = await request("/auth/refresh", { method: "POST", body: { refreshToken: assignedWorkers[0].refreshToken } });
  assert.ok(refreshed.accessToken && refreshed.refreshToken, "mobile refresh must rotate both credentials");
  await request("/auth/logout", { method: "POST", token: refreshed.accessToken });
  await request("/auth/me", { token: refreshed.accessToken, expected: 401 });

  await request(`/admin/users/${assignedWorkers[1].user.id}/status`, { method: "PATCH", token: admin.accessToken, body: { status: "SUSPENDED" } });
  await request("/auth/me", { token: assignedWorkers[1].accessToken, expected: 401 });

  console.log("Launch MVP API journey passed: onboarding, concurrent staffing, attendance, timesheets, reviews, disputes, refresh/logout, and suspension.");
} catch (error) {
  if (serverOutput.trim()) console.error(serverOutput.trim());
  throw error;
} finally {
  api.kill("SIGTERM");
}

async function register(email, role) {
  await request("/auth/register/start", { method: "POST", body: { email, role } });
  const verified = await request("/auth/register/verify-otp", { method: "POST", body: { email, otp: "123456" } });
  return request("/auth/register/complete", {
    method: "POST",
    body: { email, registrationToken: verified.registrationToken, password, role, clientType: "MOBILE" }
  });
}

async function login(email, loginPassword) {
  return request("/auth/login", { method: "POST", body: { email, password: loginPassword, clientType: "MOBILE" } });
}

async function verifyAutomaticVerificationResend() {
  const email = `unverified-${runId}@launch-mvp.test`;
  const registration = await request("/auth/register", { method: "POST", body: { email, password, role: "WORKER" } });
  const connection = await createConnection(process.env.MONGODB_URI).asPromise();
  try {
    const users = connection.collection("users");
    const sessions = connection.collection("sessions");
    const initialUser = await users.findOne({ email });
    assert.ok(initialUser?.emailVerificationSentAt, "legacy registration must establish the initial verification send window");

    const wrongPassword = await request("/auth/login", {
      method: "POST",
      body: { email, password: "WrongPassword123!", clientType: "MOBILE" },
      expected: 401
    });
    assert.equal(wrongPassword.message, "Invalid email or password");
    const afterWrongPassword = await users.findOne({ email });
    assert.equal(
      afterWrongPassword.emailVerificationSentAt.getTime(),
      initialUser.emailVerificationSentAt.getTime(),
      "incorrect passwords must not reserve or send verification email"
    );

    const cooldownResponse = await request("/auth/login", {
      method: "POST",
      body: { email, password, clientType: "MOBILE" },
      expected: 401
    });
    assert.equal(cooldownResponse.code, "EMAIL_VERIFICATION_REQUIRED");
    assert.equal(cooldownResponse.verificationEmailSent, false);
    assert.ok(cooldownResponse.retryAfterSeconds > 0 && cooldownResponse.retryAfterSeconds <= 60);

    await users.updateOne({ email }, { $set: { emailVerificationSentAt: new Date(0) } });
    const resendResponse = await request("/auth/login", {
      method: "POST",
      body: { email, password, clientType: "MOBILE" },
      expected: 401
    });
    assert.equal(resendResponse.code, "EMAIL_VERIFICATION_REQUIRED");
    assert.equal(resendResponse.verificationEmailSent, true);
    assert.equal(await sessions.countDocuments({ userId: initialUser._id }), 0, "unverified login must not create a session");
    assert.equal(registration.user.emailVerified, false);
  } finally {
    await connection.close();
  }
}

async function createTestDocuments(worker) {
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  assert.ok(apiSecret, "CLOUDINARY_API_SECRET is required for document E2E verification");
  const documents = [];
  for (const category of ["GOVERNMENT_ID", "PROFESSIONAL_CERTIFICATE", "BACKGROUND_CHECK"]) {
    const signed = await request("/uploads/worker-documents/sign", {
      method: "POST",
      token: worker.accessToken,
      body: { category, fileName: `${category.toLowerCase()}.pdf`, mimeType: "application/pdf", sizeBytes: 128 }
    });
    const version = 1;
    const signature = createHash("sha1").update(`public_id=${signed.publicId}&version=${version}${apiSecret}`).digest("hex");
    documents.push(await request("/uploads/worker-documents/complete", {
      method: "POST",
      token: worker.accessToken,
      body: {
        category,
        publicId: signed.publicId,
        resourceType: "image",
        deliveryType: "authenticated",
        version,
        format: "pdf",
        bytes: 128,
        originalFilename: `${category.toLowerCase()}.pdf`,
        signature
      }
    }));
  }
  return documents;
}

async function assertSingleWorkerProfiles(workers) {
  const connection = await createConnection(process.env.MONGODB_URI).asPromise();
  try {
    for (const worker of workers) {
      const count = await connection.collection("worker_profiles").countDocuments({
        userId: new Types.ObjectId(worker.user.id)
      });
      assert.equal(count, 1, "each authenticated worker must have exactly one profile");
    }
  } finally {
    await connection.close();
  }
}

async function request(path, { method = "GET", body, token, expected } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const responseText = await response.text();
  let payload = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = {};
    }
  }
  const expectedStatus = expected ?? (method === "POST" ? 201 : 200);
  const allowed = Array.isArray(expectedStatus) ? expectedStatus : [expectedStatus];
  assert.ok(allowed.includes(response.status), `${method} ${path} returned ${response.status}: ${JSON.stringify(payload)}`);
  return Array.isArray(expectedStatus) ? { status: response.status, payload } : payload;
}

async function waitForApi() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (api.exitCode !== null) throw new Error(`API exited before readiness with code ${api.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("API did not become ready within 30 seconds");
}

function point() {
  return { type: "Point", coordinates: [-79.3832, 43.6532] };
}
