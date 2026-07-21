interface EnvironmentConfig {
  MONGODB_URI: string;
  JWT_SECRET: string;
  RESEND_API_KEY?: string;
  PORT?: string;
  WEB_ORIGIN?: string;
}

const requiredKeys: Array<keyof EnvironmentConfig> = ["MONGODB_URI", "JWT_SECRET"];

export function validateConfig(config: Record<string, unknown>): EnvironmentConfig {
  for (const key of requiredKeys) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }

  return config as unknown as EnvironmentConfig;
}
