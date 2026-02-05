# ResumeTailor

AI-powered resume optimization application that helps users tailor their resumes for specific industries and job roles.

## Overview

ResumeTailor allows users to:
- Upload resumes in PDF or DOCX format (max 5MB)
- Tailor resumes for specific industries and job roles using AI
- Get 3 free resume revisions
- Purchase additional revisions via Stripe checkout

### Admin Features
Administrators have access to a comprehensive dashboard:
- **Overview**: View usage stats (users, resumes, revisions, payments, revenue)
- **User Management**: View all users, activate/deactivate accounts
- **Prompt Testing**: Test AI prompts without affecting production, save versions, activate new prompts

## Architecture

### Tech Stack
- **Frontend**: React with TypeScript, TanStack Query, shadcn/ui, Wouter routing
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Auth (OIDC) - supports Google, GitHub, X, Apple, and email login
- **AI**: OpenAI GPT-4o for resume tailoring with premium gamified coach persona
- **Payments**: Stripe Checkout for purchasing revisions
- **Logging**: Structured JSON logging for all critical operations

### Key Files

#### Backend
- `server/index.ts` - Express server entry point
- `server/routes.ts` - All API routes (resumes, revisions, payments, admin)
- `server/storage.ts` - Database storage layer with CRUD operations
- `server/llm.ts` - OpenAI integration for resume tailoring with prompt versioning
- `server/stripeClient.ts` - Stripe client initialization
- `server/replit_integrations/auth/` - Replit Auth integration module

#### Frontend
- `client/src/App.tsx` - Main app with routing, providers, and role-based route guards
- `client/src/lib/auth.tsx` - Authentication context provider (Replit Auth)
- `client/src/pages/landing.tsx` - Landing page with social login
- `client/src/pages/` - All page components
- `client/src/pages/admin/` - Admin dashboard pages (dashboard, users, prompts)

#### Shared
- `shared/schema.ts` - Drizzle database schema and Zod validation schemas
- `shared/models/auth.ts` - User and session schema for Replit Auth

### Database Schema

- **users**: id, email, firstName, lastName, profileImageUrl, role (admin/user), status (active/deactivated), freeRevisionsUsed, paidRevisionsRemaining, stripeCustomerId, lastLoginAt, createdAt, updatedAt
- **sessions**: sid, sess, expire (managed by Replit Auth)
- **resumes**: id, userId, originalFilename, fileType, extractedText, filePath, createdAt
- **revisions**: id, resumeId, userId, targetIndustry, targetRole, tailoredContent, wasFree, createdAt
- **payments**: id, userId, stripeSessionId, stripePaymentIntentId, amount, currency, status, revisionsGranted, createdAt
- **promptVersions**: id, name, description, systemPrompt, userPromptTemplate, isActive, isDefault, createdBy, createdAt
- **analyticsEvents**: id, eventType, userId, metadata, createdAt
- **promptTestRuns**: id, promptVersionId, testInput, targetIndustry, targetRole, output, executionTimeMs, createdBy, createdAt

## API Endpoints

### Authentication (Replit Auth)
- `GET /api/login` - Initiate OAuth login (redirects to Replit OIDC)
- `GET /api/logout` - End session (redirects to Replit logout)
- `GET /api/callback` - OAuth callback handler
- `GET /api/auth/user` - Get current authenticated user

### Resumes
- `GET /api/resumes` - List user's resumes
- `POST /api/resumes/upload` - Upload new resume (PDF/DOCX)
- `GET /api/resumes/:id` - Get specific resume

### Revisions
- `GET /api/revisions` - List user's revisions
- `GET /api/revisions/:id` - Get specific revision
- `POST /api/revisions/tailor` - Create new tailored revision

### Payments
- `POST /api/payments/checkout` - Create Stripe checkout session
- `POST /api/stripe/webhook` - Stripe webhook handler

### Admin (requires admin role)
- `GET /api/admin/stats` - Get analytics summary
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:id/status` - Update user status
- `GET /api/admin/prompts` - List prompt versions
- `GET /api/admin/prompts/defaults` - Get default prompt content
- `POST /api/admin/prompts` - Create new prompt version
- `POST /api/admin/prompts/:id/activate` - Set prompt as active
- `POST /api/admin/prompts/test` - Test a prompt configuration

## Pricing Plans

- **Starter**: $4.99 for 5 revisions
- **Professional**: $9.99 for 15 revisions (best value)
- **Power User**: $19.99 for 50 revisions

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key (required in production)

Automatic (via integrations):
- `AI_INTEGRATIONS_OPENAI_API_KEY` - OpenAI API key
- `AI_INTEGRATIONS_OPENAI_BASE_URL` - OpenAI base URL
- Stripe keys managed via Replit Stripe integration

## Development

```bash
npm run dev        # Start development server
npm run db:push    # Push schema changes to database
```

## Recent Changes

- 2026-02-05: Migrated authentication to Replit Auth (OIDC) with Google, GitHub, X, Apple, and email login support
- 2026-02-05: Removed email/password authentication in favor of social login
- 2026-02-05: Updated landing page with unified Sign In button
- 2026-02-05: Dashboard now displays user's name from OAuth profile
- 2026-02-03: Added comprehensive admin dashboard with user management, prompt testing, and analytics
- 2026-02-03: Implemented role-based access control (RBAC) for admin features
- 2026-02-03: Added structured JSON logging for auth and critical operations
- 2026-02-03: Created analytics tracking system for key events
- 2026-02-03: Added prompt versioning with A/B testing capability
- 2026-02-03: Implemented premium gamified resume coach AI persona
- 2026-02-02: Initial implementation with full auth, resume upload, AI tailoring, and Stripe payments
