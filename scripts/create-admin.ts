/**
 * Creates or updates the superadmin account.
 * Run once after DB setup:  npx tsx scripts/create-admin.ts
 *
 * Default password: Admin@123  (change via Settings → Security after first login)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "sushansujakhu14@gmail.com";
const ADMIN_PHONE = "9866297369";
const ADMIN_NAME  = "Sushan";
const DEFAULT_PW  = "Admin@123";

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PW, 10);

  const admin = await prisma.user.upsert({
    where:  { email: ADMIN_EMAIL },
    update: {
      role:          "admin",
      phone:         ADMIN_PHONE,
      phoneVerified: true,
      name:          ADMIN_NAME,
    },
    create: {
      email:         ADMIN_EMAIL,
      name:          ADMIN_NAME,
      phone:         ADMIN_PHONE,
      phoneVerified: true,
      role:          "admin",
      plan:          "pro",
      passwordHash:  hash,
    },
  });

  console.log("✅ Superadmin ready:");
  console.log("   Email   :", admin.email);
  console.log("   Phone   :", admin.phone);
  console.log("   Role    :", admin.role);
  console.log("   Plan    :", admin.plan);
  if (!process.env.ADMIN_EXISTS) {
    console.log("   Password: Admin@123  ← change this after first login!");
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
