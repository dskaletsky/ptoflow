import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { MyTeamClient } from "./MyTeamClient";

export default async function MyTeamPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === UserRole.TEAM_MEMBER) redirect("/dashboard");

  const orgId = session.user.organizationId!;
  const isAdmin = session.user.role === UserRole.ADMIN;

  const [users, categories, allTeams] = await Promise.all([
    prisma.user.findMany({
      where: isAdmin
        ? { organizationId: orgId }
        : { organizationId: orgId, managerId: session.user.id },
      include: {
        teams: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.leaveCategory.findMany({
      where: { organizationId: orgId, isActive: true },
      orderBy: { name: "asc" },
    }),
    isAdmin
      ? prisma.team.findMany({
          where: { organizationId: orgId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const userIds = users.map((u) => u.id);
  const year = new Date().getFullYear();

  const leaveBanks = await prisma.leaveBank.findMany({
    where: { userId: { in: userIds }, year },
  });

  return (
    <MyTeamClient
      users={JSON.parse(JSON.stringify(users))}
      categories={JSON.parse(JSON.stringify(categories))}
      leaveBanks={JSON.parse(JSON.stringify(leaveBanks))}
      allTeams={JSON.parse(JSON.stringify(allTeams))}
      isAdmin={isAdmin}
    />
  );
}
