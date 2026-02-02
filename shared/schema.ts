import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table - stores user authentication and revision tracking
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  freeRevisionsUsed: integer("free_revisions_used").notNull().default(0),
  paidRevisionsRemaining: integer("paid_revisions_remaining").notNull().default(0),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Resumes table - stores uploaded resumes
export const resumes = pgTable("resumes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  originalFilename: text("original_filename").notNull(),
  fileType: text("file_type").notNull(), // pdf or docx
  extractedText: text("extracted_text").notNull(),
  filePath: text("file_path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Revisions table - stores tailored resume versions
export const revisions = pgTable("revisions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  resumeId: varchar("resume_id", { length: 36 }).notNull().references(() => resumes.id, { onDelete: "cascade" }),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  targetIndustry: text("target_industry").notNull(),
  targetRole: text("target_role").notNull(),
  tailoredContent: text("tailored_content").notNull(),
  wasFree: boolean("was_free").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Payments table - tracks payment history
export const payments = pgTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  stripeSessionId: text("stripe_session_id").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  amount: integer("amount").notNull(), // in cents
  currency: text("currency").notNull().default("usd"),
  status: text("status").notNull().default("pending"), // pending, completed, failed
  revisionsGranted: integer("revisions_granted").notNull().default(10),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
});

export const insertResumeSchema = createInsertSchema(resumes).pick({
  userId: true,
  originalFilename: true,
  fileType: true,
  extractedText: true,
  filePath: true,
});

export const insertRevisionSchema = createInsertSchema(revisions).pick({
  resumeId: true,
  userId: true,
  targetIndustry: true,
  targetRole: true,
  tailoredContent: true,
  wasFree: true,
});

export const insertPaymentSchema = createInsertSchema(payments).pick({
  userId: true,
  stripeSessionId: true,
  stripePaymentIntentId: true,
  amount: true,
  currency: true,
  status: true,
  revisionsGranted: true,
});

// Auth schemas for validation
export const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const tailorResumeSchema = z.object({
  resumeId: z.string().min(1, "Resume is required"),
  targetIndustry: z.string().min(1, "Industry is required"),
  targetRole: z.string().min(1, "Job role is required"),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Resume = typeof resumes.$inferSelect;
export type InsertResume = z.infer<typeof insertResumeSchema>;
export type Revision = typeof revisions.$inferSelect;
export type InsertRevision = z.infer<typeof insertRevisionSchema>;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type TailorResumeInput = z.infer<typeof tailorResumeSchema>;
