import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { EmployeeProfileClient } from "./EmployeeProfileClient";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === UserRole.TEAM_MEMBER) redirect("/dashboard");

  const { id } = await params;
  const orgId = session.user.organizationId!;
  const isAdmin = session.user.role === UserRole.ADMIN;

  const year = new Date().getFullYear();

  const [employee, categories, banks, requests, allTeams, managers, holidays] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id },
        include: {
          teams: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true } },
        },
      }),
      prisma.leaveCategory.findMany({
        where: { organizationId: orgId, isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.leaveBank.findMany({
        where: { userId: id, year },
      }),
      prisma.leaveRequest.findMany({
        where: { userId: id },
        include: { category: true },
        orderBy: { createdAt: "desc" },
      }),
      isAdmin
        ? prisma.team.findMany({
            where: { organizationId: orgId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      isAdmin
        ? prisma.user.findMany({
            where: {
              organizationId: orgId,
              role: { in: [UserRole.ADMIN, UserRole.MANAGER] },
            },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : Promise.resolve([]),
      prisma.companyHoliday.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, date: true, recurring: true },
      }),
    ]);

  if (!employee || employee.organizationId !== orgId) {
    redirect("/my-team");
  }

  // Managers can only view their direct reports
  if (!isAdmin && employee.managerId !== session.user.id) {
    redirect("/my-team");
  }

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const historyRequests = requests.filter((r) => r.status !== "PENDING");

  return (
    <EmployeeProfileClient
      employee={JSON.parse(JSON.stringify(employee))}
      categories={JSON.parse(JSON.stringify(categories))}
      banks={JSON.parse(JSON.stringify(banks))}
      pendingRequests={JSON.parse(JSON.stringify(pendingRequests))}
      historyRequests={JSON.parse(JSON.stringify(historyRequests))}
      allTeams={JSON.parse(JSON.stringify(allTeams))}
      managers={JSON.parse(JSON.stringify(managers))}
      holidays={JSON.parse(JSON.stringify(holidays))}
      isAdmin={isAdmin}
    />
  );
}
