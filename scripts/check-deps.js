#!/usr/bin/env node
// Run after every `git reset --hard` on the cPanel server.
// Idempotent: safe to re-run; fixes the two failure modes we keep hitting.
//
//   1. CloudLinux NodeJS Selector requires node_modules to be a SYMLINK to
//      ~/nodevenv/<app>/<ver>/lib/node_modules. Cron jobs, the cPanel "Run
//      NPM Install" button, and other host-side actions turn it back into a
//      real directory — at which point npm refuses to install anything and
//      WhatsApp/Baileys break.
//
//   2. The Baileys + Boom + Pino + qrcode stack is required for Direct
//      WhatsApp mode but isn't always re-installed by the cPanel panel when
//      package.json changes. We check it explicitly and re-install if gone.
//
// Usage (on the cPanel server, after `source ~/nodevenv/.../activate`):
//   node scripts/check-deps.js

const fs        = require("fs");
const path      = require("path");
const { execSync } = require("child_process");

const NODE_MODULES = path.join(process.cwd(), "node_modules");

// CloudLinux sets NODE_PATH to the nodevenv path first, then the system
// node_modules. Take the first entry as our symlink target.
function detectNodevenvPath() {
  const np = process.env.NODE_PATH;
  if (np) {
    const first = np.split(path.delimiter)[0];
    if (first && first.includes("/nodevenv/")) return first;
  }
  // Fallback: guess from $HOME if NODE_PATH isn't set (e.g. when run outside
  // the activated venv shell). User can override via WA_NODEVENV_PATH.
  if (process.env.WA_NODEVENV_PATH) return process.env.WA_NODEVENV_PATH;
  return null;
}

function ensureSymlink() {
  let stat;
  try { stat = fs.lstatSync(NODE_MODULES); } catch { stat = null; }

  if (stat && stat.isSymbolicLink()) {
    console.log("✓ node_modules is a symlink");
    return;
  }

  const target = detectNodevenvPath();
  if (!target) {
    console.error("✗ node_modules is not a symlink AND NODE_PATH isn't set.");
    console.error("  Activate the nodevenv first: source ~/nodevenv/<app>/<ver>/bin/activate");
    console.error("  Or set WA_NODEVENV_PATH to the absolute path of the nodevenv node_modules.");
    process.exit(1);
  }

  if (stat) {
    console.log(`! node_modules is a real ${stat.isDirectory() ? "directory" : "file"} — removing`);
    fs.rmSync(NODE_MODULES, { recursive: true, force: true });
  }

  console.log(`+ Creating symlink: node_modules -> ${target}`);
  fs.symlinkSync(target, NODE_MODULES, "dir");
}

function packageInstalled(name) {
  try {
    fs.accessSync(path.join(NODE_MODULES, name, "package.json"));
    return true;
  } catch {
    return false;
  }
}

function ensureWAStack() {
  const required = [
    { name: "@whiskeysockets/baileys", spec: "@whiskeysockets/baileys@^7.0.0-rc.9" },
    { name: "@hapi/boom",              spec: "@hapi/boom"                          },
    { name: "pino",                    spec: "pino"                                },
    { name: "qrcode",                  spec: "qrcode"                              },
  ];

  const missing = required.filter(p => !packageInstalled(p.name));
  if (missing.length === 0) {
    console.log("✓ WhatsApp Direct (Baileys) stack is installed");
    return;
  }

  console.log(`! Missing packages: ${missing.map(p => p.name).join(", ")} — installing`);
  const cmd = `npm install --ignore-scripts ${missing.map(p => `"${p.spec}"`).join(" ")}`;
  console.log(`  ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

try {
  ensureSymlink();
  ensureWAStack();
  console.log("\nDeps OK.");
} catch (err) {
  console.error("\nDeps check failed:", err.message);
  process.exit(1);
}
