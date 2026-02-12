import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import {
  createMockUser,
  createMockAdmin,
  createMockResume,
  createMockRevision,
  createMockPayment,
  createMockPromptVersion,
  createMockAnalyticsEvent,
} from "../helpers/fixtures";

// ── Module mocks (must be before any imports that reference these) ──

const mockStorage = {
  getUser: vi.fn(),
  getUserByEmail: vi.fn(),
  updateUser: vi.fn(),
  getAllUsers: vi.fn(),
  getUserCount: vi.fn(),
  getActiveUserCount: vi.fn(),
  getResume: vi.fn(),
  getResumesByUser: vi.fn(),
  getAllResumes: vi.fn(),
  createResume: vi.fn(),
  deleteResume: vi.fn(),
  getResumeCount: vi.fn(),
  getRevision: vi.fn(),
  getRevisionsByUser: vi.fn(),
  getAllRevisions: vi.fn(),
  createRevision: vi.fn(),
  getRevisionCount: vi.fn(),
  getPayment: vi.fn(),
  getPaymentBySessionId: vi.fn(),
  getPaymentsByUser: vi.fn(),
  getAllPayments: vi.fn(),
  createPayment: vi.fn(),
  updatePayment: vi.fn(),
  getPromptVersion: vi.fn(),
  getActivePromptVersion: vi.fn(),
  getDefaultPromptVersion: vi.fn(),
  getAllPromptVersions: vi.fn(),
  createPromptVersion: vi.fn(),
  updatePromptVersion: vi.fn(),
  setActivePromptVersion: vi.fn(),
  trackEvent: vi.fn(),
  getAnalyticsEvents: vi.fn(),
  getEventCountByType: vi.fn(),
  getAnalyticsSummary: vi.fn(),
  createPromptTestRun: vi.fn(),
  getPromptTestRuns: vi.fn(),
};

const mockAuthStorage = {
  getUser: vi.fn(),
  upsertUser: vi.fn(),
  updateUser: vi.fn(),
};

vi.mock("../../server/storage", () => ({
  storage: mockStorage,
}));

vi.mock("../../server/authStorage", () => ({
  authStorage: mockAuthStorage,
}));

// Mock Clerk auth - controls who is "logged in" per test
let mockUserId: string | null = null;

vi.mock("@clerk/express", () => ({
  getAuth: vi.fn(() => ({ userId: mockUserId })),
  requireAuth: vi.fn(() => (req: any, res: any, next: any) => {
    if (!mockUserId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    next();
  }),
  clerkClient: {
    users: {
      getUser: vi.fn(),
    },
  },
}));

// Mock LLM module
const mockTailorResume = vi.fn();
const mockTestPrompt = vi.fn();

vi.mock("../../server/llm", () => ({
  tailorResume: mockTailorResume,
  testPrompt: mockTestPrompt,
  DEFAULT_SYSTEM_PROMPT: "Test system prompt",
  DEFAULT_USER_PROMPT_TEMPLATE: "Test template {{resumeText}}",
}));

// Mock Stripe
const mockStripeInstance = {
  customers: { create: vi.fn() },
  checkout: { sessions: { create: vi.fn() } },
  webhooks: { constructEvent: vi.fn() },
};

vi.mock("../../server/stripeClient", () => ({
  getStripeClient: vi.fn(() => mockStripeInstance),
}));

// Mock pdf-parse and mammoth (used by extractText)
vi.mock("pdf-parse", () => ({
  PDFParse: class MockPDFParse {
    data: any;
    constructor(opts: any) { this.data = opts?.data; }
    getText() { return Promise.resolve({ text: "Extracted PDF text content" }); }
    destroy() { return Promise.resolve(); }
  },
}));

vi.mock("mammoth", () => ({
  extractRawText: vi.fn().mockResolvedValue({ value: "Extracted DOCX text content" }),
}));

// ── Test suite ──

let app: Express;

beforeAll(async () => {
  const { createTestApp } = await import("../helpers/app");
  app = await createTestApp();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUserId = null;
  // Default trackEvent to return a valid event
  mockStorage.trackEvent.mockResolvedValue(createMockAnalyticsEvent());
});

// Helper to set the authenticated user for a test
function authenticateAs(userId: string) {
  mockUserId = userId;
}

// ═══════════════════════════════════════════════════
// AUTH ROUTES
// ═══════════════════════════════════════════════════

describe("GET /api/auth/user", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/auth/user");
    expect(res.status).toBe(401);
  });

  it("returns existing user from local DB", async () => {
    const user = createMockUser();
    authenticateAs(user.id);
    mockAuthStorage.getUser.mockResolvedValue(user);

    const res = await request(app).get("/api/auth/user");

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.email).toBe(user.email);
    expect(mockAuthStorage.getUser).toHaveBeenCalledWith(user.id);
  });

  it("syncs new user from Clerk on first access", async () => {
    const userId = "user_new789";
    authenticateAs(userId);
    mockAuthStorage.getUser.mockResolvedValue(undefined);

    const { clerkClient } = await import("@clerk/express");
    (clerkClient.users.getUser as any).mockResolvedValue({
      emailAddresses: [{ emailAddress: "new@example.com" }],
      firstName: "New",
      lastName: "User",
      imageUrl: "https://example.com/new.jpg",
    });

    const createdUser = createMockUser({ id: userId, email: "new@example.com" });
    mockAuthStorage.upsertUser.mockResolvedValue(createdUser);

    const res = await request(app).get("/api/auth/user");

    expect(res.status).toBe(200);
    expect(mockAuthStorage.upsertUser).toHaveBeenCalledWith({
      id: userId,
      email: "new@example.com",
      firstName: "New",
      lastName: "User",
      profileImageUrl: "https://example.com/new.jpg",
    });
  });
});

// ═══════════════════════════════════════════════════
// RESUME ROUTES
// ═══════════════════════════════════════════════════

describe("GET /api/resumes", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/resumes");
    expect(res.status).toBe(401);
  });

  it("returns user's resumes", async () => {
    const userId = "user_test123";
    authenticateAs(userId);
    mockStorage.getUser.mockResolvedValue(createMockUser());

    const resumes = [createMockResume(), createMockResume({ id: "resume_2" })];
    mockStorage.getResumesByUser.mockResolvedValue(resumes);

    const res = await request(app).get("/api/resumes");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(mockStorage.getResumesByUser).toHaveBeenCalledWith(userId);
  });
});

describe("POST /api/resumes/upload", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .post("/api/resumes/upload")
      .attach("file", Buffer.from("fake pdf"), "resume.pdf");
    expect(res.status).toBe(401);
  });

  it("uploads a PDF and extracts text", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());

    const resume = createMockResume();
    mockStorage.createResume.mockResolvedValue(resume);

    const res = await request(app)
      .post("/api/resumes/upload")
      .attach("file", Buffer.from("%PDF-1.4 fake content"), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.resume.id).toBe(resume.id);
    expect(mockStorage.createResume).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_test123",
        originalFilename: "resume.pdf",
        fileType: "pdf",
        filePath: "memory-upload",
      }),
    );
    expect(mockStorage.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "upload", userId: "user_test123" }),
    );
  });

  it("rejects unsupported file types", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());

    const res = await request(app)
      .post("/api/resumes/upload")
      .attach("file", Buffer.from("not a resume"), {
        filename: "resume.txt",
        contentType: "text/plain",
      });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/Only PDF and DOCX/i);
  });

  it("returns 400 when no file is uploaded", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());

    const res = await request(app).post("/api/resumes/upload");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/No file uploaded/);
  });
});

describe("GET /api/resumes/:id", () => {
  it("returns a specific resume owned by user", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());

    const resume = createMockResume();
    mockStorage.getResume.mockResolvedValue(resume);

    const res = await request(app).get(`/api/resumes/${resume.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(resume.id);
  });

  it("returns 404 for resume owned by another user", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());

    mockStorage.getResume.mockResolvedValue(createMockResume({ userId: "other_user" }));

    const res = await request(app).get("/api/resumes/resume_abc123");

    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent resume", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());
    mockStorage.getResume.mockResolvedValue(undefined);

    const res = await request(app).get("/api/resumes/nonexistent");

    expect(res.status).toBe(404);
  });
});

// ═══════════════════════════════════════════════════
// REVISION ROUTES
// ═══════════════════════════════════════════════════

describe("GET /api/revisions", () => {
  it("returns user's revisions", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());

    const revisions = [createMockRevision()];
    mockStorage.getRevisionsByUser.mockResolvedValue(revisions);

    const res = await request(app).get("/api/revisions");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe("GET /api/revisions/:id", () => {
  it("returns a specific revision owned by user", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());

    const revision = createMockRevision();
    mockStorage.getRevision.mockResolvedValue(revision);

    const res = await request(app).get(`/api/revisions/${revision.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(revision.id);
  });

  it("returns 404 for another user's revision", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());
    mockStorage.getRevision.mockResolvedValue(createMockRevision({ userId: "other_user" }));

    const res = await request(app).get("/api/revisions/revision_def456");

    expect(res.status).toBe(404);
  });
});

describe("POST /api/revisions/tailor", () => {
  const validBody = {
    resumeId: "resume_abc123",
    targetIndustry: "Technology",
    targetRole: "Senior Frontend Engineer",
  };

  it("tailors a resume using free revision", async () => {
    authenticateAs("user_test123");
    const user = createMockUser({ freeRevisionsUsed: 0 });
    mockStorage.getUser.mockResolvedValue(user);

    const resume = createMockResume();
    mockStorage.getResume.mockResolvedValue(resume);

    mockTailorResume.mockResolvedValue({
      content: "Tailored content here",
      promptVersionId: "prompt_v1",
    });

    const revision = createMockRevision({ wasFree: true });
    mockStorage.createRevision.mockResolvedValue(revision);
    mockStorage.updateUser.mockResolvedValue(user);

    const res = await request(app)
      .post("/api/revisions/tailor")
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.revision.id).toBe(revision.id);
    expect(mockTailorResume).toHaveBeenCalledWith(
      resume.extractedText,
      "Technology",
      "Senior Frontend Engineer",
    );
    // Verify free revision counter was incremented
    expect(mockStorage.updateUser).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ freeRevisionsUsed: 1 }),
    );
  });

  it("uses paid revision when free revisions exhausted", async () => {
    authenticateAs("user_test123");
    const user = createMockUser({ freeRevisionsUsed: 3, paidRevisionsRemaining: 5 });
    mockStorage.getUser.mockResolvedValue(user);
    mockStorage.getResume.mockResolvedValue(createMockResume());

    mockTailorResume.mockResolvedValue({ content: "Tailored", promptVersionId: null });
    mockStorage.createRevision.mockResolvedValue(createMockRevision({ wasFree: false }));
    mockStorage.updateUser.mockResolvedValue(user);

    const res = await request(app)
      .post("/api/revisions/tailor")
      .send(validBody);

    expect(res.status).toBe(201);
    // Verify paid revision was decremented
    expect(mockStorage.updateUser).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ paidRevisionsRemaining: 4 }),
    );
  });

  it("returns 403 when no revisions remaining", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(
      createMockUser({ freeRevisionsUsed: 3, paidRevisionsRemaining: 0 }),
    );

    const res = await request(app)
      .post("/api/revisions/tailor")
      .send(validBody);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/used all your revisions/i);
  });

  it("returns 404 when resume doesn't exist", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());
    mockStorage.getResume.mockResolvedValue(undefined);

    const res = await request(app)
      .post("/api/revisions/tailor")
      .send(validBody);

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid request body", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());

    const res = await request(app)
      .post("/api/revisions/tailor")
      .send({ resumeId: "" }); // Missing required fields

    expect(res.status).toBe(400);
  });

  it("tracks error event on LLM failure", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());
    mockStorage.getResume.mockResolvedValue(createMockResume());
    mockTailorResume.mockRejectedValue(new Error("OpenAI timeout"));

    const res = await request(app)
      .post("/api/revisions/tailor")
      .send(validBody);

    expect(res.status).toBe(500);
    expect(mockStorage.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "error" }),
    );
  });
});

// ═══════════════════════════════════════════════════
// PAYMENT ROUTES
// ═══════════════════════════════════════════════════

describe("POST /api/payments/checkout", () => {
  it("creates a Stripe checkout session", async () => {
    authenticateAs("user_test123");
    const user = createMockUser({ stripeCustomerId: "cus_existing" });
    mockStorage.getUser.mockResolvedValue(user);

    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      id: "cs_test_session",
      url: "https://checkout.stripe.com/pay/cs_test_session",
    });

    mockStorage.createPayment.mockResolvedValue(createMockPayment());

    const res = await request(app)
      .post("/api/payments/checkout")
      .send({ planId: "professional" });

    expect(res.status).toBe(200);
    expect(res.body.url).toContain("stripe.com");
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_existing",
        mode: "payment",
      }),
    );
  });

  it("creates Stripe customer if user doesn't have one", async () => {
    authenticateAs("user_test123");
    const user = createMockUser({ stripeCustomerId: null });
    mockStorage.getUser.mockResolvedValue(user);
    mockStorage.updateUser.mockResolvedValue(user);

    mockStripeInstance.customers.create.mockResolvedValue({ id: "cus_new123" });
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      id: "cs_test",
      url: "https://checkout.stripe.com/pay/cs_test",
    });
    mockStorage.createPayment.mockResolvedValue(createMockPayment());

    const res = await request(app)
      .post("/api/payments/checkout")
      .send({ planId: "basic" });

    expect(res.status).toBe(200);
    expect(mockStripeInstance.customers.create).toHaveBeenCalled();
    expect(mockStorage.updateUser).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ stripeCustomerId: "cus_new123" }),
    );
  });

  it("rejects invalid plan ID", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser());

    const res = await request(app)
      .post("/api/payments/checkout")
      .send({ planId: "nonexistent" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid plan/);
  });
});

describe("POST /api/stripe/webhook", () => {
  it("processes checkout.session.completed event", async () => {
    const payment = createMockPayment({ status: "pending" });
    const user = createMockUser({ paidRevisionsRemaining: 5 });

    mockStripeInstance.webhooks.constructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_abc123",
          payment_intent: "pi_abc123",
          metadata: { userId: user.id, revisions: "15" },
          amount_total: 999,
        },
      },
    });

    mockStorage.getPaymentBySessionId.mockResolvedValue(payment);
    mockStorage.updatePayment.mockResolvedValue({ ...payment, status: "completed" });
    mockStorage.getUser.mockResolvedValue(user);
    mockStorage.updateUser.mockResolvedValue(user);

    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("stripe-signature", "sig_test")
      .send({ type: "checkout.session.completed" });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockStorage.updatePayment).toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({ status: "completed" }),
    );
    expect(mockStorage.updateUser).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ paidRevisionsRemaining: 20 }),
    );
  });

  it("returns 400 when stripe signature is missing", async () => {
    const res = await request(app)
      .post("/api/stripe/webhook")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing signature/);
  });
});

// ═══════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════

describe("Admin routes", () => {
  const adminUser = createMockAdmin();

  beforeEach(() => {
    authenticateAs(adminUser.id);
    // requireAdmin checks storage.getUser for role
    mockStorage.getUser.mockResolvedValue(adminUser);
  });

  describe("GET /api/admin/stats", () => {
    it("returns analytics summary for admins", async () => {
      const summary = {
        totalUsers: 100,
        activeUsers7d: 25,
        totalResumes: 200,
        totalRevisions: 150,
        totalPayments: 30,
        revenue: 29970,
      };
      mockStorage.getAnalyticsSummary.mockResolvedValue(summary);

      const res = await request(app).get("/api/admin/stats");

      expect(res.status).toBe(200);
      expect(res.body.totalUsers).toBe(100);
      expect(res.body.revenue).toBe(29970);
    });
  });

  describe("GET /api/admin/users", () => {
    it("returns all users for admins", async () => {
      mockStorage.getAllUsers.mockResolvedValue([createMockUser(), createMockAdmin()]);

      const res = await request(app).get("/api/admin/users");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe("PATCH /api/admin/users/:id/status", () => {
    it("deactivates a user", async () => {
      const targetUser = createMockUser({ status: "deactivated" });
      mockStorage.updateUser.mockResolvedValue(targetUser);

      const res = await request(app)
        .patch(`/api/admin/users/${targetUser.id}/status`)
        .send({ status: "deactivated" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("deactivated");
    });

    it("returns 400 for invalid status", async () => {
      const res = await request(app)
        .patch("/api/admin/users/user_test123/status")
        .send({ status: "banned" }); // Not a valid enum value

      expect(res.status).toBe(400);
    });

    it("returns 404 when user not found", async () => {
      mockStorage.updateUser.mockResolvedValue(undefined);

      const res = await request(app)
        .patch("/api/admin/users/nonexistent/status")
        .send({ status: "deactivated" });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/admin/resumes", () => {
    it("returns all resumes for admins", async () => {
      mockStorage.getAllResumes.mockResolvedValue([createMockResume()]);

      const res = await request(app).get("/api/admin/resumes");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe("GET /api/admin/revisions", () => {
    it("returns all revisions for admins", async () => {
      mockStorage.getAllRevisions.mockResolvedValue([createMockRevision()]);

      const res = await request(app).get("/api/admin/revisions");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe("GET /api/admin/payments", () => {
    it("returns all payments for admins", async () => {
      mockStorage.getAllPayments.mockResolvedValue([createMockPayment()]);

      const res = await request(app).get("/api/admin/payments");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe("Admin access control", () => {
    it("returns 401 for unauthenticated request", async () => {
      mockUserId = null;

      const res = await request(app).get("/api/admin/stats");

      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admin user", async () => {
      authenticateAs("user_test123");
      mockStorage.getUser.mockResolvedValue(createMockUser({ role: "user" }));

      const res = await request(app).get("/api/admin/stats");

      expect(res.status).toBe(403);
    });
  });
});

// ═══════════════════════════════════════════════════
// PROMPT MANAGEMENT ROUTES
// ═══════════════════════════════════════════════════

describe("Prompt management routes", () => {
  const adminUser = createMockAdmin();

  beforeEach(() => {
    authenticateAs(adminUser.id);
    mockStorage.getUser.mockResolvedValue(adminUser);
  });

  describe("GET /api/admin/prompts", () => {
    it("returns all prompt versions", async () => {
      mockStorage.getAllPromptVersions.mockResolvedValue([createMockPromptVersion()]);

      const res = await request(app).get("/api/admin/prompts");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe("GET /api/admin/prompts/defaults", () => {
    it("returns default prompt templates", async () => {
      const res = await request(app).get("/api/admin/prompts/defaults");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("systemPrompt");
      expect(res.body).toHaveProperty("userPromptTemplate");
    });
  });

  describe("POST /api/admin/prompts", () => {
    it("creates a new prompt version", async () => {
      const prompt = createMockPromptVersion();
      mockStorage.createPromptVersion.mockResolvedValue(prompt);

      const res = await request(app)
        .post("/api/admin/prompts")
        .send({
          name: "v2.0 Test",
          systemPrompt: "New system prompt",
          userPromptTemplate: "New template {{resumeText}}",
        });

      expect(res.status).toBe(201);
      expect(mockStorage.createPromptVersion).toHaveBeenCalled();
    });

    it("returns 400 for missing required fields", async () => {
      const res = await request(app)
        .post("/api/admin/prompts")
        .send({ name: "" }); // Empty name

      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/admin/prompts/:id/activate", () => {
    it("activates a prompt version", async () => {
      mockStorage.setActivePromptVersion.mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/admin/prompts/prompt_jkl012/activate");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockStorage.setActivePromptVersion).toHaveBeenCalledWith("prompt_jkl012");
    });
  });

  describe("POST /api/admin/prompts/test", () => {
    it("tests a prompt with sample input", async () => {
      mockTestPrompt.mockResolvedValue({
        output: "Tailored output text",
        executionTimeMs: 1500,
      });
      mockStorage.createPromptTestRun.mockResolvedValue({
        id: "run_1",
        output: "Tailored output text",
        executionTimeMs: 1500,
      });

      const res = await request(app)
        .post("/api/admin/prompts/test")
        .send({
          promptVersionId: "prompt_jkl012",
          systemPrompt: "Test prompt",
          userPromptTemplate: "Template {{resumeText}}",
          testInput: "Sample resume text",
          targetIndustry: "Technology",
          targetRole: "Engineer",
        });

      expect(res.status).toBe(200);
      expect(res.body.output).toBe("Tailored output text");
      expect(mockStorage.createPromptTestRun).toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════
// DEACTIVATED USER MIDDLEWARE
// ═══════════════════════════════════════════════════

describe("checkUserActive middleware", () => {
  it("blocks deactivated users from accessing API", async () => {
    authenticateAs("user_test123");
    mockStorage.getUser.mockResolvedValue(createMockUser({ status: "deactivated" }));

    const res = await request(app).get("/api/resumes");

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/deactivated/i);
  });
});
