import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.update({
    where: { email: "testuser@example.com" },
    data:  { phone: "+9779800000001" },
  });
  console.log("Updated phone:", user.phone);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
