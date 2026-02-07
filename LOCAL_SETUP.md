# ResumeTailor - Local Development Setup Guide

## 🎯 Quick Start (5 Minutes)

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your actual credentials

# 3. Setup database
npm run db:push

# 4. Start development server
npm run dev

# 5. Open browser
# Navigate to: http://localhost:5000
```

---

## 📋 Prerequisites

Before you begin, ensure you have:

- **Node.js 18+** and npm ([Download](https://nodejs.org/))
- **PostgreSQL 14+** ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/downloads))

### Service Accounts (Required)

You'll need free accounts for:
- [OpenAI Platform](https://platform.openai.com/) - AI resume tailoring
- [Stripe](https://stripe.com/) - Payment processing

---

## 🗄️ Database Setup

### Option 1: Local PostgreSQL

```bash
# Install PostgreSQL (macOS)
brew install postgresql@16
brew services start postgresql@16

# Create database
createdb resumetailor

# Your DATABASE_URL will be:
# postgresql://localhost:5432/resumetailor
```

### Option 2: Docker PostgreSQL

```bash
# Run PostgreSQL in Docker
docker run --name resumetailor-db \
  -e POSTGRES_DB=resumetailor \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=yourpassword \
  -p 5432:5432 \
  -d postgres:16

# Your DATABASE_URL will be:
# postgresql://admin:yourpassword@localhost:5432/resumetailor
```

### Option 3: Cloud Database (Easiest)

Use a free tier from:
- [Supabase](https://supabase.com/) (recommended - free PostgreSQL)
- [Neon](https://neon.tech/) (serverless PostgreSQL)
- [Railway](https://railway.app/) (PostgreSQL with free tier)

Get your connection string and use it as `DATABASE_URL`.

---

## 🔐 Environment Configuration

### Step 1: Create `.env` File

```bash
cp .env.example .env
```

### Step 2: Fill in Required Variables

#### **Database URL** (Required)
```env
DATABASE_URL=postgresql://user:password@host:5432/resumetailor
```

#### **Session Secret** (Required)
Generate a secure random string:
```bash
# macOS/Linux
openssl rand -base64 32

# Or use any long random string (32+ characters)
```

Add to `.env`:
```env
SESSION_SECRET=your-generated-secret-here
```

#### **OpenAI API Key** (Required)

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add to `.env`:
```env
AI_INTEGRATIONS_OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY_HERE
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
```

**Cost Estimate**: ~$0.10 per resume tailoring (GPT-4o)

#### **Stripe Keys** (Required for Payments)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys)
2. Use **Test Mode** keys (start with `sk_test_` and `pk_test_`)
3. Add to `.env`:
```env
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
```

4. Setup webhook for local testing:
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:5000/api/stripe/webhook

# Copy the webhook signing secret (starts with whsec_) to .env
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

---

## 🚀 Running the Application

### Development Mode

```bash
# Start with hot-reload
npm run dev
```

This starts:
- **Backend API**: http://localhost:5000
- **Frontend**: Served by backend on same port

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

### Type Checking

```bash
# Check TypeScript types
npm run check
```

---

## 🗄️ Database Migrations

### Initial Schema Setup

```bash
# Push schema to database
npm run db:push
```

This creates all required tables:
- `users` - User accounts
- `sessions` - Session storage
- `resumes` - Uploaded resumes
- `revisions` - AI-tailored versions
- `payments` - Payment records
- `promptVersions` - AI prompt templates
- `promptTestRuns` - Prompt testing records
- `analyticsEvents` - Event tracking

### Schema Changes

After modifying `server/db/schema.ts`:

```bash
# Push changes to database
npm run db:push

# This will prompt you to confirm changes
```

---

## 👤 Create Admin User

**Important**: The first user you create should be promoted to admin.

### Method 1: Via Database (Recommended)

```bash
# Connect to your database
psql $DATABASE_URL

# Promote user to admin (replace email)
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

### Method 2: Create Admin CLI Tool

Create `scripts/make-admin.ts`:

```typescript
import { db } from "../server/db";
import { users } from "../server/db/schema";
import { eq } from "drizzle-orm";

const email = process.argv[2];

if (!email) {
  console.error("Usage: tsx scripts/make-admin.ts user@example.com");
  process.exit(1);
}

const [user] = await db.update(users)
  .set({ role: "admin" })
  .where(eq(users.email, email))
  .returning();

if (user) {
  console.log(`✅ ${user.email} is now an admin`);
} else {
  console.error(`❌ User with email ${email} not found`);
}

process.exit(0);
```

Run it:
```bash
tsx scripts/make-admin.ts your-email@example.com
```

---

## 🧪 Testing the Application

### 1. Test Authentication

1. Visit http://localhost:5000
2. Click "Sign In"
3. **Note**: Replit Auth won't work locally - you'll need to:
   - Temporarily modify the auth flow for local development, OR
   - Use the deployed Replit version for testing auth

### 2. Test Resume Upload

1. Login to the app
2. Navigate to Dashboard
3. Upload a sample PDF/DOCX resume
4. Click "Tailor Resume"
5. Select industry and role
6. Click "Generate Tailored Version"

### 3. Test Payments (Stripe Test Mode)

Use Stripe test cards:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- Any future expiry date (e.g., 12/34)
- Any 3-digit CVC

### 4. Test Admin Features

1. Promote yourself to admin (see above)
2. Visit http://localhost:5000/admin
3. Check analytics dashboard
4. View user management
5. Test prompt versioning

---

## 🚨 Troubleshooting

### "Cannot connect to database"

```bash
# Check if PostgreSQL is running
pg_isready

# Check your DATABASE_URL format
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

### "OpenAI API Error: 401 Unauthorized"

- Verify your API key is correct
- Check you have credits in your OpenAI account
- Ensure the key hasn't expired

### "Stripe webhook error"

- Make sure Stripe CLI is running: `stripe listen --forward-to localhost:5000/api/stripe/webhook`
- Verify `STRIPE_WEBHOOK_SECRET` in `.env` matches the CLI output
- Check webhook endpoint is accessible

### "Session not persisting"

- Verify `SESSION_SECRET` is set in `.env`
- Check PostgreSQL `sessions` table exists
- Clear browser cookies and try again

### Port 5000 already in use

```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or change port in .env
PORT=3000
```

---

## 📁 Project Structure

```
/home/dave/Downloads/Expert-Full-Stack/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page-level components
│   │   ├── lib/              # API client, utilities
│   │   └── hooks/            # Custom React hooks
│   └── index.html
├── server/                    # Express backend
│   ├── routes.ts             # API endpoints
│   ├── index.ts              # Server entry point
│   ├── auth.ts               # Authentication logic
│   ├── llm.ts                # OpenAI integration
│   ├── stripeClient.ts       # Stripe integration
│   ├── storage.ts            # Database operations
│   ├── middleware.ts         # Auth middleware
│   └── db/
│       └── schema.ts         # Database schema (Drizzle ORM)
├── shared/                    # Shared TypeScript types
├── uploads/                   # User-uploaded files (gitignored)
├── dist/                      # Production build output
├── .env                       # Environment variables (gitignored)
├── .env.example              # Environment template
├── package.json              # Dependencies
├── drizzle.config.ts         # ORM configuration
└── vite.config.ts            # Build configuration
```

---

## 🔒 Security Notes

**Never commit these files to Git:**
- `.env` (contains secrets)
- `uploads/` (contains user data)
- `node_modules/`

**Always use:**
- Test mode keys for Stripe during development
- Environment variables for all secrets
- HTTPS in production

---

## 🚀 Deployment Options

### Option 1: Replit (Original Platform)
- Already configured via `.replit` file
- Automatic PostgreSQL, OpenAI, and Stripe integration
- Zero-config deployment

### Option 2: Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Option 3: Vercel + Neon
- Frontend on Vercel
- PostgreSQL on Neon
- Requires environment variable configuration

### Option 4: Render
- Supports monorepo deployments
- Free PostgreSQL tier
- Auto-deploy from GitHub

---

## 📊 Monitoring in Development

### View Logs

```bash
# Backend logs are output to console
# Look for:
# - [auth] - Authentication events
# - [tailor] - Resume tailoring operations
# - [payment] - Payment processing
# - [error] - Errors
```

### Database GUI

```bash
# Option 1: Drizzle Studio (built-in)
npx drizzle-kit studio

# Opens web GUI at: https://local.drizzle.studio
```

### Stripe Events

View all webhook events in Stripe Dashboard:
https://dashboard.stripe.com/test/webhooks

---

## 🎓 Next Steps

Once your local setup is working:

1. ✅ Test all core features (upload, tailor, purchase)
2. ✅ Create an admin user and explore admin dashboard
3. ✅ Review the [ARCHITECTURE.md](./ARCHITECTURE.md) document
4. ✅ Practice your technical walkthrough for interviews
5. ✅ Push to GitHub (see [GITHUB_STRATEGY.md](./GITHUB_STRATEGY.md))

---

## 🆘 Need Help?

Common issues and solutions:
- Authentication not working locally → Use deployed Replit version
- Webhook errors → Ensure Stripe CLI is running
- Database connection errors → Check DATABASE_URL format
- OpenAI errors → Verify API key and account credits

For more help, review the source code comments in:
- [server/routes.ts](./server/routes.ts) - API endpoints
- [server/auth.ts](./server/auth.ts) - Auth implementation
- [server/llm.ts](./server/llm.ts) - AI integration
