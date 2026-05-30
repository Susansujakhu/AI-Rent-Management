import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
(async () => {
  const u = await prisma.user.update({
    where: { email: "testuser@example.com" },
    data:  { plan: "pro" },
  });
  console.log("plan:", u.plan);
  await prisma.$disconnect();
})();
