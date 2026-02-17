import { users, type User, type UpsertUser } from "../shared/models/auth";
import { resumes, revisions, payments, promptVersions, analyticsEvents, promptTestRuns } from "../shared/schema";
import { db } from "./db";
import { eq, and, ne } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    if (userData.email && userData.id) {
      const [existingByEmail] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.email, userData.email),
            ne(users.id, userData.id)
          )
        );

      if (existingByEmail) {
        // Migrate user ID (e.g. Clerk dev → production) in a transaction
        // Must update all foreign key references before changing the primary key
        const oldId = existingByEmail.id;
        const newId = userData.id;

        const [updated] = await db.transaction(async (tx) => {
          // Update all tables that reference users.id
          await tx.update(resumes).set({ userId: newId }).where(eq(resumes.userId, oldId));
          await tx.update(revisions).set({ userId: newId }).where(eq(revisions.userId, oldId));
          await tx.update(payments).set({ userId: newId }).where(eq(payments.userId, oldId));
          await tx.update(analyticsEvents).set({ userId: newId }).where(eq(analyticsEvents.userId, oldId));
          await tx.update(promptVersions).set({ createdBy: newId }).where(eq(promptVersions.createdBy, oldId));
          await tx.update(promptTestRuns).set({ createdBy: newId }).where(eq(promptTestRuns.createdBy, oldId));

          // Now update the user record itself
          return tx
            .update(users)
            .set({
              id: newId,
              firstName: userData.firstName || existingByEmail.firstName,
              lastName: userData.lastName || existingByEmail.lastName,
              profileImageUrl: userData.profileImageUrl || existingByEmail.profileImageUrl,
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(users.id, oldId))
            .returning();
        });
        return updated;
      }
    }

    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
