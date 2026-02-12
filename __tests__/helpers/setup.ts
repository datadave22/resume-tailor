/**
 * Global test setup - runs before all test suites.
 * Mocks external dependencies to isolate unit tests from real services.
 */
import { vi } from "vitest";

// Mock environment config before any module imports it
vi.mock("../../config/env.js", () => ({
  default: {
    app: { port: 5000, baseUrl: "http://localhost:5000" },
    database: { url: "postgresql://test:test@localhost:5432/test" },
    stripe: {
      secretKey: "sk_test_fake",
      publishableKey: "pk_test_fake",
      webhookSecret: "whsec_test_fake",
    },
    openai: { apiKey: "sk-test-fake", baseURL: undefined },
    clerk: {
      secretKey: "sk_test_fake",
      publishableKey: "pk_test_fake",
    },
    isProduction: () => false,
    isDevelopment: () => true,
  },
}));

// Mock database connection
vi.mock("../../server/db", () => ({
  db: {},
}));
