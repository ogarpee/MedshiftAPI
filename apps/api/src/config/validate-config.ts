interface EnvironmentConfig {
  MONGODB_URI: string;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  PORT?: string;
  WEB_ORIGIN?: string;
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
