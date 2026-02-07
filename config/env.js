/**
 * Centralized Environment Configuration
 *
 * This file loads all configuration from OS environment variables
 * (sourced from .bashrc or system environment).
 *
 * NO .env files or dotenv library - all values come from process.env
 *
 * Safe to commit to GitHub - contains NO secrets, only validation logic.
 */

/**
 * Helper: Require an environment variable or throw a clear error
 * @param {string} name - The environment variable name
 * @param {string} [description] - Optional description for better error messages
 * @returns {string} The environment variable value
 * @throws {Error} If the variable is not set
 */
function requireEnv(name, description) {
  const value = process.env[name];
  if (!value) {
    const desc = description ? ` (${description})` : '';
    throw new Error(
      `Missing required environment variable: ${name}${desc}\n` +
      `Please ensure it's exported in your .bashrc or shell environment.\n` +
      `Example: export ${name}=your_value_here`
    );
  }
  return value;
}

/**
 * Helper: Get an optional environment variable with a default value
 * @param {string} name - The environment variable name
 * @param {string} defaultValue - The default value if not set
 * @returns {string} The environment variable value or default
 */
function optionalEnv(name, defaultValue) {
  return process.env[name] || defaultValue;
}

// ============================================
// VALIDATE AND EXPORT CONFIGURATION
// ============================================

const env = {
  // ----------------------------------------
  // Database Configuration
  // ----------------------------------------
  database: {
    url: requireEnv('DATABASE_URL', 'PostgreSQL connection string'),
  },

  // ----------------------------------------
  // Session Configuration
  // ----------------------------------------
  session: {
    secret: requireEnv('SESSION_SECRET', 'Secret key for session encryption'),
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  },

  // ----------------------------------------
  // OpenAI Configuration
  // ----------------------------------------
  openai: {
    apiKey: requireEnv('AI_INTEGRATIONS_OPENAI_API_KEY', 'OpenAI API key'),
    baseURL: optionalEnv('AI_INTEGRATIONS_OPENAI_BASE_URL', 'https://api.openai.com/v1'),
  },

  // ----------------------------------------
  // Stripe Configuration
  // ----------------------------------------
  stripe: {
    secretKey: optionalEnv('STRIPE_SECRET_KEY', ''),
    publishableKey: optionalEnv('STRIPE_PUBLISHABLE_KEY', ''),
    webhookSecret: optionalEnv('STRIPE_WEBHOOK_SECRET', ''),
  },

  // ----------------------------------------
  // Application Configuration
  // ----------------------------------------
  app: {
    port: parseInt(optionalEnv('PORT', '5000'), 10),
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    baseUrl: optionalEnv('BASE_URL', 'http://localhost:5000'),
  },

  // ----------------------------------------
  // Replit-Specific Configuration (Optional)
  // ----------------------------------------
  replit: {
    replId: process.env.REPL_ID,
    replIdentity: process.env.REPL_IDENTITY,
    webReplRenewal: process.env.WEB_REPL_RENEWAL,
    deployment: process.env.REPLIT_DEPLOYMENT,
    domains: process.env.REPLIT_DOMAINS,
    connectorsHostname: process.env.REPLIT_CONNECTORS_HOSTNAME,
    issuerUrl: process.env.ISSUER_URL,
  },

  // ----------------------------------------
  // Helper Methods
  // ----------------------------------------

  /**
   * Check if running in production
   * @returns {boolean}
   */
  isProduction() {
    return this.app.nodeEnv === 'production';
  },

  /**
   * Check if running in development
   * @returns {boolean}
   */
  isDevelopment() {
    return this.app.nodeEnv === 'development';
  },

  /**
   * Check if running on Replit
   * @returns {boolean}
   */
  isReplit() {
    return !!this.replit.replId;
  },

  /**
   * Check if Replit deployment
   * @returns {boolean}
   */
  isReplitDeployment() {
    return this.replit.deployment === '1';
  },
};

// ============================================
// VALIDATION ON LOAD
// ============================================

// Run validation immediately when module is loaded
try {
  // Core validations
  if (!env.database.url) {
    throw new Error('DATABASE_URL is required but not set');
  }

  if (!env.session.secret) {
    throw new Error('SESSION_SECRET is required but not set');
  }

  if (!env.openai.apiKey) {
    throw new Error('AI_INTEGRATIONS_OPENAI_API_KEY is required but not set');
  }

  // Port validation
  if (isNaN(env.app.port) || env.app.port < 1 || env.app.port > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}. Must be between 1-65535`);
  }

  // Stripe validation (warn if missing but don't fail - may not be needed in all environments)
  const isReplitEnv = !!env.replit.replId;
  if (!isReplitEnv && !env.stripe.secretKey) {
    console.warn(
      '[CONFIG WARNING] STRIPE_SECRET_KEY not set. Payment features will not work.\n' +
      'This is OK for local development if you don\'t need payments.'
    );
  }

  // Success message
  console.log('[CONFIG] ✓ Environment configuration loaded successfully');
  console.log(`[CONFIG] ✓ Environment: ${env.app.nodeEnv}`);
  console.log(`[CONFIG] ✓ Port: ${env.app.port}`);
  console.log(`[CONFIG] ✓ Database: ${env.database.url.split('@')[1] || 'configured'}`);
  console.log(`[CONFIG] ✓ OpenAI: ${env.openai.apiKey.substring(0, 15)}...`);
  if (isReplitEnv) {
    console.log(`[CONFIG] ✓ Replit environment detected`);
  }

} catch (error) {
  console.error('\n❌ ENVIRONMENT CONFIGURATION ERROR ❌\n');
  console.error(error.message);
  console.error('\nApplication cannot start without required environment variables.');
  console.error('Please check your .bashrc or environment configuration.\n');
  process.exit(1);
}

// ============================================
// EXPORT
// ============================================

export default env;

// Also export as module.exports for CommonJS compatibility
module.exports = env;
