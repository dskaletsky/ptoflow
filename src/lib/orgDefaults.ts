import { PrismaClient } from "@prisma/client";

const DEFAULT_CATEGORIES = [
  { name: "Vacation", emoji: "🏝️", isUnlimited: false, defaultDays: 20, minimumDays: null, requiresApproval: true },
  { name: "Sick Time", emoji: "🤒", isUnlimited: true, defaultDays: null, minimumDays: null, requiresApproval: false },
  { name: "Traveling", emoji: "✈️", isUnlimited: true, defaultDays: null, minimumDays: null, requiresApproval: false },
  { name: "Professional Development", emoji: "🎓", isUnlimited: true, defaultDays: null, minimumDays: null, requiresApproval: false },
  { name: "Maternity/Paternity Leave", emoji: "👶🏼", isUnlimited: true, defaultDays: null, minimumDays: null, requiresApproval: true },
  { name: "Mental Health", emoji: "🧠", isUnlimited: true, defaultDays: null, minimumDays: null, requiresApproval: false },
  { name: "Other", emoji: "❓", isUnlimited: true, defaultDays: null, minimumDays: null, requiresApproval: false },
];

const DEFAULT_TEAMS = [
  "Executive Team",
  "Marketing",
  "Sales",
  "Product",
  "Engineering",
  "Customer Success",
  "Operations",
];

const DEFAULT_HOLIDAYS = [
  { name: "New Year's Day", month: 1, day: 1 },
  { name: "Martin Luther King Jr. Day", month: 1, day: 19 },
  { name: "Presidents' Day", month: 2, day: 16 },
  { name: "Memorial Day", month: 5, day: 25 },
  { name: "Juneteenth", month: 6, day: 19 },
  { name: "Independence Day", month: 7, day: 4 },
  { name: "Labor Day", month: 9, day: 7 },
  { name: "Columbus Day", month: 10, day: 12 },
  { name: "Veterans Day", month: 11, day: 11 },
  { name: "Thanksgiving Day", month: 11, day: 26 },
  { name: "Christmas Day", month: 12, day: 25 },
];

export async function createOrgDefaults(prisma: PrismaClient, organizationId: string) {
  const year = new Date().getFullYear();

  // Default leave categories
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.leaveCategory.upsert({
      where: { name_organizationId: { name: cat.name, organizationId } },
      update: {},
      create: { ...cat, organizationId },
    });
  }

  // Default teams
  for (const name of DEFAULT_TEAMS) {
    await prisma.team.upsert({
      where: { name_organizationId: { name, organizationId } },
      update: {},
      create: { name, organizationId },
    });
  }

  // Default US holidays for the current year
  for (const h of DEFAULT_HOLIDAYS) {
    const date = new Date(year, h.month - 1, h.day);
    await prisma.companyHoliday.upsert({
      where: { organizationId_date: { organizationId, date } },
      update: {},
      create: { name: h.name, date, organizationId, recurring: true },
    });
  }
}
