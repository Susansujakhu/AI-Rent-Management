import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function month(year: number, m: number) {
  return `${year}-${String(m).padStart(2, "0")}`;
}

async function main() {
  console.log("Seeding database...");

  await prisma.payment.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.room.deleteMany();

  const rooms = await Promise.all([
    prisma.room.create({ data: { name: "Room 101", floor: "Ground Floor", monthlyRent: 8000 } }),
    prisma.room.create({ data: { name: "Room 102", floor: "Ground Floor", monthlyRent: 8500 } }),
    prisma.room.create({ data: { name: "Room 201", floor: "First Floor", monthlyRent: 9000 } }),
    prisma.room.create({ data: { name: "Room 202", floor: "First Floor", monthlyRent: 9500 } }),
  ]);

  const tenants = await Promise.all([
    prisma.tenant.create({
      data: { name: "Rahul Sharma", phone: "9876543210", email: "rahul@example.com", roomId: rooms[0].id, moveInDate: new Date("2024-01-01"), deposit: 16000 },
    }),
    prisma.tenant.create({
      data: { name: "Priya Patel", phone: "9876543211", email: "priya@example.com", roomId: rooms[1].id, moveInDate: new Date("2024-03-01"), deposit: 17000 },
    }),
    prisma.tenant.create({
      data: { name: "Amit Kumar", phone: "9876543212", roomId: rooms[2].id, moveInDate: new Date("2023-11-01"), deposit: 18000 },
    }),
    prisma.tenant.create({
      data: { name: "Sunita Verma", phone: "9876543213", email: "sunita@example.com", roomId: rooms[3].id, moveInDate: new Date("2024-06-01"), deposit: 19000 },
    }),
  ]);

  // Payments for last 3 months
  const today = new Date();
  for (let offset = 2; offset >= 0; offset--) {
    const d = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    const m = month(d.getFullYear(), d.getMonth() + 1);
    const paid = offset > 0;
    for (let i = 0; i < tenants.length; i++) {
      await prisma.payment.create({
        data: {
          tenantId: tenants[i].id,
          roomId: rooms[i].id,
          month: m,
          amountDue: rooms[i].monthlyRent,
          amountPaid: paid ? rooms[i].monthlyRent : 0,
          status: paid ? "PAID" : "PENDING",
          paidDate: paid ? new Date(d.getFullYear(), d.getMonth(), 5) : null,
          method: paid ? "UPI" : null,
        },
      });
    }
  }

  await Promise.all([
    prisma.expense.create({ data: { title: "Plumbing repair", category: "PLUMBING", amount: 1500, date: new Date("2026-02-10"), roomId: rooms[0].id, description: "Fixed leaking pipe" } }),
    prisma.expense.create({ data: { title: "Electrical wiring check", category: "ELECTRICAL", amount: 2000, date: new Date("2026-02-15"), description: "Annual inspection" } }),
    prisma.expense.create({ data: { title: "Staircase painting", category: "PAINTING", amount: 5000, date: new Date("2026-01-20"), description: "Repainted common area" } }),
  ]);

  console.log("Seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
