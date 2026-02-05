import { eq, desc, sql, count, and, gte } from "drizzle-orm";
import { db } from "./db";
import { 
  users,
  resumes, 
  revisions, 
  payments,
  promptVersions,
  analyticsEvents,
  promptTestRuns,
  type User,
  type Resume,
  type InsertResume,
  type Revision,
  type InsertRevision,
  type Payment,
  type InsertPayment,
  type PromptVersion,
  type InsertPromptVersion,
  type AnalyticsEvent,
  type InsertAnalyticsEvent,
  type PromptTestRun,
  type InsertPromptTestRun
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getUserCount(): Promise<number>;
  getActiveUserCount(since: Date): Promise<number>;
  
  // Resumes
  getResume(id: string): Promise<Resume | undefined>;
  getResumesByUser(userId: string): Promise<Resume[]>;
  getAllResumes(): Promise<Resume[]>;
  createResume(resume: InsertResume): Promise<Resume>;
  deleteResume(id: string): Promise<void>;
  getResumeCount(): Promise<number>;
  
  // Revisions
  getRevision(id: string): Promise<Revision | undefined>;
  getRevisionsByUser(userId: string): Promise<Revision[]>;
  getAllRevisions(): Promise<Revision[]>;
  createRevision(revision: InsertRevision): Promise<Revision>;
  getRevisionCount(): Promise<number>;
  
  // Payments
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentBySessionId(sessionId: string): Promise<Payment | undefined>;
  getPaymentsByUser(userId: string): Promise<Payment[]>;
  getAllPayments(): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined>;
  
  // Prompt Versions
  getPromptVersion(id: string): Promise<PromptVersion | undefined>;
  getActivePromptVersion(): Promise<PromptVersion | undefined>;
  getDefaultPromptVersion(): Promise<PromptVersion | undefined>;
  getAllPromptVersions(): Promise<PromptVersion[]>;
  createPromptVersion(prompt: InsertPromptVersion): Promise<PromptVersion>;
  updatePromptVersion(id: string, data: Partial<PromptVersion>): Promise<PromptVersion | undefined>;
  setActivePromptVersion(id: string): Promise<void>;
  
  // Analytics
  trackEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent>;
  getAnalyticsEvents(limit?: number): Promise<AnalyticsEvent[]>;
  getEventCountByType(eventType: string, since?: Date): Promise<number>;
  getAnalyticsSummary(): Promise<{
    totalUsers: number;
    activeUsers7d: number;
    totalResumes: number;
    totalRevisions: number;
    totalPayments: number;
    revenue: number;
  }>;
  
  // Prompt Test Runs
  createPromptTestRun(run: InsertPromptTestRun): Promise<PromptTestRun>;
  getPromptTestRuns(promptVersionId: string): Promise<PromptTestRun[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUserCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(users);
    return result?.count || 0;
  }

  async getActiveUserCount(since: Date): Promise<number> {
    const [result] = await db.select({ count: count() }).from(users)
      .where(and(eq(users.status, "active"), gte(users.lastLoginAt, since)));
    return result?.count || 0;
  }

  // Resumes
  async getResume(id: string): Promise<Resume | undefined> {
    const [resume] = await db.select().from(resumes).where(eq(resumes.id, id));
    return resume;
  }

  async getResumesByUser(userId: string): Promise<Resume[]> {
    return db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.createdAt));
  }

  async getAllResumes(): Promise<Resume[]> {
    return db.select().from(resumes).orderBy(desc(resumes.createdAt));
  }

  async createResume(insertResume: InsertResume): Promise<Resume> {
    const [resume] = await db.insert(resumes).values(insertResume).returning();
    return resume;
  }

  async deleteResume(id: string): Promise<void> {
    await db.delete(resumes).where(eq(resumes.id, id));
  }

  async getResumeCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(resumes);
    return result?.count || 0;
  }

  // Revisions
  async getRevision(id: string): Promise<Revision | undefined> {
    const [revision] = await db.select().from(revisions).where(eq(revisions.id, id));
    return revision;
  }

  async getRevisionsByUser(userId: string): Promise<Revision[]> {
    return db.select().from(revisions).where(eq(revisions.userId, userId)).orderBy(desc(revisions.createdAt));
  }

  async getAllRevisions(): Promise<Revision[]> {
    return db.select().from(revisions).orderBy(desc(revisions.createdAt));
  }

  async createRevision(insertRevision: InsertRevision): Promise<Revision> {
    const [revision] = await db.insert(revisions).values(insertRevision).returning();
    return revision;
  }

  async getRevisionCount(): Promise<number> {
    const [result] = await db.select({ count: count() }).from(revisions);
    return result?.count || 0;
  }

  // Payments
  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async getPaymentBySessionId(sessionId: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.stripeSessionId, sessionId));
    return payment;
  }

  async getPaymentsByUser(userId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
  }

  async getAllPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    return payment;
  }

  async updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined> {
    const [payment] = await db.update(payments).set(data).where(eq(payments.id, id)).returning();
    return payment;
  }

  // Prompt Versions
  async getPromptVersion(id: string): Promise<PromptVersion | undefined> {
    const [prompt] = await db.select().from(promptVersions).where(eq(promptVersions.id, id));
    return prompt;
  }

  async getActivePromptVersion(): Promise<PromptVersion | undefined> {
    const [prompt] = await db.select().from(promptVersions).where(eq(promptVersions.isActive, true));
    return prompt;
  }

  async getDefaultPromptVersion(): Promise<PromptVersion | undefined> {
    const [prompt] = await db.select().from(promptVersions).where(eq(promptVersions.isDefault, true));
    return prompt;
  }

  async getAllPromptVersions(): Promise<PromptVersion[]> {
    return db.select().from(promptVersions).orderBy(desc(promptVersions.createdAt));
  }

  async createPromptVersion(insertPrompt: InsertPromptVersion): Promise<PromptVersion> {
    const [prompt] = await db.insert(promptVersions).values(insertPrompt).returning();
    return prompt;
  }

  async updatePromptVersion(id: string, data: Partial<PromptVersion>): Promise<PromptVersion | undefined> {
    const [prompt] = await db.update(promptVersions).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(promptVersions.id, id)).returning();
    return prompt;
  }

  async setActivePromptVersion(id: string): Promise<void> {
    await db.update(promptVersions).set({ isActive: false });
    await db.update(promptVersions).set({ isActive: true }).where(eq(promptVersions.id, id));
  }

  // Analytics
  async trackEvent(event: InsertAnalyticsEvent): Promise<AnalyticsEvent> {
    const [analyticsEvent] = await db.insert(analyticsEvents).values(event).returning();
    return analyticsEvent;
  }

  async getAnalyticsEvents(limit = 100): Promise<AnalyticsEvent[]> {
    return db.select().from(analyticsEvents).orderBy(desc(analyticsEvents.createdAt)).limit(limit);
  }

  async getEventCountByType(eventType: string, since?: Date): Promise<number> {
    let query = db.select({ count: count() }).from(analyticsEvents)
      .where(eq(analyticsEvents.eventType, eventType));
    
    if (since) {
      query = db.select({ count: count() }).from(analyticsEvents)
        .where(and(eq(analyticsEvents.eventType, eventType), gte(analyticsEvents.createdAt, since)));
    }
    
    const [result] = await query;
    return result?.count || 0;
  }

  async getAnalyticsSummary(): Promise<{
    totalUsers: number;
    activeUsers7d: number;
    totalResumes: number;
    totalRevisions: number;
    totalPayments: number;
    revenue: number;
  }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const [userCount] = await db.select({ count: count() }).from(users);
    const [activeCount] = await db.select({ count: count() }).from(users)
      .where(and(eq(users.status, "active"), gte(users.lastLoginAt, sevenDaysAgo)));
    const [resumeCount] = await db.select({ count: count() }).from(resumes);
    const [revisionCount] = await db.select({ count: count() }).from(revisions);
    const [paymentData] = await db.select({ 
      count: count(),
      revenue: sql<number>`COALESCE(SUM(${payments.amount}), 0)`
    }).from(payments).where(eq(payments.status, "completed"));
    
    return {
      totalUsers: userCount?.count || 0,
      activeUsers7d: activeCount?.count || 0,
      totalResumes: resumeCount?.count || 0,
      totalRevisions: revisionCount?.count || 0,
      totalPayments: paymentData?.count || 0,
      revenue: paymentData?.revenue || 0,
    };
  }

  // Prompt Test Runs
  async createPromptTestRun(run: InsertPromptTestRun): Promise<PromptTestRun> {
    const [testRun] = await db.insert(promptTestRuns).values(run).returning();
    return testRun;
  }

  async getPromptTestRuns(promptVersionId: string): Promise<PromptTestRun[]> {
    return db.select().from(promptTestRuns)
      .where(eq(promptTestRuns.promptVersionId, promptVersionId))
      .orderBy(desc(promptTestRuns.createdAt));
  }
}

export const storage = new DatabaseStorage();
