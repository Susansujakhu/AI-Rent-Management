#!/usr/bin/env node
// One-shot migration runner for the RentHistory table. Safe to re-run —
// the underlying CREATE TABLE is IF NOT EXISTS and the script checks first
// and exits cleanly when the table is already there.
// Usage on cPanel:
//   source ~/nodevenv/easy-rent.xpertthemes.com/20/bin/activate
//   cd ~/easy-rent.xpertthemes.com
//   node scripts/apply-rent-history-migration.js

const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

(async () => {
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.$queryRawUnsafe(
      "SHOW TABLES LIKE 'RentHistory'"
    );
    if (existing.length > 0) {
      console.log("✓ RentHistory table already exists — nothing to do.");
      return;
    }

    const sqlPath = path.join(__dirname, "migrations", "2026-06-02-rent-history.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Strip line comments and split on semicolon-newline so we run each
    // statement separately ($executeRawUnsafe only accepts one at a time).
    const stmts = sql
      .replace(/^--.*$/gm, "")
      .split(/;\s*\n/)
      .map(s => s.trim())
      .filter(Boolean);

    for (const s of stmts) {
      await prisma.$executeRawUnsafe(s);
      console.log("  ✓", s.split("\n")[0].slice(0, 100));
    }
    console.log("\n✓ RentHistory migration applied.");
  } catch (e) {
    console.error("✗ Migration failed:", e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
