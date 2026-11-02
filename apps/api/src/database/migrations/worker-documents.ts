import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { RequiredWorkerDocumentCategories, VerificationDocumentStatus, WorkerDocumentCategory } from "@medshift/shared-types";
import { createConnection } from "mongoose";

async function migrateWorkerDocuments() {
  loadEnvFiles();
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error("Missing MONGODB_URI.");
  const dryRun = process.argv.includes("--dry-run");
  const connection = await createConnection(mongoUri).asPromise();
  const collection = connection.collection("worker_profiles");
  const profiles = await collection.find({}).toArray();
  let profilesUpdated = 0;
  let documentsCreated = 0;
  const missingRequiredDocuments: Array<{ profileId: string; categories: string[] }> = [];

  for (const profile of profiles) {
    const documents = Array.isArray(profile.documents) ? [...profile.documents] : [];
    const credentials = Array.isArray(profile.credentials) ? profile.credentials : [];
    credentials.forEach((credential, index) => {
      if (!credential?.documentUrl || documents.some((document) => document.documentUrl === credential.documentUrl)) return;
      documents.push({
        id: `legacy-${profile._id.toString()}-${index}`,
        category: WorkerDocumentCategory.ProfessionalCertificate,
        documentUrl: credential.documentUrl,
        originalFilename: credential.type || `Legacy credential ${index + 1}`,
        uploadedAt: profile.createdAt ?? new Date(0),
        verificationStatus: credential.isVerified ? VerificationDocumentStatus.Verified : VerificationDocumentStatus.Pending,
        reviewedAt: credential.verifiedAt
      });
      documentsCreated += 1;
    });
    const categories = new Set(documents.map((document) => document.category));
    const missing = RequiredWorkerDocumentCategories.filter((category) => !categories.has(category));
    if (missing.length) missingRequiredDocuments.push({ profileId: profile._id.toString(), categories: missing });
    if (documents.length !== (profile.documents?.length ?? 0)) {
      profilesUpdated += 1;
      if (!dryRun) await collection.updateOne({ _id: profile._id }, { $set: { documents } });
    }
  }

  await connection.close();
  console.log(JSON.stringify({ dryRun, profilesScanned: profiles.length, profilesUpdated, documentsCreated, missingRequiredDocuments }, null, 2));
}

function loadEnvFiles() {
  for (const path of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env"), join(__dirname, "../../../../.env")]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const separator = trimmed.indexOf("=");
      const key = trimmed.slice(0, separator).trim();
      if (!process.env[key]) process.env[key] = trimmed.slice(separator + 1).trim();
    }
  }
}

void migrateWorkerDocuments().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
