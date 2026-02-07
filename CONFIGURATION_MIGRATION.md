# Configuration System Migration

## ✅ What Was Done

Your ResumeTailor application has been **completely migrated** from `.env` files to OS-level environment variables.

### Files Modified

1. **Created**:
   - [`config/env.js`](./config/env.js) - Centralized configuration with validation
   - [`config/README.md`](./config/README.md) - Configuration documentation
   - [`scripts/check-env.js`](./scripts/check-env.js) - Environment validation tool

2. **Updated**:
   - [`server/db.ts`](./server/db.ts) - Now imports from `config/env.js`
   - [`server/llm.ts`](./server/llm.ts) - Now imports from `config/env.js`
   - [`server/index.ts`](./server/index.ts) - Now imports from `config/env.js`
   - [`server/stripeClient.ts`](./server/stripeClient.ts) - Now imports from `config/env.js`
   - [`server/routes.ts`](./server/routes.ts) - Now imports from `config/env.js`
   - [`server/replit_integrations/auth/replitAuth.ts`](./server/replit_integrations/auth/replitAuth.ts) - Now imports from `config/env.js`
   - [`drizzle.config.ts`](./drizzle.config.ts) - Now imports from `config/env.js`
   - [`.gitignore`](./.gitignore) - Added `.env` files to ignore list
   - [`package.json`](./package.json) - Added `check:env` script

### What Changed

#### Before (❌ Old Approach)
```javascript
// Scattered throughout codebase
const dbUrl = process.env.DATABASE_URL;
const port = parseInt(process.env.PORT || "5000", 10);
const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
```

#### After (✅ New Approach)
```javascript
// Single import at top of file
import env from '../config/env.js';

// Use centralized config
const dbUrl = env.database.url;
const port = env.app.port;
const apiKey = env.openai.apiKey;
```

---

## 🚀 How to Use

### Step 1: Set Environment Variables in `.bashrc`

Add these to your `~/.bashrc`:

```bash
# ResumeTailor Configuration
export DATABASE_URL="postgresql://localhost:5432/resumetailor"
export SESSION_SECRET="your-super-secret-key-at-least-32-chars-long"
export AI_INTEGRATIONS_OPENAI_API_KEY="sk-proj-YOUR_OPENAI_KEY_HERE"
export AI_INTEGRATIONS_OPENAI_BASE_URL="https://api.openai.com/v1"

# Optional (for payments)
export STRIPE_SECRET_KEY="sk_test_YOUR_STRIPE_KEY_HERE"
export STRIPE_PUBLISHABLE_KEY="pk_test_YOUR_PUBLISHABLE_KEY_HERE"
export STRIPE_WEBHOOK_SECRET="whsec_YOUR_WEBHOOK_SECRET_HERE"

# Application settings
export PORT="5000"
export NODE_ENV="development"
export BASE_URL="http://localhost:5000"
```

**Generate a secure SESSION_SECRET:**
```bash
openssl rand -base64 32
```

### Step 2: Reload Your Shell

```bash
source ~/.bashrc
```

### Step 3: Verify Environment

```bash
npm run check:env
```

You should see:
```
🔍 ResumeTailor Environment Variable Checker

REQUIRED VARIABLES
================================================================================

✓ DATABASE_URL
  → postgresql://...

✓ SESSION_SECRET
  → <masked>...

✓ AI_INTEGRATIONS_OPENAI_API_KEY
  → sk-proj-YOUR_OPENAI_KEY_HERE...

✓ All required variables are valid!
✓ Environment configuration ready!
You can now run: npm run dev
```

### Step 4: Start Your Application

```bash
npm run dev
```

The application will:
1. Load `config/env.js`
2. Validate all required variables
3. Display configuration summary
4. Start the server on the configured port

---

## 📋 Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://localhost:5432/resumetailor` |
| `SESSION_SECRET` | Session encryption key (32+ chars) | Generated with `openssl rand -base64 32` |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key | `sk-proj-YOUR_OPENAI_KEY_HERE` |

## 📋 Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI API endpoint | `https://api.openai.com/v1` |
| `STRIPE_SECRET_KEY` | Stripe secret key (test mode) | None (payment disabled) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | None |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | None |
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `BASE_URL` | Application base URL | `http://localhost:5000` |

---

## 🔧 Troubleshooting

### Error: "Missing required environment variable"

**Cause**: Variable not set in shell environment

**Solution**:
```bash
# Check if variable is set
echo $DATABASE_URL

# If empty, add to ~/.bashrc
echo 'export DATABASE_URL="postgresql://localhost:5432/resumetailor"' >> ~/.bashrc

# Reload shell
source ~/.bashrc

# Verify
npm run check:env
```

### Error: "Invalid format" for DATABASE_URL

**Cause**: Connection string doesn't match PostgreSQL format

**Solution**: Ensure format is `postgresql://user:password@host:port/database`
```bash
export DATABASE_URL="postgresql://localhost:5432/resumetailor"
```

### Error: "Too short" for SESSION_SECRET

**Cause**: SESSION_SECRET is less than 32 characters

**Solution**: Generate a secure random string:
```bash
export SESSION_SECRET="$(openssl rand -base64 32)"
# Add this to your ~/.bashrc
```

### Application starts but can't connect to database

**Cause**: Database not running or wrong connection string

**Solution**:
```bash
# Check if PostgreSQL is running
pg_isready

# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# If database doesn't exist, create it
createdb resumetailor
```

### Variables work in one terminal but not another

**Cause**: Variables not persisted to `.bashrc`

**Solution**: Always add to `.bashrc`, not just current session
```bash
# Add to .bashrc (persists across sessions)
echo 'export DATABASE_URL="postgresql://..."' >> ~/.bashrc

# NOT just:
export DATABASE_URL="postgresql://..."  # Only works in current session
```

---

## 🔐 Security Benefits

### ✅ What's Now Safe to Commit to GitHub

- ✅ `config/env.js` - Contains NO secrets, only validation logic
- ✅ `.env.example` - Shows what variables are needed (placeholder values)
- ✅ All application code
- ✅ Database schema (no credentials)
- ✅ AI prompt templates

### ❌ What Should NEVER Be Committed

- ❌ `.env` files (now deprecated and gitignored)
- ❌ Any file containing real API keys, passwords, or secrets
- ❌ `uploads/` directory (user data)

### 🛡️ Protection Mechanisms

1. **Fail-Fast Validation**: Application won't start if secrets are missing
2. **Centralized Config**: All environment usage in one place
3. **Type Safety**: Config provides IntelliSense and type checking
4. **Clear Errors**: Helpful error messages when variables are missing
5. **GitHub Safety**: No secrets in repository, ever

---

## 📚 Using the Configuration in Your Code

### Import Pattern

```javascript
// At top of file
import env from '../config/env.js';
// Adjust path based on file location
// From server/: '../config/env.js'
// From server/subfolder/: '../../config/env.js'
```

### Common Usage Examples

#### Database Connection
```javascript
import env from '../config/env.js';

const pool = new Pool({
  connectionString: env.database.url,
});
```

#### OpenAI Client
```javascript
import env from '../config/env.js';

const openai = new OpenAI({
  apiKey: env.openai.apiKey,
  baseURL: env.openai.baseURL,
});
```

#### Session Configuration
```javascript
import env from '../config/env.js';

const sessionStore = new pgStore({
  conString: env.database.url,
  ttl: env.session.ttl,
});
```

#### Environment Checks
```javascript
import env from '../config/env.js';

if (env.isProduction()) {
  // Production-only logic
}

if (env.isDevelopment()) {
  // Development-only logic
}

if (env.isReplit()) {
  // Replit-specific logic
}
```

---

## 🎯 Configuration Structure

The `env` object has this structure:

```javascript
env = {
  // Database
  database: {
    url: string  // PostgreSQL connection string
  },

  // Session
  session: {
    secret: string,  // Session encryption key
    ttl: number      // Time-to-live in milliseconds (7 days)
  },

  // OpenAI
  openai: {
    apiKey: string,
    baseURL: string
  },

  // Stripe
  stripe: {
    secretKey: string,
    publishableKey: string,
    webhookSecret: string
  },

  // Application
  app: {
    port: number,
    nodeEnv: string,
    baseUrl: string
  },

  // Replit (optional)
  replit: {
    replId: string | undefined,
    replIdentity: string | undefined,
    webReplRenewal: string | undefined,
    deployment: string | undefined,
    domains: string | undefined,
    connectorsHostname: string | undefined,
    issuerUrl: string | undefined
  },

  // Helper methods
  isProduction(): boolean,
  isDevelopment(): boolean,
  isReplit(): boolean,
  isReplitDeployment(): boolean
}
```

---

## 🔄 Migration Checklist

If you were previously using `.env` files:

- [x] ✅ Created `config/env.js` with centralized configuration
- [x] ✅ Updated all files to import from `config/env.js`
- [x] ✅ Removed direct `process.env` access
- [x] ✅ Added environment validation
- [x] ✅ Created `check:env` script
- [x] ✅ Updated `.gitignore` to ignore `.env` files
- [ ] 🔲 Copy variables from `.env` to `~/.bashrc`
- [ ] 🔲 Run `source ~/.bashrc`
- [ ] 🔲 Run `npm run check:env` to verify
- [ ] 🔲 Delete old `.env` file (no longer needed)
- [ ] 🔲 Test application: `npm run dev`
- [ ] 🔲 Push to GitHub (config files are safe to commit)

---

## 📖 Further Reading

- [Configuration Documentation](./config/README.md) - Detailed configuration guide
- [The Twelve-Factor App: Config](https://12factor.net/config) - Industry best practices
- [OWASP Secure Configuration](https://owasp.org/www-project-top-ten/2017/A6_2017-Security_Misconfiguration)

---

## ✅ Summary

Your ResumeTailor application now uses a **production-ready, secure configuration system**:

1. **No `.env` files** - All configuration from OS environment
2. **Fail-fast validation** - Catches missing variables immediately
3. **Centralized config** - Single source of truth
4. **GitHub safe** - No secrets in repository
5. **Type safe** - IntelliSense and validation
6. **Production ready** - Works with Docker, K8s, systemd, Replit

**Next Steps:**
1. Set environment variables in `~/.bashrc`
2. Run `npm run check:env` to validate
3. Run `npm run dev` to start application
4. Push to GitHub (all config files are safe!)

Your configuration is now secure, maintainable, and ready for production deployment! 🚀
