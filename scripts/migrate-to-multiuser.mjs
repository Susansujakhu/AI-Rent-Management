/**
 * migrate-to-multiuser.mjs
 *
 * Migrates existing single-user data to multi-user format by assigning all
 * rows that have an empty/null userId to the first (and presumably only) user.
 *
 * Usage:
 *   node scripts/migrate-to-multiuser.mjs
 *
 * Safe to run multiple times — only updates rows where userId is '' or NULL.
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname }            from "path";
import { fileURLToPath }            from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");

// ── Colours ──────────────────────────────────────────────────────────────────

const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const RED    = "\x1b[31m";
const BOLD   = "\x1b[1m";
const RESET  = "\x1b[0m";

const ok   = msg => console.log(`${GREEN}  ✓${RESET}  ${msg}`);
const info = msg => console.log(`${CYAN}  →${RESET}  ${msg}`);
const warn = msg => console.log(`${YELLOW}  ⚠${RESET}  ${msg}`);
const fail = msg => { console.error(`${RED}  ✗${RESET}  ${msg}`); process.exit(1); };

// ── Parse .env ───────────────────────────────────────────────────────────────

/** Parse KEY="VALUE" or KEY=VALUE from a .env file */
function parseEnv(filePath) {
  if (!existsSync(filePath)) return {};
  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split("\n")
      .filter(l => l.trim() && !l.startsWith("#"))
      .map(l => {
        const [key, ...rest] = l.split("=");
        return [key.trim(), rest.join("=").trim().replace(/^["']|["']$/g, "")];
      })
  );
}

const envPath = join(ROOT, ".env");
if (!existsSync(envPath)) fail(".env not found. Run setup first.");

const env        = parseEnv(envPath);
const dbProvider = (env.DB_PROVIDER ?? "sqlite").toLowerCase();

if (!["sqlite", "mysql"].includes(dbProvider)) {
  fail(`DB_PROVIDER must be "sqlite" or "mysql". Got: "${dbProvider}"`);
}

// ── Tables with userId that need migrating ────────────────────────────────────
// Setting uses a composite PK (userId, key) — handled specially below.
const TABLES = ["Room", "Tenant", "Payment", "Expense", "RecurringCharge", "OneTimeCharge"];

console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════╗${RESET}`);
console.log(`${BOLD}${CYAN}║${RESET}${BOLD}  Rent Manager — Multi-user Migration      ${CYAN}║${RESET}`);
console.log(`${BOLD}${CYAN}╚══════════════════════════════════════════╝${RESET}`);
info(`DB_PROVIDER = ${dbProvider}`);

// ─────────────────────────────────────────────────────────────────────────────

if (dbProvider === "sqlite") {
  await runSqlite();
} else {
  await runMysql();
}

// ── SQLite path ───────────────────────────────────────────────────────────────

async function runSqlite() {
  const { default: Database } = await import("better-sqlite3");

  // Derive DB path from DATABASE_URL (strip "file:" prefix if present)
  const rawUrl = env.DATABASE_URL ?? "";
  const dbPath = rawUrl.startsWith("file:")
    ? join(ROOT, rawUrl.replace(/^file:/, ""))
    : join(ROOT, "prisma", "dev.db");

  if (!existsSync(dbPath)) fail(`SQLite database not found at: ${dbPath}`);

  const db = new Database(dbPath);

  // Find the first user
  const user = db.prepare(`SELECT id, email FROM "User" ORDER BY createdAt ASC LIMIT 1`).get();

  if (!user) {
    fail(`No user found — sign up at /signup first, then run this script`);
  }

  ok(`Found user: ${user.email} (${user.id})`);
  console.log();

  const summary = [];

  for (const table of TABLES) {
    let count = 0;
    try {
      // Count rows that need updating (userId is NULL or empty string)
      const { total } = db.prepare(
        `SELECT COUNT(*) AS total FROM "${table}" WHERE userId IS NULL OR userId = ''`
      ).get();

      if (total === 0) {
        info(`${table}: already up-to-date (0 rows to update)`);
        summary.push({ table, updated: 0 });
        continue;
      }

      const result = db.prepare(
        `UPDATE "${table}" SET userId = ? WHERE userId IS NULL OR userId = ''`
      ).run(user.id);

      count = result.changes;
      ok(`${table}: updated ${count} row${count !== 1 ? "s" : ""}`);
    } catch (err) {
      warn(`${table}: skipped — ${err.message}`);
      count = 0;
    }
    summary.push({ table, updated: count });
  }

  // Handle Setting table (composite PK, can't update userId directly — skip with note)
  try {
    const { total } = db.prepare(
      `SELECT COUNT(*) AS total FROM "Setting" WHERE userId IS NULL OR userId = ''`
    ).get();
    if (total > 0) {
      warn(`Setting: ${total} rows have empty userId — these cannot be migrated automatically (composite PK). Re-create them after logging in.`);
    } else {
      info(`Setting: already up-to-date`);
    }
  } catch {
    // Setting table may not exist
  }

  db.close();
  printSummary(summary);
}

// ── MySQL path (via Prisma client) ────────────────────────────────────────────

async function runMysql() {
  if (!env.DATABASE_URL) fail("DATABASE_URL is not set in .env");

  // Dynamically import Prisma client (generated for MySQL)
  let prisma;
  try {
    const { PrismaClient } = await import("@prisma/client");
    prisma = new PrismaClient();
  } catch {
    fail("Could not import Prisma client. Run `npx prisma generate` first.");
  }

  // Find the first user
  const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user) {
    await prisma.$disconnect();
    fail(`No user found — sign up at /signup first, then run this script`);
  }

  ok(`Found user: ${user.email} (${user.id})`);
  console.log();

  const summary = [];

  for (const table of TABLES) {
    const model = table.charAt(0).toLowerCase() + table.slice(1); // e.g. "room"
    try {
      const result = await prisma[model].updateMany({
        where: {
          OR: [
            { userId: null },
            { userId: "" },
          ],
        },
        data: { userId: user.id },
      });
      const count = result.count;
      if (count === 0) {
        info(`${table}: already up-to-date (0 rows to update)`);
      } else {
        ok(`${table}: updated ${count} row${count !== 1 ? "s" : ""}`);
      }
      summary.push({ table, updated: count });
    } catch (err) {
      warn(`${table}: skipped — ${err.message}`);
      summary.push({ table, updated: 0 });
    }
  }

  // Handle Setting table
  try {
    const settingCount = await prisma.setting.count({
      where: { OR: [{ userId: null }, { userId: "" }] },
    });
    if (settingCount > 0) {
      warn(`Setting: ${settingCount} rows have empty userId — cannot migrate automatically (composite PK). Re-create them after logging in.`);
    } else {
      info(`Setting: already up-to-date`);
    }
  } catch {
    // ignore
  }

  await prisma.$disconnect();
  printSummary(summary);
}

// ── Summary ───────────────────────────────────────────────────────────────────

function printSummary(summary) {
  const totalUpdated = summary.reduce((s, r) => s + r.updated, 0);

  console.log(`\n${BOLD}  Summary${RESET}`);
  console.log(`  ${"─".repeat(36)}`);
  for (const { table, updated } of summary) {
    const label = updated > 0 ? `${GREEN}${updated} updated${RESET}` : `${CYAN}already done${RESET}`;
    console.log(`  ${table.padEnd(20)} ${label}`);
  }
  console.log(`  ${"─".repeat(36)}`);
  console.log(`  Total rows updated: ${BOLD}${totalUpdated}${RESET}`);

  if (totalUpdated === 0) {
    console.log(`\n${CYAN}  Nothing to do — all rows already have a userId.${RESET}\n`);
  } else {
    console.log(`\n${GREEN}${BOLD}  Migration complete!${RESET}\n`);
  }
}
