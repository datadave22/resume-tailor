/**
 * Centralized Environment Configuration
 *
 * This file loads all configuration from OS environment variables.
 * Uses lazy getters so module loading never throws - errors only
 * occur when values are actually accessed at runtime.
 */

function requireEnv(name, description) {
  const value = process.env[name];
  if (!value) {
    const desc = description ? ` (${description})` : '';
    throw new Error(
      `Missing required environment variable: ${name}${desc}\n` +
      `Please ensure it's set in your environment or Vercel dashboard.`
    );
  }
  return value;
}

function optionalEnv(name, defaultValue) {
  return process.env[name] || defaultValue;
}

const env = {
  database: {
    get url() { return requireEnv('DATABASE_URL', 'PostgreSQL connection string'); },
  },

  openai: {
    get apiKey() { return requireEnv('AI_INTEGRATIONS_OPENAI_API_KEY', 'OpenAI API key'); },
    get baseURL() { return optionalEnv('AI_INTEGRATIONS_OPENAI_BASE_URL', 'https://api.openai.com/v1'); },
  },

  stripe: {
    get secretKey() { return requireEnv('STRIPE_SECRET_KEY', 'Stripe secret key'); },
    get publishableKey() { return requireEnv('STRIPE_PUBLISHABLE_KEY', 'Stripe publishable key'); },
    get webhookSecret() { return optionalEnv('STRIPE_WEBHOOK_SECRET', ''); },
  },

  clerk: {
    get secretKey() { return requireEnv('CLERK_SECRET_KEY', 'Clerk secret key'); },
    get publishableKey() { return requireEnv('CLERK_PUBLISHABLE_KEY', 'Clerk publishable key'); },
  },

  app: {
    get port() { return parseInt(optionalEnv('PORT', '5000'), 10); },
    get nodeEnv() { return optionalEnv('NODE_ENV', 'development'); },
    get baseUrl() { return optionalEnv('BASE_URL', 'http://localhost:5000'); },
  },

  isProduction() {
    return this.app.nodeEnv === 'production';
  },

  isDevelopment() {
    return this.app.nodeEnv === 'development';
  },
};

export default env;
