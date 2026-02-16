import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, desc, sql } from "drizzle-orm";
import { users } from "../shared/models/auth";
import { resumes, revisions, payments } from "../shared/schema";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const args = process.argv.slice(2);
const command = args[0];

async function listUsers() {
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  console.log("\n=== All Users ===\n");
  console.log(
    "ID".padEnd(40) +
    "Email".padEnd(35) +
    "Name".padEnd(25) +
    "Role".padEnd(8) +
    "Status".padEnd(12) +
    "Free Used".padEnd(12) +
    "Paid Left".padEnd(10)
  );
  console.log("-".repeat(142));
  for (const u of allUsers) {
    const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "-";
    console.log(
      (u.id || "").padEnd(40) +
      (u.email || "-").padEnd(35) +
      name.padEnd(25) +
      (u.role || "user").padEnd(8) +
      (u.status || "active").padEnd(12) +
      String(u.freeRevisionsUsed).padEnd(12) +
      String(u.paidRevisionsRemaining).padEnd(10)
    );
  }
  console.log(`\nTotal: ${allUsers.length} users\n`);
}

async function promoteUser(identifier: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, identifier));

  if (!user) {
    const [userById] = await db
      .select()
      .from(users)
      .where(eq(users.id, identifier));
    if (!userById) {
      console.error(`\nUser not found: ${identifier}\n`);
      process.exit(1);
    }
    await db.update(users).set({ role: "admin", updatedAt: new Date() }).where(eq(users.id, userById.id));
    console.log(`\nPromoted user "${userById.email || userById.id}" to admin.\n`);
    return;
  }

  await db.update(users).set({ role: "admin", updatedAt: new Date() }).where(eq(users.id, user.id));
  console.log(`\nPromoted user "${user.email}" to admin.\n`);
}

async function demoteUser(identifier: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, identifier));

  const target = user || (await db.select().from(users).where(eq(users.id, identifier)))[0];
  if (!target) {
    console.error(`\nUser not found: ${identifier}\n`);
    process.exit(1);
  }

  await db.update(users).set({ role: "user", updatedAt: new Date() }).where(eq(users.id, target.id));
  console.log(`\nDemoted user "${target.email || target.id}" to regular user.\n`);
}

async function grantRevisions(identifier: string, count: number) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, identifier));

  const target = user || (await db.select().from(users).where(eq(users.id, identifier)))[0];
  if (!target) {
    console.error(`\nUser not found: ${identifier}\n`);
    process.exit(1);
  }

  const newCount = target.paidRevisionsRemaining + count;
  await db.update(users).set({ paidRevisionsRemaining: newCount, updatedAt: new Date() }).where(eq(users.id, target.id));
  console.log(`\nGranted ${count} revisions to "${target.email || target.id}". New balance: ${newCount}\n`);
}

async function deactivateUser(identifier: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, identifier));

  const target = user || (await db.select().from(users).where(eq(users.id, identifier)))[0];
  if (!target) {
    console.error(`\nUser not found: ${identifier}\n`);
    process.exit(1);
  }

  await db.update(users).set({ status: "deactivated", updatedAt: new Date() }).where(eq(users.id, target.id));
  console.log(`\nDeactivated user "${target.email || target.id}".\n`);
}

async function activateUser(identifier: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, identifier));

  const target = user || (await db.select().from(users).where(eq(users.id, identifier)))[0];
  if (!target) {
    console.error(`\nUser not found: ${identifier}\n`);
    process.exit(1);
  }

  await db.update(users).set({ status: "active", updatedAt: new Date() }).where(eq(users.id, target.id));
  console.log(`\nActivated user "${target.email || target.id}".\n`);
}

async function showStats() {
  const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [resumeCount] = await db.select({ count: sql<number>`count(*)` }).from(resumes);
  const [revisionCount] = await db.select({ count: sql<number>`count(*)` }).from(revisions);
  const [paymentResult] = await db
    .select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(amount), 0)`,
    })
    .from(payments)
    .where(eq(payments.status, "completed"));

  console.log("\n=== Application Stats ===\n");
  console.log(`Users:         ${userCount.count}`);
  console.log(`Resumes:       ${resumeCount.count}`);
  console.log(`Revisions:     ${revisionCount.count}`);
  console.log(`Payments:      ${paymentResult.count}`);
  console.log(`Revenue:       $${(Number(paymentResult.revenue) / 100).toFixed(2)}`);
  console.log();
}

function showHelp() {
  console.log(`
ResumePolish Admin CLI
======================

Usage: npx tsx scripts/admin-cli.ts <command> [args]

Commands:
  users                         List all users
  stats                         Show application statistics
  promote <email|id>            Promote user to admin
  demote <email|id>             Demote admin to regular user
  grant <email|id> <count>      Grant paid revisions to user
  deactivate <email|id>         Deactivate a user account
  activate <email|id>           Reactivate a user account
  help                          Show this help message

Examples:
  npx tsx scripts/admin-cli.ts users
  npx tsx scripts/admin-cli.ts promote john@example.com
  npx tsx scripts/admin-cli.ts grant john@example.com 10
  npx tsx scripts/admin-cli.ts stats
`);
}

async function main() {
  try {
    switch (command) {
      case "users":
        await listUsers();
        break;
      case "stats":
        await showStats();
        break;
      case "promote":
        if (!args[1]) { console.error("Usage: promote <email|id>"); process.exit(1); }
        await promoteUser(args[1]);
        break;
      case "demote":
        if (!args[1]) { console.error("Usage: demote <email|id>"); process.exit(1); }
        await demoteUser(args[1]);
        break;
      case "grant":
        if (!args[1] || !args[2]) { console.error("Usage: grant <email|id> <count>"); process.exit(1); }
        await grantRevisions(args[1], parseInt(args[2], 10));
        break;
      case "deactivate":
        if (!args[1]) { console.error("Usage: deactivate <email|id>"); process.exit(1); }
        await deactivateUser(args[1]);
        break;
      case "activate":
        if (!args[1]) { console.error("Usage: activate <email|id>"); process.exit(1); }
        await activateUser(args[1]);
        break;
      case "help":
      default:
        showHelp();
        break;
    }
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
