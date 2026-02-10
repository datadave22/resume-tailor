import type { Express, Request, Response, NextFunction } from "express";
import multer from "multer";
import * as pdfParse from "pdf-parse";
import * as mammoth from "mammoth";
import { storage } from "./storage";
import { authStorage } from "./authStorage";
import { getAuth, requireAuth, clerkClient } from "@clerk/express";
import { tailorResume, testPrompt, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT_TEMPLATE } from "./llm";
import { getStripeClient } from "./stripeClient";
import {
  tailorResumeSchema,
  updateUserStatusSchema,
  createPromptVersionSchema,
  testPromptSchema
} from "../shared/schema";
import { z } from "zod";
import env from "../config/env.js";

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4MB for Vercel compatibility
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

// Helper to get user ID from Clerk auth
function getUserId(req: Request): string | undefined {
  const { userId } = getAuth(req);
  return userId ?? undefined;
}

// Middleware: Require admin role
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) {
    log("warn", "auth", "Unauthorized admin access attempt", { path: req.path });
    return res.status(401).json({ message: "Authentication required" });
  }

  const user = await storage.getUser(userId);
  if (!user || user.role !== "admin") {
    log("warn", "auth", "Non-admin attempted admin route", { userId, path: req.path });
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
}

// Middleware: Check if user account is active
async function checkUserActive(req: Request, res: Response, next: NextFunction) {
  const userId = getUserId(req);
  if (!userId) {
    return next();
  }

  const user = await storage.getUser(userId);
  if (user && user.status === "deactivated") {
    return res.status(403).json({ message: "Your account has been deactivated. Please contact support." });
  }

  next();
}

async function extractText(buffer: Buffer, fileType: string): Promise<string> {
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

export async function registerRoutes(app: Express): Promise<void> {
  // Check user active status on all requests
  app.use(checkUserActive);

  // ===== AUTH ROUTES =====

  app.get("/api/auth/user", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      // Sync user from Clerk to local DB on first access
      let user = await authStorage.getUser(userId);
      if (!user) {
        const clerkUser = await clerkClient.users.getUser(userId);
        user = await authStorage.upsertUser({
          id: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          profileImageUrl: clerkUser.imageUrl,
        });
      }

      res.json(user);
    } catch (error) {
      log("error", "auth", "Error fetching user", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ===== RESUME ROUTES =====

  app.get("/api/resumes", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req)!;
      const resumes = await storage.getResumesByUser(userId);
      res.json(resumes);
    } catch (error) {
      log("error", "resume", "Fetch resumes error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch resumes" });
    }
  });

  app.post(
    "/api/resumes/upload",
    requireAuth(),
    upload.single("file"),
    async (req, res) => {
      try {
        const userId = getUserId(req)!;
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        log("info", "resume", "Upload attempt", { userId, filename: req.file.originalname });

        const extractedText = await extractText(
          req.file.buffer,
          req.file.mimetype
        );

        if (!extractedText.trim()) {
          return res.status(400).json({ message: "Could not extract text from file. Please ensure the file contains readable text." });
        }

        const resume = await storage.createResume({
          userId,
          originalFilename: req.file.originalname,
          fileType: req.file.mimetype.includes("pdf") ? "pdf" : "docx",
          extractedText,
          filePath: "memory-upload",
        });

        await storage.trackEvent({
          eventType: "upload",
          userId,
          metadata: { resumeId: resume.id, filename: req.file.originalname },
        });

        log("info", "resume", "Upload successful", { userId, resumeId: resume.id });

        res.status(201).json({ resume });
      } catch (error: any) {
        log("error", "resume", "Upload error", { error: String(error) });
        res.status(500).json({ message: error.message || "Upload failed. Please try again." });
      }
    }
  );

  app.get("/api/resumes/:id", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req)!;
      const resumeId = req.params.id as string;
      const resume = await storage.getResume(resumeId);
      if (!resume || resume.userId !== userId) {
        return res.status(404).json({ message: "Resume not found" });
      }
      res.json(resume);
    } catch (error) {
      log("error", "resume", "Fetch resume error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch resume" });
    }
  });

  // ===== REVISION ROUTES =====

  app.get("/api/revisions", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req)!;
      const revisions = await storage.getRevisionsByUser(userId);
      res.json(revisions);
    } catch (error) {
      log("error", "revision", "Fetch revisions error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch revisions" });
    }
  });

  app.get("/api/revisions/:id", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req)!;
      const revisionId = req.params.id as string;
      const revision = await storage.getRevision(revisionId);
      if (!revision || revision.userId !== userId) {
        return res.status(404).json({ message: "Revision not found" });
      }
      res.json(revision);
    } catch (error) {
      log("error", "revision", "Fetch revision error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch revision" });
    }
  });

  app.post("/api/revisions/tailor", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req)!;
      const { resumeId, targetIndustry, targetRole } = tailorResumeSchema.parse(req.body);

      log("info", "tailor", "Tailor attempt", { userId, resumeId, targetIndustry, targetRole });

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const freeRevisionsLeft = 3 - (user.freeRevisionsUsed || 0);
      const paidRevisionsLeft = user.paidRevisionsRemaining || 0;
      const totalRevisionsLeft = freeRevisionsLeft + paidRevisionsLeft;

      if (totalRevisionsLeft <= 0) {
        log("warn", "tailor", "No revisions remaining", { userId });
        return res.status(403).json({
          message: "You've used all your revisions. Purchase more to continue tailoring your resume.",
        });
      }

      const resume = await storage.getResume(resumeId);
      if (!resume || resume.userId !== userId) {
        return res.status(404).json({ message: "Resume not found" });
      }

      const { content: tailoredContent, promptVersionId } = await tailorResume(
        resume.extractedText,
        targetIndustry,
        targetRole
      );

      const wasFree = freeRevisionsLeft > 0;

      if (wasFree) {
        await storage.updateUser(user.id, {
          freeRevisionsUsed: (user.freeRevisionsUsed || 0) + 1,
        });
      } else {
        await storage.updateUser(user.id, {
          paidRevisionsRemaining: paidRevisionsLeft - 1,
        });
      }

      const revision = await storage.createRevision({
        resumeId,
        userId,
        targetIndustry,
        targetRole,
        tailoredContent,
        wasFree,
        promptVersionId,
      });

      await storage.trackEvent({
        eventType: "tailor",
        userId,
        metadata: { revisionId: revision.id, targetIndustry, targetRole, wasFree },
      });

      log("info", "tailor", "Tailor successful", { userId, revisionId: revision.id });

      res.status(201).json({ revision });
    } catch (error) {
      const userId = getUserId(req);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      log("error", "tailor", "Tailor error", { userId, error: String(error) });

      await storage.trackEvent({
        eventType: "error",
        userId,
        metadata: { type: "tailor_failure", error: String(error) },
      });

      res.status(500).json({ message: "Failed to tailor resume. Please try again." });
    }
  });

  // ===== PAYMENT ROUTES =====

  app.post("/api/payments/checkout", requireAuth(), async (req, res) => {
    try {
      const userId = getUserId(req)!;
      const { planId } = req.body;

      if (!planId || !PRICING_PLANS[planId]) {
        return res.status(400).json({ message: "Invalid plan selected" });
      }

      const plan = PRICING_PLANS[planId];
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      log("info", "payment", "Checkout attempt", { userId: user.id, planId });

      const stripe = getStripeClient();
      const baseUrl = env.app.baseUrl;

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId: user.id },
        });
        await storage.updateUser(user.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

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
      log("error", "payment", "Checkout error", { error: String(error) });
      res.status(500).json({ message: "Failed to create checkout session. Please try again." });
    }
  });

  // Stripe webhook handler (no auth - Stripe sends this directly)
  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    try {
      const stripe = getStripeClient();
      const sig = req.headers["stripe-signature"];

      if (!sig) {
        return res.status(400).json({ error: "Missing signature" });
      }

      const payload = (req as any).rawBody || req.body;

      const event = stripe.webhooks.constructEvent(
        payload,
        sig as string,
        env.stripe.webhookSecret || ""
      );

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const revisions = parseInt(session.metadata?.revisions || "0");

        log("info", "payment", "Checkout completed", { userId, revisions, sessionId: session.id });

        if (userId && revisions > 0) {
          const payment = await storage.getPaymentBySessionId(session.id);
          if (payment) {
            await storage.updatePayment(payment.id, {
              status: "completed",
              stripePaymentIntentId: session.payment_intent,
            });
          }

          const user = await storage.getUser(userId);
          if (user) {
            await storage.updateUser(userId, {
              paidRevisionsRemaining: (user.paidRevisionsRemaining || 0) + revisions,
            });

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

  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const summary = await storage.getAnalyticsSummary();
      res.json(summary);
    } catch (error) {
      log("error", "admin", "Stats fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      log("error", "admin", "Users fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/admin/users/:id/status", requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id as string;
      const { status } = updateUserStatusSchema.parse({ userId, status: req.body.status });

      const user = await storage.updateUser(userId, { status });
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      log("info", "admin", "User status updated", { adminId: getUserId(req), targetUserId: userId, newStatus: status });
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      log("error", "admin", "User status update error", { error: String(error) });
      res.status(500).json({ message: "Failed to update user status" });
    }
  });

  app.get("/api/admin/resumes", requireAdmin, async (req, res) => {
    try {
      const resumes = await storage.getAllResumes();
      res.json(resumes);
    } catch (error) {
      log("error", "admin", "Resumes fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch resumes" });
    }
  });

  app.get("/api/admin/revisions", requireAdmin, async (req, res) => {
    try {
      const revisions = await storage.getAllRevisions();
      res.json(revisions);
    } catch (error) {
      log("error", "admin", "Revisions fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch revisions" });
    }
  });

  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    try {
      const payments = await storage.getAllPayments();
      res.json(payments);
    } catch (error) {
      log("error", "admin", "Payments fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // ===== PROMPT MANAGEMENT ROUTES =====

  app.get("/api/admin/prompts", requireAdmin, async (req, res) => {
    try {
      const prompts = await storage.getAllPromptVersions();
      res.json(prompts);
    } catch (error) {
      log("error", "admin", "Prompts fetch error", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch prompts" });
    }
  });

  app.get("/api/admin/prompts/defaults", requireAdmin, async (req, res) => {
    res.json({
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
    });
  });

  app.post("/api/admin/prompts", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req)!;
      const data = createPromptVersionSchema.parse(req.body);

      const prompt = await storage.createPromptVersion({
        ...data,
        createdBy: userId,
      });

      log("info", "admin", "Prompt version created", { promptId: prompt.id, createdBy: userId });
      res.status(201).json(prompt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      log("error", "admin", "Prompt creation error", { error: String(error) });
      res.status(500).json({ message: "Failed to create prompt version" });
    }
  });

  app.post("/api/admin/prompts/:id/activate", requireAdmin, async (req, res) => {
    try {
      const promptId = req.params.id as string;
      await storage.setActivePromptVersion(promptId);

      log("info", "admin", "Prompt activated", { promptId, activatedBy: getUserId(req) });
      res.json({ success: true });
    } catch (error) {
      log("error", "admin", "Prompt activation error", { error: String(error) });
      res.status(500).json({ message: "Failed to activate prompt" });
    }
  });

  app.post("/api/admin/prompts/test", requireAdmin, async (req, res) => {
    try {
      const userId = getUserId(req)!;
      const data = testPromptSchema.parse(req.body);

      const result = await testPrompt(
        data.systemPrompt,
        data.userPromptTemplate,
        data.testInput,
        data.targetIndustry,
        data.targetRole
      );

      if (data.promptVersionId) {
        await storage.createPromptTestRun({
          promptVersionId: data.promptVersionId,
          testInput: data.testInput,
          targetIndustry: data.targetIndustry,
          targetRole: data.targetRole,
          output: result.output,
          executionTimeMs: result.executionTimeMs,
          createdBy: userId,
        });
      }

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      log("error", "admin", "Prompt test error", { error: String(error) });
      res.status(500).json({ message: "Failed to test prompt" });
    }
  });
}
