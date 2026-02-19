import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, text, integer } from "drizzle-orm/pg-core";

// Session storage table
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("active"),
  freeRevisionsUsed: integer("free_revisions_used").notNull().default(0),
  paidRevisionsRemaining: integer("paid_revisions_remaining").notNull().default(0),
  stripeCustomerId: text("stripe_customer_id"),
  subscriptionStatus: text("subscription_status"), // null | "active" | "canceled" | "past_due"
  subscriptionId: text("subscription_id"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
