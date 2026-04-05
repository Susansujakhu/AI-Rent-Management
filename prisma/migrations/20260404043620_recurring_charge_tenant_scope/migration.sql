-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RecurringCharge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "tenantId" TEXT,
    "title" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "effectiveFrom" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringCharge_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RecurringCharge" ("amount", "createdAt", "id", "roomId", "title") SELECT "amount", "createdAt", "id", "roomId", "title" FROM "RecurringCharge";
DROP TABLE "RecurringCharge";
ALTER TABLE "new_RecurringCharge" RENAME TO "RecurringCharge";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
