interface EnvironmentConfig {
  MONGODB_URI: string;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  RESEND_FACILITY_AUDIENCE_ID?: string;
  RESEND_FACILITY_SEGMENT_ID?: string;
  RESEND_GENERAL_AUDIENCE_ID?: string;
  RESEND_GENERAL_SEGMENT_ID?: string;
  RESEND_WAITLIST_AUDIENCE_ID?: string;
  RESEND_WAITLIST_SEGMENT_ID?: string;
  RESEND_WORKER_AUDIENCE_ID?: string;
  RESEND_WORKER_SEGMENT_ID?: string;
  PORT?: string;
  WEB_ORIGIN?: string;
  ADMIN_ORIGIN?: string;
  SOCKET_ORIGINS?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  TWO_FACTOR_ENCRYPTION_KEY?: string;
}

const requiredKeys: Array<keyof EnvironmentConfig> = ["MONGODB_URI", "JWT_SECRET"];

export function validateConfig(config: Record<string, unknown>): EnvironmentConfig {
  for (const key of requiredKeys) {
    if (!config[key]) {
      throw new Error(
        `Missing required environment variable: ${key}. Add it to .env at the repo root or apps/api/.env. See apps/api/.env.example.`
      );
    }
  }

  if (config.NODE_ENV === "production") {
    if (String(config.JWT_SECRET).length < 48) throw new Error("JWT_SECRET must contain at least 48 characters in production.");
    for (const key of ["WEB_ORIGIN", "ADMIN_ORIGIN", "SOCKET_ORIGINS"] as const) {
      if (!config[key] || !String(config[key]).startsWith("https://")) throw new Error(`${key} must use HTTPS in production.`);
    }
    if (String(config.ALLOW_DEV_OTPS).toLowerCase() === "true") throw new Error("ALLOW_DEV_OTPS cannot be enabled in production.");
    for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const) {
      if (!config[key]) throw new Error(`${key} is required in production.`);
    }
    const twoFactorKey = Buffer.from(String(config.TWO_FACTOR_ENCRYPTION_KEY ?? ""), "base64");
    if (twoFactorKey.length !== 32) throw new Error("TWO_FACTOR_ENCRYPTION_KEY must be a base64-encoded 32-byte key in production.");
  }

  return config as unknown as EnvironmentConfig;
}
