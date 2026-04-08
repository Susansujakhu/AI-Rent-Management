/**
 * setup.mjs — One-time project setup
 *
 * Usage (run once after cloning or changing DB_PROVIDER):
 *   node scripts/setup.mjs
 *
 * Controls:
 *   DB_PROVIDER="sqlite"  in .env → sets up SQLite (local dev)
 *   DB_PROVIDER="mysql"   in .env → swaps schema, pushes to MySQL, builds for production
 */

import { execSync }                                      from "child_process";
import { existsSync, copyFileSync, readFileSync }        from "fs";
import { join, dirname }                                 from "path";
import { fileURLToPath }                                 from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, "..");

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
const head = msg => console.log(`\n${BOLD}${CYAN}  ${msg}${RESET}`);

function run(cmd, label) {
  info(label ?? cmd);
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
  } catch {
    fail(`Command failed: ${cmd}`);
  }
}

function tryRun(cmd, label, hint) {
  info(label ?? cmd);
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit" });
    return true;
  } catch {
    warn(`Failed — ${hint}`);
    return false;
  }
}

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

// ─────────────────────────────────────────────────────────────────────────────

const envPath     = join(ROOT, ".env");
const examplePath = join(ROOT, ".env.example");

// ── 1. .env bootstrap ────────────────────────────────────────────────────────
if (!existsSync(envPath)) {
  if (existsSync(examplePath)) {
    copyFileSync(examplePath, envPath);
    console.log(`\n${YELLOW}  .env created from .env.example${RESET}`);
    console.log(`  ${YELLOW}Open .env and fill in your values, then re-run this script.${RESET}\n`);
  } else {
    fail(".env not found and .env.example is missing. Create .env manually.");
  }
  process.exit(0);
}

const env        = parseEnv(envPath);
const dbProvider = (env.DB_PROVIDER ?? "sqlite").toLowerCase();
const isProd     = dbProvider === "mysql";

if (!["sqlite", "mysql"].includes(dbProvider)) {
  fail(`DB_PROVIDER must be "sqlite" or "mysql". Got: "${dbProvider}"`);
}

console.log(`\n${BOLD}${CYAN}╔═══════════════════════════════════════╗${RESET}`);
console.log(`${BOLD}${CYAN}║${RESET}${BOLD}  Rent Manager — Setup (${isProd ? "MySQL/Prod  " : "SQLite/Dev  "})  ${CYAN}║${RESET}`);
console.log(`${BOLD}${CYAN}╚═══════════════════════════════════════╝${RESET}`);

// ── 2. Node version ──────────────────────────────────────────────────────────
head("Checking environment");
const [major] = process.versions.node.split(".").map(Number);
if (major < 18) fail(`Node.js 18+ required. You have ${process.versions.node}`);
ok(`Node.js ${process.versions.node}`);
ok(`DB_PROVIDER = ${dbProvider}`);

// ── 3. Validate DATABASE_URL ─────────────────────────────────────────────────
if (!env.DATABASE_URL) {
  fail("DATABASE_URL is not set in .env");
}
if (isProd && !env.DATABASE_URL.startsWith("mysql://")) {
  fail(`DB_PROVIDER is "mysql" but DATABASE_URL doesn't look like a MySQL URL.\nSet DATABASE_URL=mysql://user:pass@localhost:3306/dbname in .env`);
}
if (!isProd && env.DATABASE_URL.startsWith("mysql://")) {
  warn(`DB_PROVIDER is "sqlite" but DATABASE_URL looks like MySQL. Check .env`);
}
ok(`DATABASE_URL configured`);

// ── 4. Install dependencies ───────────────────────────────────────────────────
head("Installing dependencies");
run("npm install", "npm install...");
ok("Dependencies ready");

// ── 5. Swap Prisma schema ─────────────────────────────────────────────────────
head("Configuring Prisma schema");

const activeSchema = join(ROOT, "prisma", "schema.prisma");
const mysqlSchema  = join(ROOT, "prisma", "schema.mysql.prisma");
const sqliteSchema = join(ROOT, "prisma", "schema.sqlite.prisma");

if (isProd) {
  if (!existsSync(mysqlSchema)) fail("prisma/schema.mysql.prisma not found");
  // Backup SQLite schema if not already done
  if (existsSync(activeSchema) && !existsSync(sqliteSchema)) {
    copyFileSync(activeSchema, sqliteSchema);
    ok("SQLite schema backed up → prisma/schema.sqlite.prisma");
  }
  copyFileSync(mysqlSchema, activeSchema);
  ok("MySQL schema active");
} else {
  // Restore SQLite schema if we previously swapped to MySQL
  if (existsSync(sqliteSchema)) {
    copyFileSync(sqliteSchema, activeSchema);
    ok("SQLite schema restored");
  } else {
    ok("SQLite schema already active");
  }
}

// ── 6. Generate Prisma client ─────────────────────────────────────────────────
head("Generating Prisma client");
const generated = tryRun(
  "npx prisma generate",
  "npx prisma generate...",
  "Dev server may be holding the file lock — stop it, then re-run this script."
);
if (generated) ok("Prisma client generated");

// ── 7. Push schema to database ────────────────────────────────────────────────
head("Setting up database");
const pushed = tryRun(
  "npx prisma db push",
  "npx prisma db push...",
  "Check DATABASE_URL in .env and ensure the database is reachable."
);
if (pushed) ok(isProd ? "MySQL tables ready" : "SQLite database ready (dev.db)");

// ── 8. Build (production only) ────────────────────────────────────────────────
if (isProd) {
  head("Building for production");
  run("npm run build", "npm run build...");
  ok("Production build complete");
}

// ── Done ──────────────────────────────────────────────────────────────────────
console.log(`\n${BOLD}${GREEN}╔═══════════════════════════════════════╗${RESET}`);
console.log(`${BOLD}${GREEN}║         Setup complete! 🎉             ║${RESET}`);
console.log(`${BOLD}${GREEN}╚═══════════════════════════════════════╝${RESET}\n`);

if (isProd) {
  console.log(`${BOLD}Next steps:${RESET}`);
  console.log(`  1. ${YELLOW}Import existing data (optional):${RESET}`);
  console.log(`       node scripts/export-to-mysql.mjs > export.sql`);
  console.log(`       then import export.sql via phpMyAdmin\n`);
  console.log(`  2. ${CYAN}npm start${RESET} — start the production server`);
  console.log(`  3. Open your domain → ${CYAN}/signup${RESET} to create your admin account\n`);
} else {
  console.log(`${BOLD}Next steps:${RESET}`);
  console.log(`  1. ${CYAN}npm run dev${RESET} — start the dev server`);
  console.log(`  2. Open ${CYAN}http://localhost:3000/signup${RESET}`);
  console.log(`  3. Create your admin account and start adding rooms & tenants\n`);
}
