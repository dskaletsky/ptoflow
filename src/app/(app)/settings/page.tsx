import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== UserRole.ADMIN) redirect("/dashboard");

  const orgId = session.user.organizationId!;

  const [org, users, categories, holidays, teams] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true, name: true, domain: true, prorateNewEmployees: true,
        googleCalendarId: true, googleCalendarName: true, googleAdminEmail: true,
      },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      include: {
        teams: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.leaveCategory.findMany({
      where: { organizationId: orgId },
      orderBy: { name: "asc" },
    }),
    prisma.companyHoliday.findMany({
      where: { organizationId: orgId },
      orderBy: { date: "asc" },
    }),
    prisma.team.findMany({
      where: { organizationId: orgId },
      include: {
        manager: { select: { id: true, name: true } },
        members: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <SettingsClient
      org={JSON.parse(JSON.stringify(org))}
      users={JSON.parse(JSON.stringify(users))}
      categories={JSON.parse(JSON.stringify(categories))}
      holidays={JSON.parse(JSON.stringify(holidays))}
      teams={JSON.parse(JSON.stringify(teams))}
      currentUserId={session.user.id}
    />
  );
}
