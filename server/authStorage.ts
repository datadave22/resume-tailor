import { users, type User, type UpsertUser } from "../shared/models/auth";
import { db } from "./db";
import { eq, and, ne, sql } from "drizzle-orm";

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
        // Update all foreign key references before changing the primary key
        const oldId = existingByEmail.id;
        const newId = userData.id;

        await db.execute(sql`BEGIN`);
        try {
          await db.execute(sql`UPDATE resumes SET user_id = ${newId} WHERE user_id = ${oldId}`);
          await db.execute(sql`UPDATE revisions SET user_id = ${newId} WHERE user_id = ${oldId}`);
          await db.execute(sql`UPDATE payments SET user_id = ${newId} WHERE user_id = ${oldId}`);
          await db.execute(sql`UPDATE analytics_events SET user_id = ${newId} WHERE user_id = ${oldId}`);
          await db.execute(sql`UPDATE prompt_versions SET created_by = ${newId} WHERE created_by = ${oldId}`);
          await db.execute(sql`UPDATE prompt_test_runs SET created_by = ${newId} WHERE created_by = ${oldId}`);

          const [updated] = await db
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

          await db.execute(sql`COMMIT`);
          return updated;
        } catch (error) {
          await db.execute(sql`ROLLBACK`);
          throw error;
        }
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
