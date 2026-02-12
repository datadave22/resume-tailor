import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockUser } from "../helpers/fixtures";

// Mock drizzle-orm - need to include `sql` since auth schema uses sql`gen_random_uuid()`
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
  };
});

// Mock drizzle db operations with chainable API
const mockWhere = vi.fn();
const mockReturning = vi.fn();

vi.mock("../../server/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockWhere,
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => ({
          returning: mockReturning,
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: mockReturning,
        }),
      }),
    }),
  },
}));

const { authStorage } = await import("../../server/authStorage");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthStorage", () => {
  describe("getUser", () => {
    it("returns user when found", async () => {
      const user = createMockUser();
      mockWhere.mockResolvedValue([user]);

      const result = await authStorage.getUser("user_test123");

      expect(result).toEqual(user);
    });

    it("returns undefined when user not found", async () => {
      mockWhere.mockResolvedValue([]);

      const result = await authStorage.getUser("nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("upsertUser", () => {
    it("creates new user via upsert when no email conflict", async () => {
      const user = createMockUser();
      // Email check finds no conflict
      mockWhere.mockResolvedValue([]);
      // Upsert returns new user
      mockReturning.mockResolvedValue([user]);

      const result = await authStorage.upsertUser({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      });

      expect(result).toEqual(user);
    });

    it("updates existing user when email conflicts with different ID", async () => {
      const existingUser = createMockUser({ id: "old_id", email: "shared@example.com" });
      // Email check returns existing user with different ID
      mockWhere.mockResolvedValueOnce([existingUser]);
      // Update returns the updated user
      mockReturning.mockResolvedValue([{ ...existingUser, firstName: "Updated" }]);

      const result = await authStorage.upsertUser({
        id: "new_id",
        email: "shared@example.com",
        firstName: "Updated",
      });

      expect(result.firstName).toBe("Updated");
    });
  });

  describe("updateUser", () => {
    it("updates and returns user", async () => {
      const updated = createMockUser({ status: "deactivated" });
      mockReturning.mockResolvedValue([updated]);

      const result = await authStorage.updateUser("user_test123", { status: "deactivated" });

      expect(result?.status).toBe("deactivated");
    });

    it("returns undefined when user not found", async () => {
      mockReturning.mockResolvedValue([]);

      const result = await authStorage.updateUser("nonexistent", { status: "active" });

      expect(result).toBeUndefined();
    });
  });
});
