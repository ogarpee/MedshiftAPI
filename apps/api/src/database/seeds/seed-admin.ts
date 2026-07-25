import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AccountStatus, UserRole } from "@medshift/shared-types";
import { createConnection } from "mongoose";
import { PasswordService } from "../../auth/password.service";
import { User, UserSchema } from "../schemas/user.schema";

const defaultAdminEmail = "admin@medshift.ca";
const defaultAdminPassword = "Admin123456!";

async function seedAdmin() {
  loadEnvFiles();

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI. Add it to .env before running the admin seed.");
  }

  const email = normalizeEmail(process.env.ADMIN_SEED_EMAIL ?? defaultAdminEmail);
  const password = process.env.ADMIN_SEED_PASSWORD ?? defaultAdminPassword;

  if (password.length < 8) {
    throw new Error("ADMIN_SEED_PASSWORD must be at least 8 characters.");
  }

  const connection = await createConnection(mongoUri).asPromise();
  const users = connection.model(User.name, UserSchema);
  const passwordService = new PasswordService();
  const passwordHash = await passwordService.hash(password);
  const existingAdmin = await users.findOne({ email }).exec();

  await users.updateOne(
    { email },
    {
      $set: {
        email,
        passwordHash,
        role: UserRole.Admin,
        status: AccountStatus.Active,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: undefined,
        emailVerificationTokenExpiresAt: undefined,
        emailVerificationSentAt: undefined,
        passwordResetTokenHash: undefined,
        passwordResetTokenExpiresAt: undefined,
        passwordResetSentAt: undefined
      }
    },
    { upsert: true }
  ).exec();

  await connection.close();

  console.log(`${existingAdmin ? "Updated" : "Created"} admin user: ${email}`);
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

seedAdmin().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
