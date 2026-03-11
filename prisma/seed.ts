import { PrismaClient, UserRole } from "@prisma/client";
import { createOrgDefaults } from "../src/lib/orgDefaults";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding PTOFlow...");

  // Create organization
  const org = await prisma.organization.upsert({
    where: { domain: "productdatamasterclass.com" },
    update: {},
    create: {
      name: "PTOFlow Demo",
      domain: "productdatamasterclass.com",
      prorateNewEmployees: true,
    },
  });
  console.log(`Organization: ${org.name} (${org.id})`);

  // Update Derek to Admin and link to org
  const admin = await prisma.user.update({
    where: { email: "derek@productdatamasterclass.com" },
    data: {
      role: UserRole.ADMIN,
      organizationId: org.id,
      startDate: new Date("2026-01-01"),
    },
  });
  console.log(`Admin user: ${admin.name} (${admin.role})`);

  // Seed default categories, teams, and holidays
  await createOrgDefaults(prisma, org.id);
  console.log("Default categories, teams, and holidays created.");

  // Seed vacation bank for admin (20 days, full year since start is Jan 1)
  const vacationCat = await prisma.leaveCategory.findFirst({
    where: { name: "Vacation", organizationId: org.id },
  });
  if (vacationCat) {
    await prisma.leaveBank.upsert({
      where: { userId_categoryId_year: { userId: admin.id, categoryId: vacationCat.id, year: 2026 } },
      update: {},
      create: {
        userId: admin.id,
        categoryId: vacationCat.id,
        year: 2026,
        allocatedDays: 20,
        usedDays: 0,
      },
    });
    console.log(`Leave bank: 20 vacation days for ${admin.name}`);
  }

  console.log("\nSeed complete!");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
