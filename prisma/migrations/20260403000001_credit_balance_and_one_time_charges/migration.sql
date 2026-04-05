-- Add credit balance tracking to Tenant
ALTER TABLE "Tenant" ADD COLUMN "creditBalance" REAL NOT NULL DEFAULT 0;

-- Create OneTimeCharge table
CREATE TABLE "OneTimeCharge" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "tenantId"   TEXT NOT NULL,
    "title"      TEXT NOT NULL,
    "amount"     REAL NOT NULL,
    "amountPaid" REAL NOT NULL DEFAULT 0,
    "date"       DATETIME NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'PENDING',
    "notes"      TEXT,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  DATETIME NOT NULL,
    CONSTRAINT "OneTimeCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
