#!/usr/bin/env node
// One-shot migration runner for the RentHistory table. Idempotent — the
// SQL uses CREATE TABLE IF NOT EXISTS, and we check existence first so
// re-runs are a no-op.
//
// Why not Prisma? On cPanel CloudLinux the Prisma Query Engine panics
// (OpenSSL/libssl mismatch), so we shell out to the `mysql` CLI client
// instead. Credentials are parsed out of DATABASE_URL in .env so the
// operator doesn't have to copy them anywhere.
//
// Usage on cPanel:
//   source ~/nodevenv/easy-rent.xpertthemes.com/20/bin/activate
//   cd ~/easy-rent.xpertthemes.com
//   node scripts/apply-rent-history-migration.js

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

console.log("Applying RentHistory migration...");
if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set. Check .env in the project root.");
  process.exit(1);
}

const url = new URL(process.env.DATABASE_URL);
const user = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);
const host = url.hostname;
const port = url.port || "3306";
const dbname = url.pathname.slice(1);

console.log(`Connecting to ${user}@${host}:${port}/${dbname}`);

// Idempotency check — skip if RentHistory already exists.
const check = spawnSync(
  "mysql",
  ["-h", host, "-P", port, "-u", user, "-N", "-B", "-e", `USE \`${dbname}\`; SHOW TABLES LIKE 'RentHistory';`],
  { env: { ...process.env, MYSQL_PWD: password }, encoding: "utf8" }
);
if (check.error) {
  console.error("✗ Could not spawn `mysql`:", check.error.code === "ENOENT"
    ? "the mysql CLI is not on PATH"
    : check.error.message);
  process.exit(1);
}
if (check.status !== 0) {
  console.error("✗ Could not query the database:");
  console.error(check.stderr || check.stdout || "(no output)");
  process.exit(1);
}
if (check.stdout.trim().length > 0) {
  console.log("✓ RentHistory table already exists — nothing to do.");
  process.exit(0);
}

// Apply the migration SQL file.
const sqlPath = path.join(__dirname, "migrations", "2026-06-02-rent-history.sql");
const sql = fs.readFileSync(sqlPath);

console.log("Running migration SQL...");
const run = spawnSync(
  "mysql",
  ["-h", host, "-P", port, "-u", user, dbname],
  { env: { ...process.env, MYSQL_PWD: password }, input: sql, encoding: "utf8" }
);
if (run.error) {
  console.error("✗ Could not spawn `mysql`:", run.error.message);
  process.exit(1);
}
if (run.status !== 0) {
  console.error("✗ Migration failed:");
  console.error(run.stderr || run.stdout || "(no output)");
  process.exit(1);
}

console.log("✓ RentHistory migration applied.");
