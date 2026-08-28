const REQUIRED_VARS = ['MONGODB_URI', 'JWT_SECRET'];

export function validate(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_VARS.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }
  return config;
}
