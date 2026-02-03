import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as pdfParse from "pdf-parse";
import * as mammoth from "mammoth";
import { storage } from "./storage";
import { tailorResume, testPrompt, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } from "./llm";
import { getUncachableStripeClient, getStripeSync } from "./stripeClient";
import { 
  loginSchema, 
  signupSchema, 
  tailorResumeSchema,
  updateUserStatusSchema,
  createPromptVersionSchema,
  testPromptSchema
} from "@shared/schema";
import { z } from "zod";
import { runMigrations } from "stripe-replit-sync";
import pgSession from "connect-pg-simple";

const PgSession = pgSession(session);

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

// Structured logging for auth and critical operations
function log(level: "info" | "warn" | "error", category: string, message: string, meta?: Record<string, any>) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    category,
    message,
    ...meta,
  };
  console.log(JSON.stringify(logEntry));
}

const UPLOADS_DIR = "./uploads";
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are allowed"));
    }
  },
});

// Middleware: Require authentication
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    log("warn", "auth", "Unauthorized access attempt", { path: req.path });
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

// Middleware: Require admin role
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    log("warn", "auth", "Unauthorized admin access attempt", { path: req.path });
    return res.status(401).json({ message: "Authentication required" });
  }
  
  const user = await storage.getUser(req.session.userId);
  if (!user || user.role !== "admin") {
    log("warn", "auth", "Non-admin attempted admin route", { userId: req.session.userId, path: req.path });
    return res.status(403).json({ message: "Admin access required" });
  }
  
  next();
}

// Middleware: Check if user account is active
async function checkUserActive(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return next();
  }
  
  const user = await storage.getUser(req.session.userId);
  if (user && user.status === "deactivated") {
    req.session.destroy(() => {});
    return res.status(403).json({ message: "Your account has been deactivated. Please contact support." });
  }
  
  next();
}

async function extractText(filePath: string, fileType: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);

  if (fileType === "application/pdf") {
    const pdfParseDefault = (pdfParse as any).default || pdfParse;
    const data = await pdfParseDefault(buffer);
    return data.text;
  } else if (
    fileType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("Unsupported file type");
}

const PRICING_PLANS: Record<string, { price: number; revisions: number }> = {
  basic: { price: 499, revisions: 5 },
  professional: { price: 999, revisions: 15 },
  unlimited: { price: 1999, revisions: 50 },
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize Stripe
  try {
    await runMigrations({ databaseUrl: process.env.DATABASE_URL! });
    const stripeSync = await getStripeSync();
    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    stripeSync.syncBackfill().catch(console.error);
  } catch (error) {
    log("error", "stripe", "Stripe initialization error", { error: String(error) });
  }

  // Session middleware
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET environment variable is required in production");
  }
  
  app.use(
    session({
      store: new PgSession({
        conString: process.env.DATABASE_URL,
        createTableIfMissing: true,
      }),
      secret: sessionSecret || "dev-resume-tailor-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  // Check user active status on all requests
  app.use(checkUserActive);

  // ===== AUTH ROUTES =====

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const parsed = signupSchema.parse(req.body);
      const { email, password } = parsed;

      log("info", "auth", "Signup attempt", { email });

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        log("warn", "auth", "Signup failed - email exists", { email });
        return res.status(400).json({ message: "An account with this email already exists. Please sign in instead." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
      });

      req.session.userId = user.id;
      
      // Track signup event
      await storage.trackEvent({
        eventType: "signup",
        userId: user.id,
        metadata: { email },
      });

      log("info", "auth", "Signup successful", { userId: user.id, email });

      const { password: _, ...safeUser } = user;
      res.status(201).json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessage = error.errors.map(e => e.message).join(", ");
        log("warn", "auth", "Signup validation failed", { error: errorMessage });
        return res.status(400).json({ message: errorMessage });
      }
      log("error", "auth", "Signup error", { error: String(error) });
      res.status(500).json({ message: "Failed to create account. Please try again." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      log("info", "auth", "Login attempt", { email });

      const user = await storage.getUserByEmail(email);
      if (!user) {
        log("warn", "auth", "Login failed - user not found", { email });
        return res.status(401).json({ message: "Invalid email or password. Please check your credentials and try again." });
      }

      if (user.status === "deactivated") {
        log("warn", "auth", "Login failed - account deactivated", { email });
        return res.status(403).json({ message: "Your account has been deactivated. Please contact support." });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        log("warn", "auth", "Login failed - invalid password", { email });
        return res.status(401).json({ message: "Invalid email or password. Please check your credentials and try again." });
      }

      req.session.userId = user.id;
      
      // Update last login
      await storage.updateUser(user.id, { lastLoginAt: new Date() });
      
      // Track login event
      await storage.trackEvent({
        eventType: "login",
        userId: user.id,
        metadata: { email },
      });

      log("info", "auth", "Login successful", { userId: user.id, email });

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      log("error", "auth", "Login error", { error: String(error) });
      res.status(500).json({ message: "Login failed. Please try again." });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const userId = req.session.userId;
    req.session.destroy((err) => {
      if (err) {
        log("error", "auth", "Logout error", { userId, error: String(err) });
        return res.status(500).json({ message: "Logout failed" });
      }
      log("info", "auth", "Logout successful", { userId });
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ user: null });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ user: null });
    }

    const { password: _, ...safeUser } = user;
    res.json({ user: safeUser });
  });

  // ===== RESUME ROUTES =====

  app.get("/api/resumes", requireAuth, async (req, res) => {
    try {
      const resumes = await storage.getResumesByUser(req.session.userId!);
      res.json(resumes);
    } catch (error) {
      log("error", "resume", "Fetch resumes error", { userId: req.session.userId, error: String(error) });
      res.status(500).json({ message: "Failed to fetch resumes" });
    }
  });

  app.post(
    "/api/resumes/upload",
    requireAuth,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        log("info", "resume", "Upload attempt", { userId: req.session.userId, filename: req.file.originalname });

        const extractedText = await extractText(
          req.file.path,
          req.file.mimetype
        );

        if (!extractedText.trim()) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "Could not extract text from file. Please ensure the file contains readable text." });
        }

        const resume = await storage.createResume({
          userId: req.session.userId!,
          originalFilename: req.file.originalname,
          fileType: req.file.mimetype.includes("pdf") ? "pdf" : "docx",
          extractedText,
          filePath: req.file.path,
        });

        // Track upload event
        await storage.trackEvent({
          eventType: "upload",
          userId: req.session.userId!,
          metadata: { resumeId: resume.id, filename: req.file.originalname },
        });

        log("info", "resume", "Upload successful", { userId: req.session.userId, resumeId: resume.id });

        res.status(201).json({ resume });
      } catch (error: any) {
        log("error", "resume", "Upload error", { userId: req.session.userId, error: String(error) });
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: error.message || "Upload failed. Please try again." });
      }
    }
  );

  app.get("/api/resumes/:id", requireAuth, async (req, res) => {
    try {
      const resumeId = req.params.id as string;
      const resume = await storage.getResume(resumeId);
      if (!resume || resume.userId !== req.session.userId) {
        return res.status(404).json({ message: "Resume not found" });
      }
      res.json(resume);
    } catch (error) {
      log("error", "resume", "Fetch resume error", { userId: req.session.userId, error: String(error) });
      res.status(500).json({ message: "Failed to fetch resume" });
    }
  });

  // ===== REVISION ROUTES =====

  app.get("/api/revisions", requireAuth, async (req, res) => {
    try {
      const revisions = await storage.getRevisionsByUser(req.session.userId!);
      res.json(revisions);
    } catch (error) {
      log("error", "revision", "Fetch revisions error", { userId: req.session.userId, error: String(error) });
      res.status(500).json({ message: "Failed to fetch revisions" });
    }
  });

  app.get("/api/revisions/:id", requireAuth, async (req, res) => {
    try {
      const revisionId = req.params.id as string;
      const revision = await storage.getRevision(revisionId);
      if (!revision || revision.userId !== req.session.userId) {
        return res.status(404).json({ message: "Revision not found" });
      }
      res.json(revision);
    } catch (error) {
      log("error", "revision", "Fetch revision error", { userId: req.session.userId, error: String(error) });
      res.status(500).json({ message: "Failed to fetch revision" });
    }
  });

  app.post("/api/revisions/tailor", requireAuth, async (req, res) => {
    try {
      const { resumeId, targetIndustry, targetRole } = tailorResumeSchema.parse(req.body);

      log("info", "tailor", "Tailor attempt", { userId: req.session.userId, resumeId, targetIndustry, targetRole });

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check revision limits
      const freeRevisionsLeft = 3 - (user.freeRevisionsUsed || 0);
      const paidRevisionsLeft = user.paidRevisionsRemaining || 0;
      const totalRevisionsLeft = freeRevisionsLeft + paidRevisionsLeft;

      if (totalRevisionsLeft <= 0) {
        log("warn", "tailor", "No revisions remaining", { userId: req.session.userId });
        return res.status(403).json({
          message: "You've used all your revisions. Purchase more to continue tailoring your resume.",
        });
      }

      const resume = await storage.getResume(resumeId);
      if (!resume || resume.userId !== req.session.userId) {
        return res.status(404).json({ message: "Resume not found" });
      }

      // Call LLM to tailor resume
      const { content: tailoredContent, promptVersionId } = await tailorResume(
        resume.extractedText,
        targetIndustry,
        targetRole
      );

      // Determine if using free or paid revision
      const wasFree = freeRevisionsLeft > 0;

      // Update user revision counts
      if (wasFree) {
        await storage.updateUser(user.id, {
          freeRevisionsUsed: (user.freeRevisionsUsed || 0) + 1,
        });
      } else {
        await storage.updateUser(user.id, {
          paidRevisionsRemaining: paidRevisionsLeft - 1,
        });
      }

      // Create revision record
      const revision = await storage.createRevision({
        resumeId,
        userId: req.session.userId!,
        targetIndustry,
        targetRole,
        tailoredContent,
        wasFree,
        promptVersionId,
      });

      // Track tailor event
      await storage.trackEvent({
        eventType: "tailor",
        userId: req.session.userId!,
        metadata: { revisionId: revision.id, targetIndustry, targetRole, wasFree },
      });

      log("info", "tailor", "Tailor successful", { userId: req.session.userId, revisionId: revision.id });

      res.status(201).json({ revision });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      log("error", "tailor", "Tailor error", { userId: req.session.userId, error: String(error) });
      
      // Track error event
      await storage.trackEvent({
        eventType: "error",
        userId: req.session.userId,
        metadata: { type: "tailor_failure", error: String(error) },
      });
      
      res.status(500).json({ message: "Failed to tailor resume. Please try again." });
    }
  });

  // ===== PAYMENT ROUTES =====

  app.post("/api/payments/checkout", requireAuth, async (req, res) => {
    try {
      const { planId } = req.body;

      if (!planId || !PRICING_PLANS[planId]) {
        return res.status(400).json({ message: "Invalid plan selected" });
      }

      const plan = PRICING_PLANS[planId];
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      log("info", "payment", "Checkout attempt", { userId: user.id, planId });

      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: { userId: user.id },
        });
        await storage.updateUser(user.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `ResumeTailor - ${plan.revisions} Revisions`,
                description: `${plan.revisions} AI-powered resume revisions`,
              },
              unit_amount: plan.price,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/checkout/cancel`,
        metadata: {
          userId: user.id,
          planId,
          revisions: plan.revisions.toString(),
        },
      });

      // Create payment record
      await storage.createPayment({
        userId: user.id,
        stripeSessionId: session.id,
        amount: plan.price,
        currency: "usd",
        status: "pending",
        revisionsGranted: plan.revisions,
      });

      log("info", "payment", "Checkout session created", { userId: user.id, sessionId: session.id });

      res.json({ url: session.url });
    } catch (error) {
      log("error", "payment", "Checkout error", { userId: req.session.userId, error: String(error) });
      res.status(500).json({ message: "Failed to create checkout session. Please try again." });
    }
  });

  // Stripe webhook handler
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    try {
      const stripe = await getUncachableStripeClient();
      const sig = req.headers["stripe-signature"];

      if (!sig) {
        return res.status(400).json({ error: "Missing signature" });
      }

      const stripeSync = await getStripeSync();
      const payload = (req as any).rawBody || req.body;
      
      if (Buffer.isBuffer(payload)) {
        await stripeSync.processWebhook(payload, sig as string);
      }

      // Handle checkout.session.completed
      const event = stripe.webhooks.constructEvent(
        payload,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const revisions = parseInt(session.metadata?.revisions || "0");

        log("info", "payment", "Checkout completed", { userId, revisions, sessionId: session.id });

        if (userId && revisions > 0) {
          // Update payment status
          const payment = await storage.getPaymentBySessionId(session.id);
          if (payment) {
            await storage.updatePayment(payment.id, {
              status: "completed",
              stripePaymentIntentId: session.payment_intent,
            });
          }

          // Add revisions to user
          const user = await storage.getUser(userId);
          if (user) {
            await storage.updateUser(userId, {
              paidRevisionsRemaining: (user.paidRevisionsRemaining || 0) + revisions,
            });
            
            // Track payment event
            await storage.trackEvent({
              eventType: "payment",
              userId,
              metadata: { revisions, amount: session.amount_total },
            });
          }
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      log("error", "payment", "Webhook error", { error: String(error) });
      res.status(400).json({ error: error.message });
    }
  });

  // ===== ADMIN ROUTES =====

  // Admin: Get dashboard stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const summary = await storage.getAnalyticsSummary();
      res.json(summary);
    } catch (error) {
      log("error", "admin", "Stats fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Admin: Get all users
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      log("error", "admin", "Users fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin: Update user status
  app.patch("/api/admin/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id as string;
      const { status } = updateUserStatusSchema.parse({ userId, status: req.body.status });
      
      const user = await storage.updateUser(userId, { status });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      log("info", "admin", "User status updated", { adminId: req.session.userId, targetUserId: userId, status });
      
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      log("error", "admin", "User status update error", { error: String(error) });
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  // Admin: Get all resumes
  app.get("/api/admin/resumes", requireAdmin, async (req, res) => {
    try {
      const resumes = await storage.getAllResumes();
      res.json(resumes);
    } catch (error) {
      log("error", "admin", "Resumes fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch resumes" });
    }
  });

  // Admin: Get all revisions
  app.get("/api/admin/revisions", requireAdmin, async (req, res) => {
    try {
      const revisions = await storage.getAllRevisions();
      res.json(revisions);
    } catch (error) {
      log("error", "admin", "Revisions fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch revisions" });
    }
  });

  // Admin: Get analytics events
  app.get("/api/admin/analytics", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await storage.getAnalyticsEvents(limit);
      res.json(events);
    } catch (error) {
      log("error", "admin", "Analytics fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // ===== PROMPT MANAGEMENT ROUTES (Admin Only) =====

  // Get all prompt versions
  app.get("/api/admin/prompts", requireAdmin, async (req, res) => {
    try {
      const prompts = await storage.getAllPromptVersions();
      res.json(prompts);
    } catch (error) {
      log("error", "admin", "Prompts fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch prompts" });
    }
  });

  // Get default prompt templates
  app.get("/api/admin/prompts/defaults", requireAdmin, async (req, res) => {
    res.json({
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
    });
  });

  // Create new prompt version
  app.post("/api/admin/prompts", requireAdmin, async (req, res) => {
    try {
      const data = createPromptVersionSchema.parse(req.body);
      
      const prompt = await storage.createPromptVersion({
        ...data,
        createdBy: req.session.userId!,
      });
      
      log("info", "admin", "Prompt version created", { adminId: req.session.userId, promptId: prompt.id });
      
      res.status(201).json(prompt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      log("error", "admin", "Prompt create error", { error: String(error) });
      res.status(500).json({ message: "Failed to create prompt" });
    }
  });

  // Set prompt as active
  app.post("/api/admin/prompts/:id/activate", requireAdmin, async (req, res) => {
    try {
      const promptId = req.params.id as string;
      await storage.setActivePromptVersion(promptId);
      log("info", "admin", "Prompt activated", { adminId: req.session.userId, promptId });
      res.json({ message: "Prompt activated" });
    } catch (error) {
      log("error", "admin", "Prompt activate error", { error: String(error) });
      res.status(500).json({ message: "Failed to activate prompt" });
    }
  });

  // Test a prompt (without saving)
  app.post("/api/admin/prompts/test", requireAdmin, async (req, res) => {
    try {
      const { systemPrompt, userPromptTemplate, testInput, targetIndustry, targetRole } = 
        testPromptSchema.parse(req.body);
      
      log("info", "admin", "Prompt test started", { adminId: req.session.userId });
      
      const { output, executionTimeMs } = await testPrompt(
        systemPrompt,
        userPromptTemplate,
        testInput,
        targetIndustry,
        targetRole
      );
      
      log("info", "admin", "Prompt test completed", { adminId: req.session.userId, executionTimeMs });
      
      res.json({ output, executionTimeMs });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      log("error", "admin", "Prompt test error", { error: String(error) });
      res.status(500).json({ message: "Failed to test prompt" });
    }
  });

  return httpServer;
}
