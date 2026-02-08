/**
 * Centralized Environment Configuration
 *
 * This file loads all configuration from OS environment variables.
 * Safe to commit to GitHub - contains NO secrets, only validation logic.
 */

function requireEnv(name, description) {
  const value = process.env[name];
  if (!value) {
    const desc = description ? ` (${description})` : '';
    throw new Error(
      `Missing required environment variable: ${name}${desc}\n` +
      `Please ensure it's set in your environment or Vercel dashboard.\n` +
      `Example: export ${name}=your_value_here`
    );
  }
  return value;
}

function optionalEnv(name, defaultValue) {
  return process.env[name] || defaultValue;
}

const env = {
  database: {
    url: requireEnv('DATABASE_URL', 'PostgreSQL connection string'),
  },

  openai: {
    apiKey: requireEnv('AI_INTEGRATIONS_OPENAI_API_KEY', 'OpenAI API key'),
    baseURL: optionalEnv('AI_INTEGRATIONS_OPENAI_BASE_URL', 'https://api.openai.com/v1'),
  },

  stripe: {
    secretKey: requireEnv('STRIPE_SECRET_KEY', 'Stripe secret key'),
    publishableKey: requireEnv('STRIPE_PUBLISHABLE_KEY', 'Stripe publishable key'),
    webhookSecret: optionalEnv('STRIPE_WEBHOOK_SECRET', ''),
  },

  clerk: {
    secretKey: requireEnv('CLERK_SECRET_KEY', 'Clerk secret key'),
    publishableKey: requireEnv('CLERK_PUBLISHABLE_KEY', 'Clerk publishable key'),
  },

  app: {
    port: parseInt(optionalEnv('PORT', '5000'), 10),
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    baseUrl: optionalEnv('BASE_URL', 'http://localhost:5000'),
  },

  isProduction() {
    return this.app.nodeEnv === 'production';
  },

  isDevelopment() {
    return this.app.nodeEnv === 'development';
  },
};

// Validation on load
try {
  if (!env.database.url) throw new Error('DATABASE_URL is required');
  if (!env.openai.apiKey) throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY is required');

  if (isNaN(env.app.port) || env.app.port < 1 || env.app.port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}. Must be between 1-65535`);
  }

  console.log('[CONFIG] Environment configuration loaded successfully');
  console.log(`[CONFIG] Environment: ${env.app.nodeEnv}`);
  console.log(`[CONFIG] Port: ${env.app.port}`);
  console.log(`[CONFIG] Database: configured`);

} catch (error) {
  console.error('\nENVIRONMENT CONFIGURATION ERROR\n');
  console.error(error.message);
  console.error('\nApplication cannot start without required environment variables.\n');
  process.exit(1);
}

export default env;
