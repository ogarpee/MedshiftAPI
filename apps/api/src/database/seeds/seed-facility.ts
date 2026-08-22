import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AccountStatus, ClinicalRole, FacilityType, OnboardingStatus, ShiftStatus, UserRole } from "@medshift/shared-types";
import { createConnection, Types } from "mongoose";
import { PasswordService } from "../../auth/password.service";
import { FacilityProfile, FacilityProfileSchema } from "../schemas/facility-profile.schema";
import { Shift, ShiftSchema } from "../schemas/shift.schema";
import { User, UserSchema } from "../schemas/user.schema";

const defaultFacilityEmail = "facility@medshift.ca";
const defaultFacilityPassword = "Facility123456!";
const defaultFacilityName = "Bow Valley Care Centre";
const defaultLocation: [number, number] = [-114.0719, 51.0447];

async function seedFacility() {
  loadEnvFiles();

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI. Add it to .env before running the facility seed.");
  }

  const email = normalizeEmail(process.env.FACILITY_SEED_EMAIL ?? defaultFacilityEmail);
  const password = process.env.FACILITY_SEED_PASSWORD ?? defaultFacilityPassword;
  const facilityName = process.env.FACILITY_SEED_NAME ?? defaultFacilityName;

  if (password.length < 8) {
    throw new Error("FACILITY_SEED_PASSWORD must be at least 8 characters.");
  }

  const connection = await createConnection(mongoUri).asPromise();
  const users = connection.model(User.name, UserSchema);
  const facilityProfiles = connection.model(FacilityProfile.name, FacilityProfileSchema);
  const shifts = connection.model(Shift.name, ShiftSchema);
  const passwordService = new PasswordService();
  const passwordHash = await passwordService.hash(password);
  const now = new Date();

  const user = await users.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        passwordHash,
        role: UserRole.Facility,
        status: AccountStatus.Active,
        emailVerified: true,
        emailVerifiedAt: now,
        emailVerificationTokenHash: undefined,
        emailVerificationTokenExpiresAt: undefined,
        emailVerificationSentAt: undefined,
        passwordResetTokenHash: undefined,
        passwordResetTokenExpiresAt: undefined,
        passwordResetSentAt: undefined
      }
    },
    { new: true, upsert: true }
  ).exec();

  const facility = await facilityProfiles.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        userId: user._id,
        name: facilityName,
        facilityType: FacilityType.LongTermCare,
        address: {
          street: "1200 Centre Street NW",
          city: "Calgary",
          province: "AB",
          postalCode: "T2E 2R5",
          country: "CA"
        },
        location: { type: "Point", coordinates: defaultLocation },
        contactPerson: {
          name: "Amina Clarke",
          phone: "+1 403 555 0198",
          email
        },
        billingStatus: "ACTIVE",
        readiness: {
          billingContactEmail: email,
          paymentMethodLabel: "Seeded Visa ending 4242",
          staffingContactConfirmed: true,
          acceptedTermsAt: now
        },
        onboarding: {
          completedAt: now,
          verificationStatus: OnboardingStatus.Approved,
          rejectedReason: undefined
        },
        stats: {
          averageRating: 4.8
        }
      }
    },
    { new: true, upsert: true }
  ).exec();

  await shifts.deleteMany({
    facilityId: facility._id,
    description: { $regex: /^Seeded dashboard / }
  }).exec();

  await shifts.insertMany(buildSeedShifts(facility._id, now));
  await connection.close();

  console.log(`Seeded verified facility user: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Facility profile: ${facilityName}`);
  console.log("Open http://localhost:3000/login and sign in with the facility credentials to test /facility.");
}

function buildSeedShifts(facilityId: Types.ObjectId, now: Date) {
  return [
    {
      facilityId,
      roleRequired: ClinicalRole.Hca,
      startTime: addHours(now, 4),
      endTime: addHours(now, 12),
      hourlyRate: 34,
      status: ShiftStatus.Open,
      location: { type: "Point", coordinates: defaultLocation },
      description: "Seeded dashboard memory care day coverage"
    },
    {
      facilityId,
      roleRequired: ClinicalRole.Rn,
      startTime: addHours(now, 26),
      endTime: addHours(now, 34),
      hourlyRate: 52,
      status: ShiftStatus.Open,
      location: { type: "Point", coordinates: defaultLocation },
      description: "Seeded dashboard medication pass coverage"
    },
    {
      facilityId,
      roleRequired: ClinicalRole.Lpn,
      startTime: addHours(now, -30),
      endTime: addHours(now, -22),
      hourlyRate: 44,
      status: ShiftStatus.Completed,
      location: { type: "Point", coordinates: defaultLocation },
      description: "Seeded dashboard completed evening coverage"
    }
  ];
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function loadEnvFiles() {
  for (const path of getEnvFilePaths()) {
    if (!existsSync(path)) {
      continue;
    }

    const contents = readFileSync(path, "utf8");

    for (const line of contents.split(/\r?\n/)) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmedLine.indexOf("=");

      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const value = trimmedLine.slice(separatorIndex + 1).trim();

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function getEnvFilePaths() {
  return [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env"), join(__dirname, "../../../../.env")];
}

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

seedFacility().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
