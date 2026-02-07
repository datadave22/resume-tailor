# Configuration System

## Overview

This application **does NOT use `.env` files or dotenv**.

All configuration is loaded from **OS-level environment variables** (exported via `.bashrc` or shell environment).

## How It Works

1. **Centralized Config**: All environment variables are loaded and validated in [`config/env.js`](./env.js)
2. **Fail-Fast Validation**: Application won't start if required variables are missing
3. **GitHub Safe**: The config file contains NO secrets - only validation logic
4. **Import Everywhere**: Use `import env from '../config/env.js'` in any file

## Required Environment Variables

Export these in your `.bashrc` or shell environment:

```bash
# Database
export DATABASE_URL="postgresql://localhost:5432/resumetailor"

# Session
export SESSION_SECRET="your-super-secret-key-here"

# OpenAI
export AI_INTEGRATIONS_OPENAI_API_KEY="sk-proj-xxxxx"
export AI_INTEGRATIONS_OPENAI_BASE_URL="https://api.openai.com/v1"  # Optional

# Stripe (optional - only needed if using payments)
export STRIPE_SECRET_KEY="sk_test_xxxxx"
export STRIPE_PUBLISHABLE_KEY="pk_test_xxxxx"
export STRIPE_WEBHOOK_SECRET="whsec_xxxxx"

# Application
export PORT="5000"
export NODE_ENV="development"
export BASE_URL="http://localhost:5000"
```

## Loading Environment Variables

### Option 1: `.bashrc` (Recommended for Local Development)

Add to your `~/.bashrc`:

```bash
# ResumeTailor Configuration
export DATABASE_URL="postgresql://localhost:5432/resumetailor"
export SESSION_SECRET="$(openssl rand -base64 32)"
export AI_INTEGRATIONS_OPENAI_API_KEY="sk-proj-xxxxx"
export AI_INTEGRATIONS_OPENAI_BASE_URL="https://api.openai.com/v1"
export PORT="5000"
export NODE_ENV="development"
```

Then reload:
```bash
source ~/.bashrc
```

### Option 2: Shell Script (For Multiple Environments)

Create `load-env.sh`:

```bash
#!/bin/bash
export DATABASE_URL="postgresql://localhost:5432/resumetailor"
export SESSION_SECRET="your-secret-here"
# ... other variables
```

Load before running:
```bash
source load-env.sh
npm run dev
```

### Option 3: Systemd Service (Production)

Add to your systemd service file:

```ini
[Service]
Environment="DATABASE_URL=postgresql://..."
Environment="SESSION_SECRET=xxx"
Environment="AI_INTEGRATIONS_OPENAI_API_KEY=xxx"
```

## Usage in Code

### Before (OLD - DON'T DO THIS)
```javascript
// ❌ Direct process.env access (scattered throughout codebase)
const dbUrl = process.env.DATABASE_URL;
const port = parseInt(process.env.PORT || "5000", 10);
```

### After (NEW - DO THIS)
```javascript
// ✅ Import centralized config
import env from '../config/env.js';

const dbUrl = env.database.url;
const port = env.app.port;

// Helper methods
if (env.isProduction()) {
  // Production logic
}
```

## Configuration Structure

```javascript
env = {
  database: {
    url: string  // PostgreSQL connection string
  },
  session: {
    secret: string,  // Session encryption key
    ttl: number      // Time-to-live in milliseconds
  },
  openai: {
    apiKey: string,
    baseURL: string
  },
  stripe: {
    secretKey: string,
    publishableKey: string,
    webhookSecret: string
  },
  app: {
    port: number,
    nodeEnv: string,
    baseUrl: string
  },
  replit: {
    replId: string | undefined,
    // ... other Replit-specific vars
  },

  // Helper methods
  isProduction(): boolean,
  isDevelopment(): boolean,
  isReplit(): boolean,
  isReplitDeployment(): boolean
}
```

## Validation

The config file automatically validates:

- ✅ Required variables are set (DATABASE_URL, SESSION_SECRET, OPENAI_API_KEY)
- ✅ PORT is a valid number (1-65535)
- ✅ Warnings for missing optional variables (STRIPE keys)
- ✅ Application exits with clear error message if validation fails

## Error Messages

If a required variable is missing, you'll see:

```
❌ ENVIRONMENT CONFIGURATION ERROR ❌

Missing required environment variable: DATABASE_URL (PostgreSQL connection string)
Please ensure it's exported in your .bashrc or shell environment.
Example: export DATABASE_URL=your_value_here

Application cannot start without required environment variables.
Please check your .bashrc or environment configuration.
```

## GitHub Safety

**This configuration is 100% safe to commit to GitHub:**

- ✅ `config/env.js` contains NO secrets (only validation logic)
- ✅ `.env` files are gitignored (and not used anyway)
- ✅ All secrets live in your shell environment (not in code)
- ✅ `.env.example` shows what variables are needed (without real values)

## Migration from .env Files

If you were previously using `.env` files:

1. **Copy values to shell environment**:
   ```bash
   # Read your old .env file
   cat .env

   # Add each variable to ~/.bashrc
   echo 'export DATABASE_URL="postgresql://..."' >> ~/.bashrc
   echo 'export SESSION_SECRET="..."' >> ~/.bashrc
   # ... etc

   # Reload
   source ~/.bashrc
   ```

2. **Delete .env file** (no longer needed):
   ```bash
   rm .env
   ```

3. **Verify variables are loaded**:
   ```bash
   echo $DATABASE_URL
   echo $SESSION_SECRET
   ```

4. **Start application**:
   ```bash
   npm run dev
   ```

## Troubleshooting

### "Missing required environment variable"

**Problem**: Application fails to start with config error

**Solution**: Ensure variable is exported in your shell
```bash
# Check if variable is set
echo $DATABASE_URL

# If empty, add to ~/.bashrc
echo 'export DATABASE_URL="postgresql://..."' >> ~/.bashrc
source ~/.bashrc
```

### "Environment not loading in new terminal"

**Problem**: Variables work in one terminal but not another

**Solution**: Ensure variables are in `~/.bashrc` (not just current session)
```bash
# Add to .bashrc
echo 'export DATABASE_URL="..."' >> ~/.bashrc

# Open new terminal and test
echo $DATABASE_URL
```

### "npm run dev fails but variables are set"

**Problem**: Variables are set but application doesn't see them

**Solution**: npm may need to inherit environment
```bash
# Verify npm can see variables
npm run dev -- --version

# If still fails, try running Node directly
node dist/index.cjs
```

## Production Deployment

### Replit

Replit auto-configures most variables. You only need to set:
- `DATABASE_URL` (via Replit Database)
- `SESSION_SECRET` (via Secrets)
- `AI_INTEGRATIONS_OPENAI_API_KEY` (via Secrets)

### Docker

```dockerfile
# In Dockerfile
ENV NODE_ENV=production

# Pass secrets at runtime
docker run \
  -e DATABASE_URL="postgresql://..." \
  -e SESSION_SECRET="..." \
  -e AI_INTEGRATIONS_OPENAI_API_KEY="..." \
  your-image
```

### Kubernetes

```yaml
# ConfigMap for non-sensitive config
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  NODE_ENV: "production"
  PORT: "5000"

---
# Secret for sensitive data
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
stringData:
  DATABASE_URL: "postgresql://..."
  SESSION_SECRET: "xxx"
  AI_INTEGRATIONS_OPENAI_API_KEY: "xxx"
```

## Benefits of This Approach

✅ **No .env files** - cleaner repository, less to gitignore
✅ **Environment-aware** - same code works in dev/staging/production
✅ **Fail-fast validation** - catch config errors immediately
✅ **Type-safe** - centralized config provides IntelliSense
✅ **GitHub safe** - no secrets in repository
✅ **Industry standard** - 12-factor app methodology
✅ **Easier debugging** - all config in one place
✅ **Production ready** - works with Docker, K8s, systemd, etc.

## References

- [The Twelve-Factor App: Config](https://12factor.net/config)
- [Node.js Best Practices: Environment Variables](https://github.com/goldbergyoni/nodebestpractices#2-configuration)
- [OWASP: Secure Configuration](https://owasp.org/www-project-top-ten/2017/A6_2017-Security_Misconfiguration)
