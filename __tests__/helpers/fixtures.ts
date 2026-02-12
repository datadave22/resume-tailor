import type { User } from "../../shared/models/auth";
import type { Resume, Revision, Payment, PromptVersion, AnalyticsEvent } from "../../shared/schema";

/**
 * Test data factories for consistent mock data across test suites.
 */

export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "user_test123",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    profileImageUrl: "https://example.com/avatar.jpg",
    role: "user",
    status: "active",
    freeRevisionsUsed: 0,
    paidRevisionsRemaining: 0,
    stripeCustomerId: null,
    lastLoginAt: new Date("2025-01-15"),
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-15"),
    ...overrides,
  };
}

export function createMockAdmin(overrides: Partial<User> = {}): User {
  return createMockUser({
    id: "user_admin456",
    email: "admin@example.com",
    firstName: "Admin",
    lastName: "User",
    role: "admin",
    ...overrides,
  });
}

export function createMockResume(overrides: Partial<Resume> = {}): Resume {
  return {
    id: "resume_abc123",
    userId: "user_test123",
    originalFilename: "resume.pdf",
    fileType: "pdf",
    extractedText: "John Doe\nSoftware Engineer\n5 years experience in React and Node.js",
    filePath: "memory-upload",
    createdAt: new Date("2025-01-10"),
    ...overrides,
  };
}

export function createMockRevision(overrides: Partial<Revision> = {}): Revision {
  return {
    id: "revision_def456",
    resumeId: "resume_abc123",
    userId: "user_test123",
    targetIndustry: "Technology",
    targetRole: "Senior Frontend Engineer",
    tailoredContent: "# John Doe\n## Senior Frontend Engineer\nOptimized React applications...",
    wasFree: true,
    promptVersionId: null,
    createdAt: new Date("2025-01-10"),
    ...overrides,
  };
}

export function createMockPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment_ghi789",
    userId: "user_test123",
    stripeSessionId: "cs_test_abc123",
    stripePaymentIntentId: null,
    amount: 999,
    currency: "usd",
    status: "pending",
    revisionsGranted: 15,
    createdAt: new Date("2025-01-12"),
    ...overrides,
  };
}

export function createMockPromptVersion(overrides: Partial<PromptVersion> = {}): PromptVersion {
  return {
    id: "prompt_jkl012",
    name: "v1.0 Production",
    description: "Initial production prompt",
    systemPrompt: "You are a resume coach...",
    userPromptTemplate: "Tailor this resume for {{targetIndustry}}...",
    isActive: true,
    isDefault: false,
    createdBy: "user_admin456",
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

export function createMockAnalyticsEvent(overrides: Partial<AnalyticsEvent> = {}): AnalyticsEvent {
  return {
    id: "event_mno345",
    eventType: "upload",
    userId: "user_test123",
    metadata: { resumeId: "resume_abc123" },
    createdAt: new Date("2025-01-10"),
    ...overrides,
  };
}
