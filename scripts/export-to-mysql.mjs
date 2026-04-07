/**
 * export-to-mysql.mjs
 * Reads all data from the local SQLite database and outputs a MySQL-compatible
 * SQL file that you can import via phpMyAdmin.
 *
 * Usage:
 *   node scripts/export-to-mysql.mjs > export.sql
 *
 * Then import export.sql via phpMyAdmin → Import tab.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function esc(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "number") return String(val);
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace("T", " ")}'`;
  // Escape string for MySQL
  return `'${String(val).replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
}

function insertRow(table, row) {
  const cols = Object.keys(row).map(c => `\`${c}\``).join(", ");
  const vals = Object.values(row).map(esc).join(", ");
  return `INSERT INTO \`${table}\` (${cols}) VALUES (${vals});`;
}

async function main() {
  const lines = [];

  lines.push("-- ============================================================");
  lines.push("-- MySQL export generated from SQLite");
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push("-- ============================================================");
  lines.push("");
  lines.push("SET FOREIGN_KEY_CHECKS = 0;");
  lines.push("SET NAMES utf8mb4;");
  lines.push("");

  // ── Schema ──────────────────────────────────────────────────────────────────
  lines.push(`
CREATE TABLE IF NOT EXISTS \`Room\` (
  \`id\`          VARCHAR(36)    NOT NULL,
  \`name\`        VARCHAR(191)   NOT NULL,
  \`floor\`       VARCHAR(191)   DEFAULT NULL,
  \`monthlyRent\` DOUBLE         NOT NULL,
  \`description\` TEXT           DEFAULT NULL,
  \`createdAt\`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\`   DATETIME(3)    NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`Tenant\` (
  \`id\`             VARCHAR(36)   NOT NULL,
  \`name\`           VARCHAR(191)  NOT NULL,
  \`phone\`          VARCHAR(191)  NOT NULL,
  \`email\`          VARCHAR(191)  DEFAULT NULL,
  \`roomId\`         VARCHAR(36)   DEFAULT NULL,
  \`moveInDate\`     DATETIME(3)   NOT NULL,
  \`moveOutDate\`    DATETIME(3)   DEFAULT NULL,
  \`deposit\`        DOUBLE        NOT NULL DEFAULT 0,
  \`creditBalance\`  DOUBLE        NOT NULL DEFAULT 0,
  \`notes\`          TEXT          DEFAULT NULL,
  \`whatsappNotify\` TINYINT(1)    NOT NULL DEFAULT 1,
  \`portalEnabled\`  TINYINT(1)    NOT NULL DEFAULT 0,
  \`portalToken\`    VARCHAR(191)  DEFAULT NULL,
  \`createdAt\`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\`      DATETIME(3)   NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`Tenant_portalToken_key\` (\`portalToken\`),
  KEY \`Tenant_roomId_fkey\` (\`roomId\`),
  CONSTRAINT \`Tenant_roomId_fkey\` FOREIGN KEY (\`roomId\`) REFERENCES \`Room\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`Payment\` (
  \`id\`         VARCHAR(36)   NOT NULL,
  \`tenantId\`   VARCHAR(36)   NOT NULL,
  \`roomId\`     VARCHAR(36)   NOT NULL,
  \`month\`      VARCHAR(7)    NOT NULL,
  \`amountDue\`  DOUBLE        NOT NULL,
  \`amountPaid\` DOUBLE        NOT NULL DEFAULT 0,
  \`paidDate\`   DATETIME(3)   DEFAULT NULL,
  \`method\`     VARCHAR(191)  DEFAULT NULL,
  \`status\`     VARCHAR(191)  NOT NULL DEFAULT 'PENDING',
  \`notes\`      TEXT          DEFAULT NULL,
  \`createdAt\`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\`  DATETIME(3)   NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`Payment_tenantId_month_key\` (\`tenantId\`, \`month\`),
  KEY \`Payment_roomId_fkey\` (\`roomId\`),
  CONSTRAINT \`Payment_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`Tenant\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`Payment_roomId_fkey\` FOREIGN KEY (\`roomId\`) REFERENCES \`Room\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`RecurringCharge\` (
  \`id\`            VARCHAR(36)   NOT NULL,
  \`roomId\`        VARCHAR(36)   NOT NULL,
  \`tenantId\`      VARCHAR(36)   DEFAULT NULL,
  \`title\`         VARCHAR(191)  NOT NULL,
  \`amount\`        DOUBLE        NOT NULL,
  \`effectiveFrom\` VARCHAR(7)    DEFAULT NULL,
  \`createdAt\`     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  KEY \`RecurringCharge_roomId_fkey\` (\`roomId\`),
  KEY \`RecurringCharge_tenantId_fkey\` (\`tenantId\`),
  CONSTRAINT \`RecurringCharge_roomId_fkey\` FOREIGN KEY (\`roomId\`) REFERENCES \`Room\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT \`RecurringCharge_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`Tenant\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`OneTimeCharge\` (
  \`id\`         VARCHAR(36)   NOT NULL,
  \`tenantId\`   VARCHAR(36)   NOT NULL,
  \`title\`      VARCHAR(191)  NOT NULL,
  \`amount\`     DOUBLE        NOT NULL,
  \`amountPaid\` DOUBLE        NOT NULL DEFAULT 0,
  \`date\`       DATETIME(3)   NOT NULL,
  \`status\`     VARCHAR(191)  NOT NULL DEFAULT 'PENDING',
  \`notes\`      TEXT          DEFAULT NULL,
  \`createdAt\`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\`  DATETIME(3)   NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`OneTimeCharge_tenantId_fkey\` (\`tenantId\`),
  CONSTRAINT \`OneTimeCharge_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`Tenant\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`Expense\` (
  \`id\`          VARCHAR(36)   NOT NULL,
  \`title\`       VARCHAR(191)  NOT NULL,
  \`amount\`      DOUBLE        NOT NULL,
  \`date\`        DATETIME(3)   NOT NULL,
  \`category\`    VARCHAR(191)  NOT NULL DEFAULT 'OTHER',
  \`roomId\`      VARCHAR(36)   DEFAULT NULL,
  \`description\` TEXT          DEFAULT NULL,
  \`createdAt\`   DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\`   DATETIME(3)   NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`Expense_roomId_fkey\` (\`roomId\`),
  CONSTRAINT \`Expense_roomId_fkey\` FOREIGN KEY (\`roomId\`) REFERENCES \`Room\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`Setting\` (
  \`key\`   VARCHAR(191)  NOT NULL,
  \`value\` TEXT          NOT NULL,
  PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`User\` (
  \`id\`           VARCHAR(36)   NOT NULL,
  \`email\`        VARCHAR(191)  NOT NULL,
  \`passwordHash\` VARCHAR(191)  NOT NULL,
  \`createdAt\`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`User_email_key\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`Session\` (
  \`id\`        VARCHAR(36)   NOT NULL,
  \`userId\`    VARCHAR(36)   NOT NULL,
  \`token\`     VARCHAR(191)  NOT NULL,
  \`expiresAt\` DATETIME(3)   NOT NULL,
  \`createdAt\` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`Session_token_key\` (\`token\`),
  KEY \`Session_userId_fkey\` (\`userId\`),
  CONSTRAINT \`Session_userId_fkey\` FOREIGN KEY (\`userId\`) REFERENCES \`User\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS \`TenantSession\` (
  \`id\`        VARCHAR(36)   NOT NULL,
  \`tenantId\`  VARCHAR(36)   NOT NULL,
  \`token\`     VARCHAR(191)  NOT NULL,
  \`expiresAt\` DATETIME(3)   NOT NULL,
  \`createdAt\` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`TenantSession_token_key\` (\`token\`),
  KEY \`TenantSession_tenantId_fkey\` (\`tenantId\`),
  CONSTRAINT \`TenantSession_tenantId_fkey\` FOREIGN KEY (\`tenantId\`) REFERENCES \`Tenant\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`);

  // ── Data ────────────────────────────────────────────────────────────────────

  const tables = [
    { name: "Room",            rows: await prisma.room.findMany() },
    { name: "Tenant",          rows: await prisma.tenant.findMany() },
    { name: "Payment",         rows: await prisma.payment.findMany() },
    { name: "RecurringCharge", rows: await prisma.recurringCharge.findMany() },
    { name: "OneTimeCharge",   rows: await prisma.oneTimeCharge.findMany() },
    { name: "Expense",         rows: await prisma.expense.findMany() },
    { name: "Setting",         rows: await prisma.setting.findMany() },
    { name: "User",            rows: await prisma.user.findMany() },
    { name: "Session",         rows: await prisma.session.findMany() },
    { name: "TenantSession",   rows: await prisma.tenantSession.findMany() },
  ];

  for (const { name, rows } of tables) {
    if (rows.length === 0) continue;
    lines.push(`-- ${name} (${rows.length} rows)`);
    for (const row of rows) {
      lines.push(insertRow(name, row));
    }
    lines.push("");
  }

  lines.push("SET FOREIGN_KEY_CHECKS = 1;");
  lines.push("-- Export complete");

  console.log(lines.join("\n"));
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
