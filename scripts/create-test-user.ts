/**
 * Creates a test user for development.
 * Run: npx tsx scripts/create-test-user.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("Test@123", 10);

  const user = await prisma.user.upsert({
    where:  { email: "testuser@example.com" },
    update: { phoneVerified: true },
    create: {
      email:         "testuser@example.com",
      name:          "Test User",
      phone:         "9800000001",
      phoneVerified: true,
      role:          "user",
      plan:          "free",
      passwordHash:  hash,
    },
  });

  console.log("✅ Test user ready:");
  console.log("   Email   :", user.email);
  console.log("   Password: Test@123");
  console.log("   Plan    : free");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
