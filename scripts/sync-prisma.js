#!/usr/bin/env node
// Run after every git reset --hard on the cPanel server to sync the Prisma
// generated client into the CloudLinux virtual environment (node_modules symlink).
// Usage: node scripts/sync-prisma.js

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const GIT_BASE  = "node_modules/.prisma/client/";
const REAL_BASE = fs.realpathSync("node_modules") + "/.prisma/client/";

const FILES = [
  "index.js",
  "index.d.ts",
  "default.js",
  "default.d.ts",
  "wasm.js",
  "wasm.d.ts",
  "package.json",
  "schema.prisma",
  "query_engine_bg.js",
  "query_compiler_fast_bg.js",
];

console.log("Syncing Prisma client to:", REAL_BASE);

let ok = 0, skip = 0;
for (const f of FILES) {
  try {
    const content = execSync(`git show HEAD:${GIT_BASE}${f}`, { maxBuffer: 20 * 1024 * 1024 });
    fs.writeFileSync(REAL_BASE + f, content);
    console.log("  ✓", f, `(${content.length.toLocaleString()} bytes)`);
    ok++;
  } catch {
    console.log("  –", f, "(not in git, skipped)");
    skip++;
  }
}

console.log(`\nDone: ${ok} updated, ${skip} skipped.`);
