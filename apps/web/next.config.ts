import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const repoRoot = path.join(appRoot, "../..");
const publicEnvKeys = [
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_ADMIN_URL",
  "NEXT_PUBLIC_MAPBOX_TOKEN",
  "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN",
  "NEXT_PUBLIC_GOOGLE_PLACES_API_KEY",
  "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
  "NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET"
];

loadPublicEnvFiles([
  path.join(repoRoot, ".env"),
  path.join(repoRoot, ".env.local"),
  path.join(appRoot, ".env"),
  path.join(appRoot, ".env.local")
]);

const nextConfig: NextConfig = {
  env: getPublicEnv(),
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@medshift/ui-components", "@medshift/shared-types"]
};

export default nextConfig;

function loadPublicEnvFiles(envPaths: string[]) {
  for (const envPath of envPaths) {
    if (!existsSync(envPath)) {
      continue;
    }

    const entries = parseEnvFile(readFileSync(envPath, "utf8"));

    for (const key of publicEnvKeys) {
      const value = entries.get(key);

      if (value !== undefined) {
        process.env[key] = value;
      }
    }
  }
}

function getPublicEnv() {
  return Object.fromEntries(publicEnvKeys.map((key) => [key, process.env[key] ?? ""]));
}

function parseEnvFile(contents: string) {
  const entries = new Map<string, string>();

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key.startsWith("NEXT_PUBLIC_")) {
      continue;
    }

    entries.set(key, stripEnvQuotes(rawValue));
  }

  return entries;
}

function stripEnvQuotes(value: string) {
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  return value;
}
