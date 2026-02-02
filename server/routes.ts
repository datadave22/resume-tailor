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
import { tailorResume } from "./llm";
import { getUncachableStripeClient, getStripeSync, getStripePublishableKey } from "./stripeClient";
import { loginSchema, signupSchema, tailorResumeSchema } from "@shared/schema";
import { z } from "zod";
import { runMigrations } from "stripe-replit-sync";
import pgSession from "connect-pg-simple";

const PgSession = pgSession(session);

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
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

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
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
    console.error("Stripe initialization error:", error);
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

  // ===== AUTH ROUTES =====

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password } = signupSchema
        .pick({ email: true, password: true })
        .parse(req.body);

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
      });

      req.session.userId = user.id;

      const { password: _, ...safeUser } = user;
      res.status(201).json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      req.session.userId = user.id;

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
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
      console.error("Fetch resumes error:", error);
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

        const extractedText = await extractText(
          req.file.path,
          req.file.mimetype
        );

        if (!extractedText.trim()) {
          fs.unlinkSync(req.file.path);
          return res.status(400).json({ message: "Could not extract text from file" });
        }

        const resume = await storage.createResume({
          userId: req.session.userId!,
          originalFilename: req.file.originalname,
          fileType: req.file.mimetype.includes("pdf") ? "pdf" : "docx",
          extractedText,
          filePath: req.file.path,
        });

        res.status(201).json({ resume });
      } catch (error: any) {
        console.error("Upload error:", error);
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ message: error.message || "Upload failed" });
      }
    }
  );

  app.get("/api/resumes/:id", requireAuth, async (req, res) => {
    try {
      const resume = await storage.getResume(req.params.id);
      if (!resume || resume.userId !== req.session.userId) {
        return res.status(404).json({ message: "Resume not found" });
      }
      res.json(resume);
    } catch (error) {
      console.error("Fetch resume error:", error);
      res.status(500).json({ message: "Failed to fetch resume" });
    }
  });

  // ===== REVISION ROUTES =====

  app.get("/api/revisions", requireAuth, async (req, res) => {
    try {
      const revisions = await storage.getRevisionsByUser(req.session.userId!);
      res.json(revisions);
    } catch (error) {
      console.error("Fetch revisions error:", error);
      res.status(500).json({ message: "Failed to fetch revisions" });
    }
  });

  app.get("/api/revisions/:id", requireAuth, async (req, res) => {
    try {
      const revision = await storage.getRevision(req.params.id);
      if (!revision || revision.userId !== req.session.userId) {
        return res.status(404).json({ message: "Revision not found" });
      }
      res.json(revision);
    } catch (error) {
      console.error("Fetch revision error:", error);
      res.status(500).json({ message: "Failed to fetch revision" });
    }
  });

  app.post("/api/revisions/tailor", requireAuth, async (req, res) => {
    try {
      const { resumeId, targetIndustry, targetRole } = tailorResumeSchema.parse(
        req.body
      );

      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      // Check revision limits
      const freeRevisionsLeft = 3 - (user.freeRevisionsUsed || 0);
      const paidRevisionsLeft = user.paidRevisionsRemaining || 0;
      const totalRevisionsLeft = freeRevisionsLeft + paidRevisionsLeft;

      if (totalRevisionsLeft <= 0) {
        return res.status(403).json({
          message: "No revisions remaining. Please purchase more.",
        });
      }

      const resume = await storage.getResume(resumeId);
      if (!resume || resume.userId !== req.session.userId) {
        return res.status(404).json({ message: "Resume not found" });
      }

      // Call LLM to tailor resume
      const tailoredContent = await tailorResume(
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
      });

      res.status(201).json({ revision });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Tailor error:", error);
      res.status(500).json({ message: "Failed to tailor resume" });
    }
  });

  // ===== PAYMENT ROUTES =====

  app.post("/api/payments/checkout", requireAuth, async (req, res) => {
    try {
      const { planId } = req.body;

      if (!planId || !PRICING_PLANS[planId]) {
        return res.status(400).json({ message: "Invalid plan" });
      }

      const plan = PRICING_PLANS[planId];
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

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

      res.json({ url: session.url });
    } catch (error) {
      console.error("Checkout error:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Stripe webhook handler (registered before JSON middleware in index.ts)
  app.post(
    "/api/stripe/webhook",
    async (req: Request, res: Response) => {
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
            }
          }
        }

        res.json({ received: true });
      } catch (error: any) {
        console.error("Webhook error:", error);
        res.status(400).json({ error: error.message });
      }
    }
  );

  return httpServer;
}
