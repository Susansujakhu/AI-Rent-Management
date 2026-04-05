-- DropTable (old schema tables)
DROP TABLE IF EXISTS "RentPayment";
DROP TABLE IF EXISTS "UtilityBillRoom";
DROP TABLE IF EXISTS "UtilityBill";
DROP TABLE IF EXISTS "Deposit";
DROP TABLE IF EXISTS "MaintenanceExpense";

-- Make roomId nullable on Tenant and add new columns (SQLite requires table recreation)
PRAGMA foreign_keys=OFF;

CREATE TABLE "Tenant_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "roomId" TEXT,
    "moveInDate" DATETIME NOT NULL,
    "moveOutDate" DATETIME,
    "deposit" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tenant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "Tenant_new" ("id", "name", "phone", "email", "roomId", "moveInDate", "moveOutDate", "deposit", "notes", "createdAt", "updatedAt")
SELECT "id", "name", COALESCE("phone", ''), "email", "roomId", "moveInDate", "moveOutDate", 0, NULL, "createdAt", "updatedAt"
FROM "Tenant";

DROP TABLE "Tenant";
ALTER TABLE "Tenant_new" RENAME TO "Tenant";

-- AlterTable: Add missing columns to Room
ALTER TABLE "Room" ADD COLUMN "description" TEXT;

-- CreateTable: Payment
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amountDue" REAL NOT NULL,
    "amountPaid" REAL NOT NULL DEFAULT 0,
    "paidDate" DATETIME,
    "method" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tenantId_month_key" ON "Payment"("tenantId", "month");

-- CreateTable: Expense
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "date" DATETIME NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "roomId" TEXT,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

PRAGMA foreign_keys=ON;
