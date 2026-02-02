# ResumeTailor

AI-powered resume optimization application that helps users tailor their resumes for specific industries and job roles.

## Overview

ResumeTailor allows users to:
- Upload resumes in PDF or DOCX format (max 5MB)
- Tailor resumes for specific industries and job roles using AI
- Get 3 free resume revisions
- Purchase additional revisions via Stripe checkout

## Architecture

### Tech Stack
- **Frontend**: React with TypeScript, TanStack Query, shadcn/ui, Wouter routing
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Session-based with bcrypt password hashing
- **AI**: OpenAI GPT-4o for resume tailoring
- **Payments**: Stripe Checkout for purchasing revisions

### Key Files

#### Backend
- `server/index.ts` - Express server entry point
- `server/routes.ts` - All API routes (auth, resumes, revisions, payments)
- `server/storage.ts` - Database storage layer with CRUD operations
- `server/llm.ts` - OpenAI integration for resume tailoring
- `server/stripeClient.ts` - Stripe client initialization

#### Frontend
- `client/src/App.tsx` - Main app with routing and providers
- `client/src/lib/auth.tsx` - Authentication context provider
- `client/src/pages/` - All page components

#### Shared
- `shared/schema.ts` - Drizzle database schema and Zod validation schemas

### Database Schema

- **users**: id, email, password, freeRevisionsUsed (default 0), paidRevisionsRemaining (default 0), stripeCustomerId
- **resumes**: id, userId, originalFilename, fileType, extractedText, filePath, createdAt
- **revisions**: id, resumeId, userId, targetIndustry, targetRole, tailoredContent, wasFree, createdAt
- **payments**: id, userId, stripeSessionId, stripePaymentIntentId, amount, currency, status, revisionsGranted, createdAt

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - End session
- `GET /api/auth/me` - Get current user

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

- 2026-02-02: Initial implementation with full auth, resume upload, AI tailoring, and Stripe payments
