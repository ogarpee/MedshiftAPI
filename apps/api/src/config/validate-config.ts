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

  return config as unknown as EnvironmentConfig;
}
